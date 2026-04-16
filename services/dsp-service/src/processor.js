/**
 * DSP Processor
 *
 * This is the entire point of the dsp-service:
 * ALL heavy computation happens here so the frontend does zero math.
 *
 * Input:  raw PSD bins  { freq, power(dBm) }[]  — could be 512-4096 bins
 * Output: binary frames containing Float32Array data ready to render
 *
 * Binary frame format (little-endian):
 *   Bytes 0-3:   frame type (uint32)
 *   Bytes 4+:    payload (varies by type)
 *
 * Types:
 *   0x01  PSD_LINE     single spectrum line (downsampled + normalized)
 *   0x02  WATERFALL    full 2D rolling buffer (rows × cols floats)
 *   0x03  CAF          channel activity feed (normalized signal strengths)
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const FRAME_TYPE = { PSD_LINE: 0x01, WATERFALL: 0x02, CAF: 0x03 };

const DISPLAY_COLS   = 256;   // downsample all PSD to this many frequency bins
const WATERFALL_ROWS = 128;   // rolling history depth (rows of spectrum over time)
const NOISE_FLOOR    = -115;  // dBm — anything below this = 0.0
const SIGNAL_PEAK    = -30;   // dBm — anything above this = 1.0

// Rolling 2D buffer: waterfall[0] = oldest row, waterfall[ROWS-1] = newest
const waterfall = Array.from({ length: WATERFALL_ROWS }, () => new Float32Array(DISPLAY_COLS));
let waterfallHead = 0; // index of oldest row (circular buffer)

// ── Normalization ─────────────────────────────────────────────────────────────

/**
 * Convert dBm value to 0.0–1.0 display range.
 * Backend does this so frontend never sees raw dBm numbers.
 */
function normalizeDbm(dbm) {
  return Math.max(0, Math.min(1, (dbm - NOISE_FLOOR) / (SIGNAL_PEAK - NOISE_FLOOR)));
}

// ── Downsampling ──────────────────────────────────────────────────────────────

/**
 * Reduce arbitrary number of PSD bins to DISPLAY_COLS bins.
 * Uses max-hold per output bin (preserves signal peaks, not averages).
 * This is what your frontend was doing before — now backend handles it.
 */
function downsamplePSD(bins) {
  const input  = bins.length;
  const output = DISPLAY_COLS;
  const result = new Float32Array(output);

  for (let i = 0; i < output; i++) {
    const start = Math.floor((i / output) * input);
    const end   = Math.floor(((i + 1) / output) * input);
    let max = -Infinity;
    for (let j = start; j < end; j++) {
      if (bins[j].power > max) max = bins[j].power;
    }
    result[i] = normalizeDbm(max);
  }

  return result;
}

// ── Frame builders ────────────────────────────────────────────────────────────

/**
 * Process one PSD snapshot.
 * - Downsamples to DISPLAY_COLS
 * - Normalizes to 0.0–1.0
 * - Pushes into rolling waterfall buffer
 * - Returns two binary frames: PSD_LINE + WATERFALL
 */
function processPSD(rawBins) {
  // 1. Backend does all the math
  const line = downsamplePSD(rawBins);

  // 2. Push into circular waterfall buffer (overwrite oldest row)
  waterfall[waterfallHead].set(line);
  waterfallHead = (waterfallHead + 1) % WATERFALL_ROWS;

  // 3. Build PSD_LINE binary frame: [type:u32][DISPLAY_COLS floats]
  const psdBuf = Buffer.allocUnsafe(4 + DISPLAY_COLS * 4);
  psdBuf.writeUInt32LE(FRAME_TYPE.PSD_LINE, 0);
  for (let i = 0; i < DISPLAY_COLS; i++) {
    psdBuf.writeFloatLE(line[i], 4 + i * 4);
  }

  // 4. Build WATERFALL binary frame: [type:u32][rows:u32][cols:u32][rows*cols floats]
  //    Reorder from circular buffer so row 0 = oldest, row N = newest
  const totalFloats = WATERFALL_ROWS * DISPLAY_COLS;
  const wfBuf = Buffer.allocUnsafe(12 + totalFloats * 4);
  wfBuf.writeUInt32LE(FRAME_TYPE.WATERFALL, 0);
  wfBuf.writeUInt32LE(WATERFALL_ROWS, 4);
  wfBuf.writeUInt32LE(DISPLAY_COLS, 8);

  let offset = 12;
  for (let row = 0; row < WATERFALL_ROWS; row++) {
    // Read in time order: oldest first
    const bufRow = waterfall[(waterfallHead + row) % WATERFALL_ROWS];
    for (let col = 0; col < DISPLAY_COLS; col++) {
      wfBuf.writeFloatLE(bufRow[col], offset);
      offset += 4;
    }
  }

  return [psdBuf, wfBuf];
}

/**
 * Process CAF channels.
 * Returns binary frame: [type:u32][count:u32][count floats: normalized signal strength]
 */
function processCAF(channels) {
  const count = channels.length;
  const buf = Buffer.allocUnsafe(8 + count * 4);
  buf.writeUInt32LE(FRAME_TYPE.CAF, 0);
  buf.writeUInt32LE(count, 4);
  for (let i = 0; i < count; i++) {
    buf.writeFloatLE(normalizeDbm(channels[i].signalDbm), 8 + i * 4);
  }
  return buf;
}

module.exports = { processPSD, processCAF, FRAME_TYPE, DISPLAY_COLS, WATERFALL_ROWS };
