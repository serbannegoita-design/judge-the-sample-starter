import test from 'node:test';
import assert from 'node:assert/strict';
import { repeatedSampling,runExperiment,matchingRepeatedResult,alignedHistograms,summarizeEstimates } from '../src/sampling.js';
const rows=Array.from({length:120},(_,i)=>({row_id:i,heart_rate_bpm:i+1,activity_state:String(i%3)}));
const options={seed:'synthetic-check',repetitions:100,population:'Synthetic verification only'};
test('all three repeated samplers reproduce numbers and select n distinct rows per repetition',()=>{
  for(const method of ['srs','systematic','stratified']) {
    let count=0;
    const settings={...options,method,n:7};
    const result=repeatedSampling(rows,settings,({sample})=>{
      assert.equal(sample.length,7);assert.equal(new Set(sample).size,7);count++;
    });
    assert.equal(count,100);assert.equal(result.estimates.length,100);
    assert.deepEqual(result,repeatedSampling(rows,settings));
    assert.ok(Math.abs(result.rmse**2-result.bias**2-result.sd**2)<1e-10);
  }
});
test('repetition setting controls estimate count independently from sample size',()=>{
  for(const n of [1,10,100]) {
    const result=repeatedSampling(rows,{...options,method:'srs',n,repetitions:1000});
    assert.equal(result.n,n);assert.equal(result.estimates.length,1000);
  }
  assert.throws(()=>repeatedSampling(rows,{...options,method:'srs',n:10,repetitions:99}));
});
test('exact enumeration visits each start once and matches a hand-calculated answer',()=>{
  const tiny=Array.from({length:6},(_,i)=>({heart_rate_bpm:i+1}));
  const starts=[];
  const result=repeatedSampling(tiny,{method:'systematic',n:2},draw=>starts.push(draw.start));
  assert.deepEqual(starts,[1,2,3]);assert.deepEqual(result.starts,[1,2,3]);
  assert.deepEqual(result.estimates,[2.5,3.5,4.5]);assert.equal(result.seed,null);
  assert.equal(result.type,'exact');assert.equal(result.count,3);assert.equal(result.bias,0);
  assert.ok(Math.abs(result.sd-Math.sqrt(2/3))<1e-12);
  assert.ok(Math.abs(result.rmse-Math.sqrt(2/3))<1e-12);
});
test('nonzero bias SD and RMSE match hand calculations',()=>{
  const result=summarizeEstimates([2,4,6],3);
  assert.equal(result.bias,1);assert.ok(Math.abs(result.sd-Math.sqrt(8/3))<1e-12);
  assert.ok(Math.abs(result.rmse-Math.sqrt(11/3))<1e-12);
  assert.ok(Math.abs(result.rmse**2-result.bias**2-result.sd**2)<1e-12);
});
test('Experiments A and B reuse matching SRS n100 without pooling settings',()=>{
  const A=runExperiment(rows,'A',options),B=runExperiment(rows,'B',options,A[0]);
  assert.strictEqual(B[2],A[0]);assert.deepEqual(B.map(r=>r.n),[1,10,100]);
  for(const changed of [{seed:'other'},{repetitions:1000},{population:'Other'},{n:10}])
    assert.equal(matchingRepeatedResult(A[0],rows,{...options,method:'srs',n:100,...changed}),false);
  assert.equal(matchingRepeatedResult(A[0],[...rows],{...options,method:'srs',n:100}),false);
});
test('histogram bins share boundaries but keep each condition count intact',()=>{
  const results=[{trueMean:3,estimates:[1,2,3]},{trueMean:3,estimates:[4,5,6]}];
  const before=structuredClone(results),display=alignedHistograms(results);
  assert.deepEqual(display.histograms.map(counts=>counts.reduce((a,b)=>a+b,0)),[3,3]);
  assert.deepEqual(results,before);assert.ok(display.low<1&&display.high>6);
});
