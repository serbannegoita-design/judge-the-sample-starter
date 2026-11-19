import React, { useMemo, useState } from 'react';
import { methodSamples } from './sampling.js';

const format = value => value.toFixed(3);
const clock = time => new Date(time).toISOString().slice(0,16).replace('T',' ');

function SampleRows({ sample, name }) {
  const sorted = useMemo(() => [...sample].sort((a,b) => a.row_id - b.row_id), [sample]);
  return <details><summary>Inspect {sample.length} sampled rows — {name}</summary>
    <p>Shown in original chronological row order, not selection order.</p>
    <div className="table-scroll"><table><thead><tr><th>Row ID</th><th>Timestamp</th><th>Heart rate (bpm)</th><th>Readings</th><th>Activity state</th></tr></thead>
      <tbody>{sorted.map(r => <tr key={r.row_id}><td>{r.row_id}</td><td>{r.timestamp}</td><td>{r.heart_rate_bpm.toFixed(1)}</td><td>{r.n_readings}</td><td>{r.activity_state}</td></tr>)}</tbody>
    </table></div>
  </details>;
}

function MethodPanel({ id, name, result, n, seed, trueMean, Timeline, children }) {
  return <section className="method-panel" aria-labelledby={`${id}-heading`}>
    <h2 id={`${id}-heading`}>{name}</h2>
    <p className="hint">Baseline population · n = {n} · seed: <strong>{seed}</strong> · single sample</p>
    {children}
    <dl className="panel-means">
      <div><dt><span className="mean-key population"/>True population mean</dt><dd>{format(trueMean)} <span>bpm</span></dd></div>
      <div><dt><span className="mean-key sample"/>{id === 'stratified' ? 'Population-weighted estimate' : 'Single sample mean'}</dt><dd>{result.estimate === null ? 'Unavailable' : <>{format(result.estimate)} <span>bpm</span></>}</dd></div>
    </dl>
    {result.unavailable && <p role="status"><strong>Stratified sampling is unavailable at n = {n}.</strong> The three activity groups require at least one sampled row each. Choose n ≥ 3 to sample all groups. Simple random and systematic sampling remain available.</p>}
    <Timeline id={id} name={name} sample={result.sample} trueMean={trueMean} sampleMean={result.estimate}/>
    {!result.unavailable && <SampleRows sample={result.sample} name={name}/>}
  </section>;
}

export default function Stage3App({ rows, gaps, Timeline }) {
  const [settings, setSettings] = useState({ n: 100, seed: 'stage3-2026' });
  const [draftN, setDraftN] = useState('100');
  const [draftSeed, setDraftSeed] = useState(settings.seed);
  const [error, setError] = useState('');
  const results = useMemo(() => methodSamples(rows, settings.n, settings.seed, 'activity_state'), [rows, settings]);
  const apply = event => {
    event.preventDefault();
    const n = Number(draftN);
    if (!Number.isInteger(n) || n < 1 || n > rows.length || !draftSeed.trim()) {
      setError(`Enter a whole-number sample size from 1 to ${rows.length} and a nonblank seed.`);
      return;
    }
    setError('');
    setSettings({ n, seed: draftSeed });
  };
  const pending = String(settings.n) !== draftN || settings.seed !== draftSeed;
  const shared = { n: settings.n, seed: settings.seed, trueMean: results.trueMean, Timeline };
  const sys = results.systematic;
  return <main>
    <header><p className="eyebrow">Judge the Sample · Stage 3</p><h1>Wearable heart rate</h1>
      <p>Compare how three methods select recorded minutes from one wearer’s week, 25 April–1 May 2016. The finite population is the {rows.length.toLocaleString('en-US')} rows in <code>heart_rate_week.csv</code>.</p>
    </header>
    <section aria-labelledby="settings-heading">
      <h2 id="settings-heading">Shared sampling settings</h2>
      <form onSubmit={apply}>
        <label htmlFor="sample-size">Sample size n</label>
        <input id="sample-size" type="number" min="1" max={rows.length} step="1" required value={draftN} onChange={event => setDraftN(event.target.value)}/>
        <label htmlFor="seed">Seed</label><input id="seed" required maxLength="100" value={draftSeed} onChange={event => setDraftSeed(event.target.value)}/>
        <button type="submit">Apply settings</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <p className="hint">Displayed settings: <strong>n = {settings.n}; seed = {settings.seed}</strong>. {pending ? 'Edits are pending. Select Apply settings to update all three panels.' : 'The same seed and settings reproduce the same selections.'}</p>
      <p>These are <strong>single samples</strong>, not repeated-sampling experiment results. All three timelines share the same timestamp and heart-rate scales.</p>
      <div className="legend" aria-label="Chart legend"><span><i className="dot all"/>All recorded minutes</span><span><i className="dot selected"/>Sampled minute</span><span><i className="gap"/>No recording</span><span><i className="mean-key population"/>True population mean</span><span><i className="mean-key sample"/>Single sample estimate</span></div>
      <p className="hint">Rows are chronological, but missing minutes are absent. Row number is not clock time. The timeline uses actual timestamps, and lines stop at recording gaps. Narrow gaps are listed below. Interval sampling of an unordered list means something different from sampling a chronological record: positions in an unordered list describe file order, while positions here follow recorded time.</p>
    </section>
    <div className="aligned-timelines">
      <MethodPanel id="srs" name="Simple random sampling" result={results.srs} {...shared}>
        <p>Select n distinct rows at random without replacement. Every set of n rows has the same chance of selection. Estimate: the sample mean.</p>
      </MethodPanel>
      <MethodPanel id="systematic" name="Systematic sampling" result={sys} {...shared}>
        <p>Select rows at an interval after a random start, using the file’s chronological row order. Estimate: the sample mean.</p>
        <p className="rule"><strong>{sys.design === 'whole-number interval' ? 'Whole-number interval design' : 'Fractional-interval design'}</strong>: k = N/n = {Number.isInteger(sys.interval) ? sys.interval : sys.interval.toPrecision(9)} rows; random start {sys.design === 'whole-number interval' ? 'r' : 'u'} = {Number.isInteger(sys.start) ? sys.start : sys.start.toPrecision(9)}.</p>
        <p className="hint">{sys.design === 'whole-number interval'
          ? 'Start r is an integer chosen uniformly from 1 to k. Selected positions: r + j × k, for j = 0, …, n − 1.'
          : 'Start u is chosen uniformly in (0, k]. Selected positions: ceil(u + j × k), for j = 0, …, n − 1. Displayed interval and start are rounded; selection uses full precision.'} The interval is measured in recorded rows, not elapsed minutes.</p>
      </MethodPanel>
      <MethodPanel id="stratified" name="Stratified sampling by activity state" result={results.stratified} {...shared}>
        <p>Group rows by <code>activity_state</code>, then use simple random sampling without replacement within each group.</p>
        <p className="hint">Proportional allocation uses largest-remainder rounding with at least one row per group and no more than the group contains. Counts sum to n; ties use alphabetical group order. The estimate is Σ (Nₕ/N) × group sample mean, rather than the unweighted mean of all sampled rows.</p>
        {!results.stratified.unavailable && <div className="table-scroll"><table aria-label="Activity state allocation"><thead><tr><th>Activity state</th><th>Population Nₕ</th><th>Population weight Nₕ/N</th><th>Sample nₕ</th></tr></thead><tbody>{results.stratified.strata.map(item => <tr key={item.group}><td>{item.group}</td><td>{item.size.toLocaleString('en-US')}</td><td>{(100 * item.weight).toFixed(3)}%</td><td>{item.count}</td></tr>)}</tbody><tfoot><tr><th>Total</th><td>{rows.length.toLocaleString('en-US')}</td><td>100%</td><td>{settings.n}</td></tr></tfoot></table><p className="hint">Weights shown rounded; the estimate uses their full precision.</p></div>}
      </MethodPanel>
    </div>
    <details><summary>Recording gaps — exact times</summary>
      <p>Start is inclusive and end is exclusive. All times are device local time.</p>
      <div className="table-scroll"><table><thead><tr><th>Start</th><th>End</th><th>Minutes without a reading</th></tr></thead><tbody>{gaps.map(g => <tr key={g.start}><td>{clock(g.start)}</td><td>{clock(g.end)}</td><td>{(g.end-g.start)/60000}</td></tr>)}</tbody></table></div>
    </details>
    <footer><p>Activity labels are device-derived estimates. Missing minutes are not zero heart rate. These data describe one wearer’s recorded week, not other people or unrecorded minutes.</p><p>Source: Furberg R, Brinton J, Keating M, Ortiz A. Crowd-sourced Fitbit datasets. Zenodo, 2016. <a href="https://doi.org/10.5281/zenodo.53894">doi:10.5281/zenodo.53894</a> · CC BY 4.0. See <code>data/README.md</code> for extraction details.</p></footer>
  </main>;
}
