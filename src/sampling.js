// Shared sampling rules and estimators used by every panel.
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

function validateSize(rows, n) {
  if (!Number.isInteger(n) || n < 1 || n > rows.length) {
    throw new Error('Sample size must be an integer from 1 to N.');
  }
}

export function systematicFromStart(rows, n, start) {
  validateSize(rows, n);
  const interval = rows.length / n;
  const whole = rows.length % n === 0;
  if (whole ? (!Number.isInteger(start) || start < 1 || start > interval)
            : (!Number.isFinite(start) || start <= 0 || start > interval)) {
    throw new Error('Start is outside the systematic interval.');
  }
  const positions = Array.from({ length: n }, (_, j) =>
    Math.min(rows.length, whole ? start + j * interval : Math.ceil(start + j * interval)));
  if (new Set(positions).size !== n) throw new Error('Systematic positions must be distinct.');
  return { sample: positions.map(position => rows[position - 1]), positions, interval, start,
    design: whole ? 'whole-number interval' : 'fractional interval' };
}

export function systematicSample(rows, n, seed) {
  validateSize(rows, n);
  const random = seededRandom(seed);
  const interval = rows.length / n;
  const start = rows.length % n === 0 ? 1 + Math.floor(random() * interval) : (1 - random()) * interval;
  return systematicFromStart(rows, n, start);
}

export function proportionalAllocation(rows, n, column) {
  validateSize(rows, n);
  const groups = new Map();
  for (const row of rows) {
    if (row[column] === undefined || row[column] === null) throw new Error('Missing stratum value.');
    const key = String(row[column]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  if (n < groups.size) throw new Error(`Stratified sampling needs at least ${groups.size} rows: one per stratum.`);
  const allocation = [...groups].sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([group, members]) => {
      const quota = n * members.length / rows.length;
      return { group, members, size: members.length, weight: members.length / rows.length,
        quota, count: Math.min(members.length, Math.max(1, Math.floor(quota))) };
    });
  let total = allocation.reduce((sum, item) => sum + item.count, 0);
  // Constrained largest remainder: honour lower/upper bounds, then give each
  // remaining place to the largest quota deficit; stable alphabetical ties.
  while (total !== n) {
    const adding = total < n;
    const eligible = allocation.filter(item => adding ? item.count < item.size : item.count > 1);
    if (!eligible.length) throw new Error('Cannot satisfy stratum allocation.');
    let chosen = eligible[0];
    for (const item of eligible.slice(1)) {
      const score = adding ? item.quota - item.count : item.count - item.quota;
      const best = adding ? chosen.quota - chosen.count : chosen.count - chosen.quota;
      if (score > best) chosen = item;
    }
    chosen.count += adding ? 1 : -1;
    total += adding ? 1 : -1;
  }
  return allocation;
}

export function weightedStratifiedMean(strata) {
  if (!strata.length) throw new Error('No strata supplied.');
  const weightTotal = strata.reduce((sum, item) => sum + item.weight, 0);
  if (Math.abs(weightTotal - 1) > 1e-10) throw new Error('Population weights must sum to one.');
  return strata.reduce((sum, item) => sum + item.weight * mean(item.sample), 0);
}

export function stratifiedSample(rows, n, seed, column) {
  const strata = proportionalAllocation(rows, n, column).map(({members, ...item}) => ({
    ...item, sample: simpleRandomSample(members, item.count, JSON.stringify([String(seed), column, item.group]))
  }));
  return { sample: strata.flatMap(item => item.sample), strata, estimate: weightedStratifiedMean(strata) };
}

export function methodSamples(rows, n, seed, column = 'activity_state') {
  const trueMean = mean(rows);
  const srs = simpleRandomSample(rows, n, seed);
  const systematic = systematicSample(rows, n, seed);
  let stratified;
  if (n < new Set(rows.map(row => String(row[column]))).size) {
    stratified = { sample: [], estimate: null, unavailable: true };
  } else stratified = stratifiedSample(rows, n, seed, column);
  return {
    trueMean,
    srs: { sample: srs, estimate: mean(srs) },
    systematic: { ...systematic, estimate: mean(systematic.sample) },
    stratified
  };
}

// For future repeated-sampling displays; not run by the stage 3 app.
export function summarizeEstimates(estimates, trueMean) {
  if (!estimates.length || !estimates.every(Number.isFinite) || !Number.isFinite(trueMean)) {
    throw new Error('Finite estimates and a finite true mean are required.');
  }
  const center = estimates.reduce((sum, value) => sum + value, 0) / estimates.length;
  const bias = center - trueMean;
  const sd = Math.sqrt(estimates.reduce((sum, value) => sum + (value - center) ** 2, 0) / estimates.length);
  const rmse = Math.sqrt(estimates.reduce((sum, value) => sum + (value - trueMean) ** 2, 0) / estimates.length);
  return { bias, sd, rmse };
}
