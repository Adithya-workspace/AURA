import { mulberry32 } from './prng.js';

export function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return 0;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const a = xs[i] - meanX;
    const b = ys[i] - meanY;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return 0;
  return num / Math.sqrt(dx * dy);
}

export function incidentSeries({ length = 40, onset = 16, seed, tracks }) {
  const rand = mulberry32(seed);
  const out = {};
  for (const track of tracks) out[track.key] = [];
  for (let i = 0; i < length; i += 1) {
    const spike = i < onset ? 0 : Math.min(1, (i - onset + 1) / 6);
    for (const track of tracks) {
      const noise = (rand() - 0.5) * (track.noise ?? 0);
      const value = track.base + spike * (track.peak - track.base) + noise;
      out[track.key].push(Number(Math.max(0, value).toFixed(4)));
    }
  }
  return out;
}
