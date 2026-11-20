import React, { useMemo, useState } from 'react';
import { alignedHistograms, mean, runExperiment } from './sampling.js';

const methodNames = { srs:'Simple random', systematic:'Systematic', stratified:'Stratified' };
const number = value => value.toFixed(3);

export function Histogram({ result, bins, counts, id }) {
  const W=1120,H=245,left=66,right=W-24,top=42,bottom=H-55;
  const x=value=>left+(value-bins.low)/(bins.high-bins.low)*(right-left);
  const y=count=>bottom-count/bins.maxCount*(bottom-top);
  const yTicks=[0,Math.ceil(bins.maxCount/2),bins.maxCount].filter((v,i,a)=>a.indexOf(v)===i);
  return <div className="chart-scroll" role="region" tabIndex="0" aria-label={`${methodNames[result.method]} n ${result.n} histogram`}>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>{methodNames[result.method]}, n = {result.n}: distribution of estimates</title>
      <desc id={`${id}-description`}>Each estimate comes from one complete sample of n observations. Bars count estimates in each interval. The dashed green line marks the true population mean. Axes and bin boundaries are shared within this experiment.</desc>
      {yTicks.map(tick=><g key={tick}><line x1={left} x2={right} y1={y(tick)} y2={y(tick)} stroke="#e5e7eb"/><text x={left-10} y={y(tick)+4} textAnchor="end">{tick}</text></g>)}
      {counts.map((count,index)=><rect key={index} x={x(bins.low+index*bins.width)+0.5} y={y(count)} width={Math.max(0,(right-left)/bins.binCount-1)} height={bottom-y(count)} fill="#175cc2" fillOpacity="0.72"><title>{number(bins.low+index*bins.width)} to {number(bins.low+(index+1)*bins.width)} bpm: {count} estimates</title></rect>)}
      <line x1={x(result.trueMean)} x2={x(result.trueMean)} y1={top-6} y2={bottom} stroke="#147348" strokeWidth="2" strokeDasharray="8 5"/>
      <text x={(left+right)/2} y="22" textAnchor="middle">True population mean = {number(result.trueMean)} bpm (green dashed line)</text>
      <line x1={left} x2={right} y1={bottom} y2={bottom} stroke="#475569"/>
      {Array.from({length:5},(_,i)=>bins.low+(bins.high-bins.low)*i/4).map((tick,i)=><text key={i} x={x(tick)} y={bottom+21} textAnchor="middle">{tick.toFixed(2)}</text>)}
      <text x={(left+right)/2} y={H-7} textAnchor="middle">Sample estimate (bpm)</text>
      <text transform={`translate(18 ${(top+bottom)/2}) rotate(-90)`} textAnchor="middle">Number of estimates</text>
    </svg>
  </div>;
}

export function ExperimentResults({ results, letter, showMetrics = true }) {
  const bins=useMemo(()=>alignedHistograms(results),[results]);
  return <div className="aligned-timelines">
    {results.map((result,index)=><section className="method-panel" key={`${result.population}-${result.method}-${result.n}`} aria-labelledby={`experiment-${letter}-${index}-heading`}>
      <h3 id={`experiment-${letter}-${index}-heading`}>{methodNames[result.method]} sampling · n = {result.n}</h3>
      <p><strong>{result.type}</strong> · {result.population} · N = {result.N.toLocaleString('en-US')} · n = {result.n} per sample · {result.count} {result.type==='exact'?'starts (all possible starts)':'repetitions'}{result.type==='Monte Carlo' && <> · seed: <strong>{result.seed}</strong></>}</p>
      {result.method==='srs' && <p className="hint">Setting: simple random sampling without replacement. Each estimate is a sample mean.</p>}
      {result.method==='systematic' && <p className="hint">Settings: {result.settings.design}; k = N/n = {result.settings.interval.toPrecision(9)} recorded rows; {result.settings.order}. {result.type==='exact'?'Every integer start from 1 to k is enumerated once; no seed is used.':'Each repetition draws a new seeded random start u in (0, k]; selected positions are ceil(u + j × k).'} Each estimate is a sample mean.</p>}
      {result.method==='stratified' && <>
        <p className="hint">Settings: group by <code>{result.settings.stratumColumn}</code>; proportional allocation with constrained largest-remainder rounding, at least one per group, no more than its size; alphabetical ties. Each estimate is population-weighted.</p>
        <div className="table-scroll"><table aria-label={`Experiment ${letter} stratum allocation`}><thead><tr><th>Group</th><th>Population size</th><th>Population weight</th><th>Sample allocation</th></tr></thead><tbody>{result.settings.allocation.map(item=><tr key={item.group}><td>{item.group}</td><td>{item.size}</td><td>{(item.weight*100).toFixed(3)}%</td><td>{item.count}</td></tr>)}</tbody><tfoot><tr><th>Total</th><td>{result.N}</td><td>100%</td><td>{result.n}</td></tr></tfoot></table></div>
        <p className="hint">Weights displayed rounded; estimation uses full precision.</p>
      </>}
      {showMetrics && <dl className="metrics">
        <div><dt>True population mean</dt><dd>{number(result.trueMean)} <span>bpm</span></dd></div>
        <div><dt>Bias</dt><dd>{number(result.bias)} <span>bpm</span></dd></div>
        <div><dt>SD of estimates</dt><dd>{number(result.sd)} <span>bpm</span></dd></div>
        <div><dt>RMSE</dt><dd>{number(result.rmse)} <span>bpm</span></dd></div>
      </dl>}
      <Histogram result={result} bins={bins} counts={bins.histograms[index]} id={`hist-${letter}-${index}`}/>
    </section>)}
  </div>;
}

function Experiment({ letter, record, otherRecord, busy, onRun, trueMean }) {
  const [seed,setSeed]=useState('stage4-2026');
  const [repetitions,setRepetitions]=useState(100);
  const pending=record && (record.seed!==seed || record.repetitions!==repetitions);
  const shared=record && otherRecord && record.results.find(r=>r.method==='srs'&&r.n===100) === otherRecord.results.find(r=>r.method==='srs'&&r.n===100);
  return <section className="experiment" aria-labelledby={`experiment-${letter}-heading`}>
    <h2 id={`experiment-${letter}-heading`}>Experiment {letter}: {letter==='A'?'methods at n = 100':'simple random sampling at n = 1, 10 and 100'}</h2>
    <p>{letter==='A'?'Compare simple random, systematic and activity-state stratified sampling on the same baseline population.':'Keep the baseline population and method fixed; only the number of observations in each sample changes.'}</p>
    <p><strong>True baseline population mean: {number(trueMean)} bpm.</strong> This reference describes only the recorded rows in this file.</p>
    <form onSubmit={event=>{event.preventDefault();if(seed.trim())onRun(letter,{seed,repetitions});}}>
      <label htmlFor={`repetitions-${letter}`}>Monte Carlo repetitions</label>
      <select id={`repetitions-${letter}`} value={repetitions} disabled={Boolean(busy)} onChange={event=>setRepetitions(Number(event.target.value))}><option value="100">100</option><option value="1000">1,000</option></select>
      <label htmlFor={`experiment-seed-${letter}`}>Experiment {letter} seed</label>
      <input id={`experiment-seed-${letter}`} value={seed} required maxLength="100" disabled={Boolean(busy)} onChange={event=>setSeed(event.target.value)}/>
      <button type="submit" disabled={Boolean(busy)}>{busy===letter?'Running…':`Run experiment ${letter}`}</button>
    </form>
    <p className="hint">Sample size n is {letter==='A'?'fixed at 100 for every method':'fixed at 1, 10 and 100 for the three conditions'}; repetition count is a separate setting. Each repetition draws one sample of n distinct recorded rows and calculates one estimate. A row may appear in different repetitions.</p>
    {!record && <p role="status">Not run. Select Run experiment {letter} when you are ready.</p>}
    {pending && <p role="status"><strong>Settings changed.</strong> The results below retain their labelled settings. Run experiment {letter} to replace them.</p>}
    {shared && <p className="hint">The SRS n = 100 result is shared with Experiment {letter==='A'?'B':'A'}: population, seed, repetitions and method settings match. It is one result, not pooled estimates.</p>}
    {record && <ExperimentResults results={record.results} letter={letter}/>}
  </section>;
}

export default function Stage4Experiments({ rows }) {
  const [records,setRecords]=useState({A:null,B:null});
  const [busy,setBusy]=useState(null);
  const [error,setError]=useState('');
  const trueMean=useMemo(()=>mean(rows),[rows]);
  const onRun=(letter,options)=>{
    setBusy(letter); setError('');
    // Yield once so the pending state can paint before calculation.
    setTimeout(()=>{
      try {
        const other=records[letter==='A'?'B':'A'];
        const reusable=other?.results.find(result=>result.method==='srs'&&result.n===100);
        const results=runExperiment(rows,letter,{...options,stratumColumn:'activity_state',population:'Baseline: heart_rate_week.csv'},reusable);
        setRecords(current=>({...current,[letter]:{...options,results}}));
      } catch(problem) { setError(problem.message); }
      finally { setBusy(null); }
    },0);
  };
  return <div className="stage4">
    <h2>Stage 4: distributions across repeated samples</h2>
    <p>The timelines above show single samples. The histograms below show distributions of estimates across repeated samples or exact systematic starts. Experiments run only when you select their Run buttons; rerunning replaces the current result.</p>
    <p>100 repetitions usually reveal the main pattern; 1,000 give smoother distributions and more stable bias, SD and RMSE estimates. Neither guarantees stability, and 100 repetitions cannot reliably separate small differences between methods. Rerun with different seeds to check your conclusions.</p>
    <p className="hint">Bias = average estimate minus true mean; SD = spread around the average estimate (dividing by the number of estimates); RMSE = square root of the average squared error from the true mean. All are in bpm. Monte Carlo bias can reflect simulation noise; a nonzero value alone does not establish consistent error. Bin boundaries and both axes match within each experiment. Labels identify every current condition separately.</p>
    {error && <p role="alert">{error}</p>}
    <Experiment letter="A" record={records.A} otherRecord={records.B} busy={busy} onRun={onRun} trueMean={trueMean}/>
    <Experiment letter="B" record={records.B} otherRecord={records.A} busy={busy} onRun={onRun} trueMean={trueMean}/>
  </div>;
}
