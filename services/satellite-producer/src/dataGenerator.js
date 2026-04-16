// Identical to data-service generator — each microservice owns its own copy.
// In a real org you'd publish this as an internal npm package.

const NUM_PSD_BINS = 512;
const FREQ_START = 400;
const FREQ_END = 500;
const FREQ_STEP = (FREQ_END - FREQ_START) / NUM_PSD_BINS;

const signals = [
  { centerBin: 80,  widthBins: 6,  peakDbm: -45, drift: 0.05 },
  { centerBin: 180, widthBins: 10, peakDbm: -52, drift: -0.03 },
  { centerBin: 310, widthBins: 4,  peakDbm: -38, drift: 0.08 },
  { centerBin: 420, widthBins: 8,  peakDbm: -60, drift: 0.02 },
];

function gaussian(x, center, width) {
  return Math.exp(-0.5 * Math.pow((x - center) / width, 2));
}

function generatePSD() {
  for (const s of signals) {
    s.centerBin += s.drift;
    if (s.centerBin < 20 || s.centerBin > NUM_PSD_BINS - 20) s.drift *= -1;
  }
  const bins = [];
  for (let i = 0; i < NUM_PSD_BINS; i++) {
    const freq = FREQ_START + i * FREQ_STEP;
    let power = -105 + (Math.random() * 4 - 2);
    for (const s of signals) {
      const contribution = s.peakDbm * gaussian(i, s.centerBin, s.widthBins);
      const linearSignal = Math.pow(10, contribution / 10);
      const linearNoise = Math.pow(10, power / 10);
      power = 10 * Math.log10(linearNoise + linearSignal);
    }
    bins.push({ freq: parseFloat(freq.toFixed(2)), power: parseFloat(power.toFixed(2)) });
  }
  return bins;
}

const CAF_CHANNELS = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  label: `CH-${String(i + 1).padStart(2, '0')}`,
  freqMHz: parseFloat((FREQ_START + (i / 16) * (FREQ_END - FREQ_START)).toFixed(2)),
}));

function generateCAF() {
  return CAF_CHANNELS.map((ch) => {
    const active = Math.random() > 0.45;
    const signalDbm = active
      ? parseFloat((-45 - Math.random() * 30).toFixed(1))
      : parseFloat((-100 - Math.random() * 10).toFixed(1));
    return { ...ch, active, signalDbm, snrDb: parseFloat((signalDbm - (-105)).toFixed(1)), timestamp: Date.now() };
  });
}

module.exports = { generatePSD, generateCAF };
