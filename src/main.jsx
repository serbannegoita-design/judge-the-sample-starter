import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { loadHeartRatePopulation, parseDeviceMinute, recordingGaps, timelineSegments } from './data.js';
import Stage3App from './Stage3App.jsx';
import './style.css';

const start = parseDeviceMinute('2016-04-25 00:00');
const end = parseDeviceMinute('2016-05-02 00:00');

function Timeline({ rows, id, name, sample, trueMean, sampleMean }) {
  const gaps = useMemo(() => recordingGaps(rows, start, end), [rows]);
  const segments = useMemo(() => timelineSegments(rows), [rows]);
  const W = 1120, H = 300;
  const left = 65, right = W - 25, top = 24, bottom = H - 62;
  const low = Math.floor(Math.min(...rows.map(r => r.heart_rate_bpm)) / 20) * 20;
  const high = Math.ceil(Math.max(...rows.map(r => r.heart_rate_bpm)) / 20) * 20;
  const x = time => left + (time - start) / (end - start) * (right - left);
  const y = rate => bottom - (rate - low) / (high - low) * (bottom - top);
  const ticks = Array.from({ length: (high - low) / 20 + 1 }, (_, i) => low + i * 20);
  return <div className="chart-scroll" tabIndex="0" role="region" aria-label="Scrollable heart-rate timeline">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>{name}: heart rate across one recorded week</title>
      <desc id={`${id}-description`}>All recorded minutes are gray. Blue outlined circles show {sample.length} selected rows. Amber bands mark minutes with no reading. Lines stop at recording gaps. Dashed horizontal lines mark the true population mean and this single sample's estimate.</desc>
      <defs><pattern id={`${id}-gap-hatch`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#fff3d9"/><line y2="5" stroke="#d7a44a" strokeWidth="1"/></pattern></defs>
      {ticks.map(t => <g key={t}><line x1={left} x2={right} y1={y(t)} y2={y(t)} stroke="#e5e7eb"/><text x={left - 12} y={y(t) + 4} textAnchor="end">{t}</text></g>)}
      {gaps.map(g => <rect key={g.start} x={x(g.start)} y={top} width={x(g.end) - x(g.start)} height={bottom - top} fill={`url(#${id}-gap-hatch)`}><title>No recording: {new Date(g.start).toISOString().slice(0,16).replace('T',' ')} to {new Date(g.end).toISOString().slice(0,16).replace('T',' ')} (end exclusive)</title></rect>)}
      {segments.map((segment, i) => <polyline key={i} points={segment.map(r => `${x(r.time)},${y(r.heart_rate_bpm)}`).join(' ')} fill="none" stroke="#87929e" strokeOpacity="0.6" strokeWidth="0.8"/>)}
      <g fill="#667481" opacity="0.38">{rows.map(r => <circle key={r.row_id} cx={x(r.time)} cy={y(r.heart_rate_bpm)} r="1"/>)}</g>
      <line x1={left} x2={right} y1={y(trueMean)} y2={y(trueMean)} stroke="#147348" strokeWidth="2" strokeDasharray="8 5"/>
      {sampleMean !== null && <line x1={left} x2={right} y1={y(sampleMean)} y2={y(sampleMean)} stroke="#175cc2" strokeWidth="2" strokeDasharray="2 5"/>}
      {sample.map(r => <circle key={r.row_id} cx={x(r.time)} cy={y(r.heart_rate_bpm)} r="4" fill="white" stroke="#175cc2" strokeWidth="2"><title>Sampled row {r.row_id}: {r.timestamp}; {r.heart_rate_bpm} bpm; {r.activity_state}</title></circle>)}
      <line x1={left} x2={right} y1={bottom} y2={bottom} stroke="#475569"/>
      {Array.from({ length: 7 }, (_, i) => <g key={i}><line x1={x(start + i * 86400000)} x2={x(start + i * 86400000)} y1={bottom} y2={bottom + 6} stroke="#475569"/><text x={x(start + i * 86400000 + 43200000)} y={bottom + 24} textAnchor="middle">{['Mon 25 Apr','Tue 26 Apr','Wed 27 Apr','Thu 28 Apr','Fri 29 Apr','Sat 30 Apr','Sun 1 May'][i]}</text></g>)}
      <text x={(left + right) / 2} y={H - 8} textAnchor="middle">Timestamp · device local time · 2016</text>
      <text transform={`translate(18 ${(top + bottom) / 2}) rotate(-90)`} textAnchor="middle">Heart rate (bpm)</text>
    </svg>
  </div>;
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() { return this.state.error ? <main><h1>Unable to display the data</h1><p role="alert">{this.state.error.message}</p></main> : this.props.children; }
}

function LoadedApp({ rows }) {
  const gaps = useMemo(() => recordingGaps(rows, start, end), [rows]);
  const PopulationTimeline = useMemo(() => function PopulationTimeline(props) {
    return <Timeline {...props} rows={rows}/>;
  }, [rows]);
  return <Stage3App rows={rows} gaps={gaps} Timeline={PopulationTimeline}/>;
}

function App() {
  const [state, setState] = useState({ rows: null, error: null });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    loadHeartRatePopulation(import.meta.env.BASE_URL + 'heart_rate_week.csv', fetch, controller.signal)
      .then(rows => { if (active) setState({ rows, error: null }); })
      .catch(error => { if (active && error.name !== 'AbortError') setState({ rows: null, error }); });
    return () => { active = false; controller.abort(); };
  }, []);
  if (state.error) return <main><h1>Unable to load heart-rate data</h1><p role="alert">{state.error.message}</p><p>Refresh the page to retry.</p></main>;
  if (!state.rows) return <main><h1>Wearable heart rate</h1><p role="status">Loading recorded minutes…</p></main>;
  return <LoadedApp rows={state.rows}/>;
}

createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);
