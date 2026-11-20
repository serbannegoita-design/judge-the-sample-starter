import React, { useMemo, useState } from 'react';
import { challengePopulation, mean, runChallenge } from './sampling.js';
import { ExperimentResults } from './Stage4Experiments.jsx';

const number=value=>value.toFixed(3);

export function ChallengeResults({ results }) {
  return <>
    {['stratified','srs'].map(method=>{
      const [baseline,modified]=results.filter(result=>result.method===method);
      return <div className="table-scroll" key={method}>
        <h3>{method==='stratified'?'Stratified sampling':'Simple random sampling'}: baseline and modified</h3>
        <table aria-label={`${method} baseline and modified summary`}>
          <thead><tr><th>Metric or setting</th><th>Baseline</th><th>Modified</th></tr></thead>
          <tbody>
            <tr><th>Condition</th><td>Original activity labels</td><td>All activity labels set to exercise</td></tr>
            <tr><th>True population mean (bpm)</th><td>{number(baseline.trueMean)}</td><td>{number(modified.trueMean)}</td></tr>
            <tr><th>Bias (bpm)</th><td>{number(baseline.bias)}</td><td>{number(modified.bias)}</td></tr>
            <tr><th>SD of estimates (bpm)</th><td>{number(baseline.sd)}</td><td>{number(modified.sd)}</td></tr>
            <tr><th>RMSE (bpm)</th><td>{number(baseline.rmse)}</td><td>{number(modified.rmse)}</td></tr>
            <tr><th>Population size N</th><td>{baseline.N}</td><td>{modified.N}</td></tr>
            <tr><th>Sample size n</th><td>{baseline.n}</td><td>{modified.n}</td></tr>
            <tr><th>Type</th><td>{baseline.type}</td><td>{modified.type}</td></tr>
            <tr><th>Seed</th><td>{baseline.seed}</td><td>{modified.seed}</td></tr>
            <tr><th>Repetitions</th><td>{baseline.count}</td><td>{modified.count}</td></tr>
          </tbody>
        </table>
      </div>;
    })}
    <p className="hint">Each histogram and summary uses only its labelled condition. Bias is measured against that population’s own true mean. All four histograms share axes and bin boundaries; estimates are never pooled.</p>
    <ExperimentResults results={results} letter="challenge" showMetrics={false}/>
  </>;
}

export default function Stage5Challenge({ rows }) {
  const [relabel,setRelabel]=useState(false);
  const [draftN,setDraftN]=useState('100');
  const [seed,setSeed]=useState('stage5-2026');
  const [repetitions,setRepetitions]=useState(100);
  const [record,setRecord]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const modified=useMemo(()=>challengePopulation(rows,relabel),[rows,relabel]);
  const baselineMean=useMemo(()=>mean(rows),[rows]);
  const modifiedMean=useMemo(()=>mean(modified),[modified]);
  const minN=new Set(rows.map(row=>row.activity_state)).size;
  const pending=record && (record.n!==Number(draftN)||record.seed!==seed||record.repetitions!==repetitions);
  const reset=()=>{setRelabel(false);setRecord(null);setError('');};
  const run=event=>{
    event.preventDefault();
    const n=Number(draftN);
    if(!relabel||!Number.isInteger(n)||n<minN||n>Math.min(rows.length,modified.length)||!seed.trim()) {
      setError(`Enable the relabelling condition and choose an integer n from ${minN} to ${Math.min(rows.length,modified.length)}, with a nonblank seed.`);
      return;
    }
    const options={n,seed,repetitions};
    setBusy(true);setError('');
    setTimeout(()=>{
      try {setRecord({...options,results:runChallenge(rows,modified,options)});}
      catch(problem){setError(problem.message);}
      finally{setBusy(false);}
    },0);
  };
  return <section className="experiment" aria-labelledby="challenge-heading">
    <h2 id="challenge-heading">Stage 5: activity-label challenge</h2>
    <p>Chosen method: stratified sampling by <code>activity_state</code>. Alternative: simple random sampling. This control relabels recorded minutes; it does not simulate a change in the wearer’s physiology.</p>
    <p>The original CSV stays unchanged. Modifications apply only to an in-memory copy. Heart-rate values, row membership, and chronological order are retained.</p>
    <div className="challenge-condition">
      <label><input type="checkbox" checked={relabel} disabled={busy} onChange={event=>{setRelabel(event.target.checked);setRecord(null);setError('');}}/> Relabel all recorded minutes as exercise</label>
      <button type="button" disabled={busy} onClick={reset}>Return to baseline</button>
    </div>
    <p role="status">Current preview: <strong>{relabel?'Modified: all activity labels set to exercise':'Baseline: original activity labels'}</strong>. No repeated sampling runs until you select Run challenge.</p>
    <dl className="panel-means">
      <div><dt>Baseline true population mean</dt><dd>{number(baselineMean)} <span>bpm</span></dd></div>
      <div><dt>{relabel?'Modified':'Baseline preview'} true population mean</dt><dd>{number(modifiedMean)} <span>bpm</span></dd></div>
    </dl>
    <form onSubmit={run}>
      <label htmlFor="challenge-n">Challenge sample size n</label><input id="challenge-n" type="number" min={minN} max={Math.min(rows.length,modified.length)} step="1" required disabled={busy} value={draftN} onChange={event=>setDraftN(event.target.value)}/>
      <label htmlFor="challenge-repetitions">Challenge repetitions</label><select id="challenge-repetitions" disabled={busy} value={repetitions} onChange={event=>setRepetitions(Number(event.target.value))}><option value="100">100</option><option value="1000">1,000</option></select>
      <label htmlFor="challenge-seed">Challenge seed</label><input id="challenge-seed" required maxLength="100" disabled={busy} value={seed} onChange={event=>setSeed(event.target.value)}/>
      <button type="submit" disabled={busy||!relabel}>{busy?'Running…':'Run challenge'}</button>
    </form>
    <p className="hint">All four results use the same total n and repetition count. Baseline stratification requires n ≥ {minN} to include at least one row per activity group. Every repetition samples without replacement within that sample. The original sampling rules and population-weighted estimator are used for both populations.</p>
    <p className="hint">100 repetitions usually reveal the main pattern; 1,000 give smoother distributions and more stable summary estimates. Neither guarantees stability. Rerun with different seeds to check your conclusions.</p>
    {error&&<p role="alert">{error}</p>}
    {!record&&<p>Challenge not run. Only the currently displayed results will be kept.</p>}
    {pending&&<p role="status">Settings changed. The results below retain their labelled settings until you run the challenge again.</p>}
    {record&&<ChallengeResults results={record.results}/>}
  </section>;
}
