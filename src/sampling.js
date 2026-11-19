// All estimators and sampling calculations live here. Stage 2 implements SRS only.
export function mean(rows, target = 'heart_rate_bpm') {
  if (!rows.length) throw new Error('A mean needs at least one row.');
  let sum = 0;
  for (const row of rows) {
    const value = row[target];
    if (!Number.isFinite(value)) throw new Error(`Non-numeric ${target}.`);
    sum += value;
  }
  return sum / rows.length;
}

// xmur3 seed hashing followed by sfc32; produces a reproducible pseudo-random stream.
export function seededRandom(seed) {
  const text = String(seed);
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const hash = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
  let a = hash(), b = hash(), c = hash(), d = hash();
  const next = () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  return next;
}

// Partial Fisher–Yates: equal-probability selections, without replacement.
export function simpleRandomSample(rows, n, seed) {
  if (!Number.isInteger(n) || n < 1 || n > rows.length) {
    throw new Error('Sample size must be an integer from 1 to N.');
  }
  const random = seededRandom(seed);
  const indices = Array.from({ length: rows.length }, (_, i) => i);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(random() * (rows.length - i));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, n).map(i => rows[i]);
}

export function singleSampleSummary(population, n, seed) {
  const sample = simpleRandomSample(population, n, seed);
  return { sample, sampleMean: mean(sample), trueMean: mean(population) };
}
