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

// SD divides by the number of estimates, so RMSE^2 = bias^2 + SD^2.
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

// No experiment runs until a UI Run button calls this function.
// onSample is a verification hook, not a retained sample history.
export function repeatedSampling(rows, { method, n, seed, repetitions = 100,
  stratumColumn = 'activity_state', population = 'Baseline: heart_rate_week.csv' }, onSample) {
  validateSize(rows, n);
  if (!['srs','systematic','stratified'].includes(method)) throw new Error('Unknown sampling method.');
  const exact = method === 'systematic' && rows.length % n === 0;
  if (!exact && (!Number.isInteger(repetitions) || repetitions < 100 || repetitions > 1000)) {
    throw new Error('Monte Carlo repetitions must be an integer from 100 to 1,000.');
  }
  if (!exact && (seed === undefined || !String(seed).trim())) throw new Error('A nonblank seed is required.');
  const allocation = method === 'stratified' ? proportionalAllocation(rows,n,stratumColumn) : null;
  const count = exact ? rows.length / n : repetitions;
  const estimates = [], starts = [];
  for (let index = 0; index < count; index++) {
    const drawSeed = exact ? null : JSON.stringify([String(seed),method,n,
      method === 'stratified' ? stratumColumn : null,index]);
    let sample, estimate, start;
    if (method === 'srs') {
      sample = simpleRandomSample(rows,n,drawSeed);
      estimate = mean(sample);
    } else if (method === 'systematic') {
      const result = exact ? systematicFromStart(rows,n,index+1) : systematicSample(rows,n,drawSeed);
      sample = result.sample;
      start = result.start;
      estimate = mean(sample);
      starts.push(start);
    } else {
      const strata = allocation.map(({ members, ...item }) => ({ ...item,
        sample: simpleRandomSample(members,item.count,JSON.stringify([drawSeed,item.group])) }));
      sample = strata.flatMap(item=>item.sample);
      estimate = weightedStratifiedMean(strata);
    }
    if (onSample) onSample({ sample, estimate, index, start });
    estimates.push(estimate);
  }
  const trueMean = mean(rows);
  return {
    sourceRows: rows, population, N: rows.length, method, n,
    type: exact ? 'exact' : 'Monte Carlo', seed: exact ? null : String(seed),
    count, repetitions: exact ? null : repetitions, starts, estimates, trueMean,
    ...summarizeEstimates(estimates,trueMean),
    settings: method === 'systematic' ? {
      order: 'chronological recorded rows; gaps in clock time', interval: rows.length/n,
      design: exact ? 'whole-number interval' : 'fractional interval'
    } : method === 'stratified' ? {
      stratumColumn, allocation: allocation.map(({members,quota,...item})=>item),
      allocationRule: 'proportional; constrained largest remainder; alphabetical ties'
    } : { selection: 'simple random without replacement' }
  };
}

export function matchingRepeatedResult(result, rows, options) {
  if (!result || result.sourceRows !== rows || result.method !== options.method ||
      result.n !== options.n || result.population !== options.population) return false;
  if (result.method === 'stratified' && result.settings.stratumColumn !== (options.stratumColumn || 'activity_state')) return false;
  return result.type === 'exact' || (result.seed === String(options.seed) &&
    result.repetitions === (options.repetitions ?? 100));
}

export function runExperiment(rows, experiment, options, reusableSrs = null) {
  if (!['A','B'].includes(experiment)) throw new Error('Unknown experiment.');
  const conditions = experiment === 'A'
    ? [{method:'srs',n:100},{method:'systematic',n:100},{method:'stratified',n:100}]
    : [1,10,100].map(n=>({method:'srs',n}));
  return conditions.map(condition => {
    const settings = { ...options, ...condition };
    if (matchingRepeatedResult(reusableSrs,rows,settings)) return reusableSrs;
    return repeatedSampling(rows,settings);
  });
}

// Display bins have common boundaries across panels. Only the axis range is
// shared: estimates and statistical summaries remain separate for each condition.
export function alignedHistograms(results, binCount = 24) {
  if (!results.length || !Number.isInteger(binCount) || binCount < 1) throw new Error('Invalid histogram input.');
  let low=Infinity,high=-Infinity;
  for (const result of results) {
    for (const value of [result.trueMean,...result.estimates]) {
      if (!Number.isFinite(value)) throw new Error('Histogram values must be finite.');
      low=Math.min(low,value); high=Math.max(high,value);
    }
  }
  const padding = high === low ? 1 : (high-low)*0.05;
  low -= padding; high += padding;
  const width=(high-low)/binCount;
  const histograms=results.map(result=>{
    const counts=Array(binCount).fill(0);
    for (const value of result.estimates) counts[Math.max(0,Math.min(binCount-1,Math.floor((value-low)/width)))]++;
    return counts;
  });
  const maxCount=Math.max(1,...histograms.flat());
  return { low,high,width,binCount,histograms,maxCount };
}

export function challengePopulation(rows, relabelAllExercise) {
  return rows.map(row => relabelAllExercise ? {...row,activity_state:'exercise'} : {...row});
}

export function runChallenge(baseline, modified, { n=100, seed, repetitions=100 }, onSample) {
  // Preflight both populations before producing any result. No rule is relaxed.
  proportionalAllocation(baseline,n,'activity_state');
  proportionalAllocation(modified,n,'activity_state');
  const conditions=[
    {rows:baseline,population:'Baseline: original activity labels',method:'stratified'},
    {rows:modified,population:'Modified: all activity labels set to exercise',method:'stratified'},
    {rows:baseline,population:'Baseline: original activity labels',method:'srs'},
    {rows:modified,population:'Modified: all activity labels set to exercise',method:'srs'}
  ];
  return conditions.map(({rows,population,method})=>repeatedSampling(rows,
    {population,method,n,seed,repetitions,stratumColumn:'activity_state'},
    onSample ? draw=>onSample({...draw,method,population}) : undefined));
}
