const RANGES = {
  fast: [40, 90],
  normal: [500, 1100],
  slow: [1200, 2000],
};

const RAMPS = { fast: 180, normal: 3500, slow: 7000 };

export function pacingOf(value) {
  return RANGES[value] ? value : 'normal';
}

export function rampMs(pacing) {
  return RAMPS[pacingOf(pacing)];
}

/** Simulated infrastructure latency. The tool body still runs for real. */
export async function simulatedLatency(pacing) {
  const [min, max] = RANGES[pacingOf(pacing)];
  const ms = min + Math.floor(Math.random() * (max - min));
  await new Promise((resolve) => setTimeout(resolve, ms));
  return ms;
}
