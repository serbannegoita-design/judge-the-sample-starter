import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import csv from '../data/heart_rate_week.csv?raw';
import { parseHeartRateCsv, parseDeviceMinute, recordingGaps, timelineSegments } from './data.js';
import { singleSampleSummary } from './sampling.js';
import './style.css';

const rows = parseHeartRateCsv(csv);
const start = parseDeviceMinute('2016-04-25 00:00');
const end = parseDeviceMinute('2016-05-02 00:00');
const gaps = recordingGaps(rows, start, end);
const segments = timelineSegments(rows);
const format = value => value.toFixed(3);

function Timeline({ sample, trueMean, sampleMean }) {
  const W = 1120, H = 420;
  const left = 65, right = W - 25, top = 24, bottom = H - 62;
  const low = Math.floor(Math.min(...rows.map(r => r.heart_rate_bpm)) / 20) * 20;
  const high = Math.ceil(Math.max(...rows.map(r => r.heart_rate_bpm)) / 20) * 20;
  const x = time => left + (time - start) / (end - start) * (right - left);
  const y = rate => bottom - (rate - low) / (high - low) * (bottom - top);
  const ticks = Array.from({ length: (high - low) / 20 + 1 }, (_, i) => low + i * 20);
  return <div className="chart-scroll" tabIndex="0" role="region" aria-label="Scrollable heart-rate timeline">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="chart-title chart-description">
      <title id="chart-title">Heart rate across one recorded week</title>
      <desc id="chart-description">All recorded minutes are gray. Blue outlined circles show the temporary sample of 100 distinct rows. Amber bands mark minutes with no reading. Lines stop at recording gaps. Dashed horizontal lines mark the true population mean and this single sample's mean.</desc>
      <defs><pattern id="gap-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#fff3d9"/><line y2="5" stroke="#d7a44a" strokeWidth="1"/></pattern></defs>
      {ticks.map(t => <g key={t}><line x1={left} x2={right} y1={y(t)} y2={y(t)} stroke="#e5e7eb"/><text x={left - 12} y={y(t) + 4} textAnchor="end">{t}</text></g>)}
      {gaps.map(g => <rect key={g.start} x={x(g.start)} y={top} width={x(g.end) - x(g.start)} height={bottom - top} fill="url(#gap-hatch)"><title>No recording: {new Date(g.start).toISOString().slice(0,16).replace('T',' ')} to {new Date(g.end).toISOString().slice(0,16).replace('T',' ')} (end exclusive)</title></rect>)}
      {segments.map((segment, i) => <polyline key={i} points={segment.map(r => `${x(r.time)},${y(r.heart_rate_bpm)}`).join(' ')} fill="none" stroke="#87929e" strokeOpacity="0.6" strokeWidth="0.8"/>)}
      <g fill="#667481" opacity="0.38">{rows.map(r => <circle key={r.row_id} cx={x(r.time)} cy={y(r.heart_rate_bpm)} r="1"/>)}</g>
      <line x1={left} x2={right} y1={y(trueMean)} y2={y(trueMean)} stroke="#147348" strokeWidth="2" strokeDasharray="8 5"/>
      <line x1={left} x2={right} y1={y(sampleMean)} y2={y(sampleMean)} stroke="#175cc2" strokeWidth="2" strokeDasharray="2 5"/>
      {sample.map(r => <circle key={r.row_id} cx={x(r.time)} cy={y(r.heart_rate_bpm)} r="4" fill="white" stroke="#175cc2" strokeWidth="2"><title>Sampled row {r.row_id}: {r.timestamp}; {r.heart_rate_bpm} bpm; {r.activity_state}</title></circle>)}
      <line x1={left} x2={right} y1={bottom} y2={bottom} stroke="#475569"/>
      {Array.from({ length: 7 }, (_, i) => <g key={i}><line x1={x(start + i * 86400000)} x2={x(start + i * 86400000)} y1={bottom} y2={bottom + 6} stroke="#475569"/><text x={x(start + i * 86400000 + 43200000)} y={bottom + 24} textAnchor="middle">{['Mon 25 Apr','Tue 26 Apr','Wed 27 Apr','Thu 28 Apr','Fri 29 Apr','Sat 30 Apr','Sun 1 May'][i]}</text></g>)}
      <text x={(left + right) / 2} y={H - 8} textAnchor="middle">Timestamp · device local time · 2016</text>
      <text transform={`translate(18 ${(top + bottom) / 2}) rotate(-90)`} textAnchor="middle">Heart rate (bpm)</text>
    </svg>
  </div>;
}

function App() {
  const [seed, setSeed] = useState('stage2-2026');
  const [draft, setDraft] = useState(seed);
  const summary = useMemo(() => singleSampleSummary(rows, 100, seed), [seed]);
  const sortedSample = useMemo(() => [...summary.sample].sort((a,b) => a.row_id - b.row_id), [summary]);
  return <main>
    <header><p className="eyebrow">Judge the Sample · Stage 2</p><h1>Wearable heart rate</h1>
      <p>One wearer’s recorded minutes, 25 April–1 May 2016. This finite population includes only the rows in <code>heart_rate_week.csv</code>.</p></header>
    <section aria-labelledby="sample-heading">
      <h2 id="sample-heading">Baseline population and temporary sample</h2>
      <p><strong>Temporary simple random sample · n = 100 · single sample.</strong> Each recorded row has the same chance of selection, with no row selected twice. This display is for checking the stage 2 design.</p>
      <form onSubmit={event => { event.preventDefault(); if (draft.trim()) setSeed(draft); }}>
        <label htmlFor="seed">Sample seed</label><input id="seed" value={draft} required maxLength="100" onChange={event => setDraft(event.target.value)} />
        <button type="submit">Apply seed</button>
      </form>
      <p className="hint">Current seed: <strong>{seed}</strong>. The same seed and settings reproduce the same sample. Editing the field takes effect when you select Apply seed.</p>
      <dl className="metrics">
        <div><dt>Recorded minutes · N</dt><dd>{rows.length.toLocaleString('en-US')}</dd></div>
        <div><dt>Sampled rows · n</dt><dd>100</dd></div>
        <div><dt><span className="mean-key population"/>True population mean</dt><dd>{format(summary.trueMean)} <span>bpm</span></dd></div>
        <div><dt><span className="mean-key sample"/>Single sample mean</dt><dd>{format(summary.sampleMean)} <span>bpm</span></dd></div>
      </dl>
      <div className="legend" aria-label="Chart legend"><span><i className="dot all"/>All recorded minutes</span><span><i className="dot selected"/>Sampled minute</span><span><i className="gap"/>No recording</span></div>
      <Timeline {...summary}/>
      <p className="hint">The horizontal axis uses actual timestamps. Missing minutes occupy their elapsed time, and lines never bridge a recording gap. Narrow gaps may be hard to see at week scale; the list below gives their exact times.</p>
    </section>
    <details><summary>Recording gaps · exact times</summary>
      <p>These intervals have no reading. Start is inclusive; end is exclusive. All times are device local time.</p>
      <div className="table-scroll"><table><thead><tr><th>Start</th><th>End</th><th>Minutes without a reading</th></tr></thead><tbody>{gaps.map(g => <tr key={g.start}><td>{new Date(g.start).toISOString().slice(0,16).replace('T',' ')}</td><td>{new Date(g.end).toISOString().slice(0,16).replace('T',' ')}</td><td>{(g.end - g.start)/60000}</td></tr>)}</tbody></table></div>
    </details>
    <details><summary>Inspect the 100 sampled rows</summary><p>Shown in original chronological row order, not selection order.</p>
      <div className="table-scroll"><table><thead><tr><th>Row ID</th><th>Timestamp</th><th>Heart rate (bpm)</th><th>Readings</th><th>Activity state</th></tr></thead><tbody>{sortedSample.map(r => <tr key={r.row_id}><td>{r.row_id}</td><td>{r.timestamp}</td><td>{r.heart_rate_bpm.toFixed(1)}</td><td>{r.n_readings}</td><td>{r.activity_state}</td></tr>)}</tbody></table></div>
    </details>
    <footer><p>Activity labels are device-derived estimates. Missing minutes are not represented as zero heart rate. These data describe one wearer’s recorded week, not other people or unrecorded minutes.</p>
      <p>Source: Furberg R, Brinton J, Keating M, Ortiz A. Crowd-sourced Fitbit datasets. Zenodo, 2016. <a href="https://doi.org/10.5281/zenodo.53894">doi:10.5281/zenodo.53894</a> · CC BY 4.0. See <code>data/README.md</code> for extraction details.</p></footer>
  </main>;
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() { return this.state.error ? <main><h1>Unable to display the data</h1><p role="alert">{this.state.error.message}</p></main> : this.props.children; }
}

createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);
