// Simulates realistic satellite spectrum data

const NUM_PSD_BINS = 512;  // frequency resolution
const FREQ_START = 400;    // MHz
const FREQ_END = 500;      // MHz
const FREQ_STEP = (FREQ_END - FREQ_START) / NUM_PSD_BINS;

// Persistent signal state — signals drift over time
const signals = [
  { centerBin: 80,  widthBins: 6,  peakDbm: -45, drift: 0.05 },
  { centerBin: 180, widthBins: 10, peakDbm: -52, drift: -0.03 },
  { centerBin: 310, widthBins: 4,  peakDbm: -38, drift: 0.08 },
  { centerBin: 420, widthBins: 8,  peakDbm: -60, drift: 0.02 },
];

function gaussian(x, center, width) {
  return Math.exp(-0.5 * Math.pow((x - center) / width, 2));
}

/**
 * Power Spectral Density — frequency domain snapshot
 * Returns array of { freq: MHz, power: dBm }
 */
function generatePSD() {
  // Drift signal centers each tick
  for (const s of signals) {
    s.centerBin += s.drift;
    if (s.centerBin < 20 || s.centerBin > NUM_PSD_BINS - 20) s.drift *= -1;
  }

  const bins = [];
  for (let i = 0; i < NUM_PSD_BINS; i++) {
    const freq = FREQ_START + i * FREQ_STEP;
    let power = -105 + (Math.random() * 4 - 2); // noise floor ~-105 dBm

    for (const s of signals) {
      const contribution = s.peakDbm * gaussian(i, s.centerBin, s.widthBins);
      // add in linear domain, convert back to log
      const linearSignal = Math.pow(10, contribution / 10);
      const linearNoise = Math.pow(10, power / 10);
      power = 10 * Math.log10(linearNoise + linearSignal);
    }

    bins.push({ freq: parseFloat(freq.toFixed(2)), power: parseFloat(power.toFixed(2)) });
  }
  return bins;
}

/**
 * Channel Activity Feed — discrete channel monitoring
 * Returns snapshot of all tracked channels
 */
const CAF_CHANNELS = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  label: `CH-${String(i + 1).padStart(2, '0')}`,
  freqMHz: parseFloat((FREQ_START + (i / 16) * (FREQ_END - FREQ_START)).toFixed(2)),
  active: false,
  signalDbm: -110,
  snrDb: 0,
}));

function generateCAF() {
  const now = Date.now();
  return CAF_CHANNELS.map((ch) => {
    const active = Math.random() > 0.45;
    const signalDbm = active
      ? parseFloat((-45 - Math.random() * 30).toFixed(1))
      : parseFloat((-100 - Math.random() * 10).toFixed(1));
    const noiseFloor = -105;
    const snrDb = parseFloat((signalDbm - noiseFloor).toFixed(1));

    return {
      ...ch,
      active,
      signalDbm,
      snrDb,
      timestamp: now,
    };
  });
}

module.exports = { generatePSD, generateCAF };
