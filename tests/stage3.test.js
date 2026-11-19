import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mean, systematicSample, systematicFromStart, proportionalAllocation,
  stratifiedSample, weightedStratifiedMean, methodSamples, summarizeEstimates,
  simpleRandomSample } from '../src/sampling.js';
import { parseHeartRateCsv } from '../src/data.js';

function population(sizes) {
  return sizes.flatMap((size, group) => Array.from({length:size}, (_, i) =>
    ({ row_id:`${group}-${i}`, activity_state:String(group), heart_rate_bpm:10+group*90 })));
}
test('systematic sampling supports every n for whole and fractional intervals', () => {
  for (let N=1; N<=40; N++) {
    const rows=population([N]);
    for (let n=1;n<=N;n++) {
      for (const seed of ['a','b','c']) {
        const result=systematicSample(rows,n,seed);
        assert.equal(result.sample.length,n);
        assert.equal(new Set(result.positions).size,n);
        assert.ok(result.positions.every(p=>Number.isInteger(p)&&p>=1&&p<=N));
        assert.deepEqual(result,systematicSample(rows,n,seed));
        assert.deepEqual(result.positions,Array.from({length:n},(_,j)=>
          Math.min(N,N%n===0 ? result.start+j*N/n : Math.ceil(result.start+j*N/n))));
      }
      assert.equal(systematicFromStart(rows,n,N/n).positions.at(-1),N);
    }
  }
});
test('whole-number systematic starts enumerate every row once on a synthetic population', () => {
  const rows=Array.from({length:12},(_,i)=>({row_id:i+1,heart_rate_bpm:i+1}));
  const results=[1,2,3,4].map(start=>systematicFromStart(rows,3,start));
  assert.deepEqual(results[1].positions,[2,6,10]);
  assert.deepEqual(results.flatMap(r=>r.positions).sort((a,b)=>a-b),rows.map(r=>r.row_id));
  assert.equal(results.reduce((sum,r)=>sum+mean(r.sample),0)/4,mean(rows));
});
test('fractional design gives equal inclusion probability over start intervals', () => {
  const N=7,n=3,k=N/n,rows=population([N]);
  const cuts=[0,k];
  for(let j=0;j<n;j++) for(let p=1;p<=N;p++) {
    const boundary=p-j*k;
    if(boundary>0&&boundary<k) cuts.push(boundary);
  }
  const sorted=[...new Set(cuts)].sort((a,b)=>a-b), probabilities=Array(N).fill(0);
  for(let i=1;i<sorted.length;i++) {
    const a=sorted[i-1],b=sorted[i];
    for(const position of systematicFromStart(rows,n,(a+b)/2).positions)
      probabilities[position-1]+=(b-a)/k;
  }
  probabilities.forEach(p=>assert.ok(Math.abs(p-n/N)<1e-12));
});
test('constrained largest remainder honours bounds and exact totals at every n', () => {
  for(const sizes of [[1,1,30],[2,3,5],[1,2,1,20],[6,6,6]]) {
    const rows=population(sizes),snapshot=structuredClone(rows);
    for(let n=sizes.length;n<=rows.length;n++) {
      const allocation=proportionalAllocation(rows,n,'activity_state');
      assert.equal(allocation.reduce((sum,item)=>sum+item.count,0),n);
      assert.ok(allocation.every(item=>Number.isInteger(item.count)&&item.count>=1&&item.count<=item.size));
      assert.ok(Math.abs(allocation.reduce((sum,item)=>sum+item.weight,0)-1)<1e-12);
    }
    assert.deepEqual(rows,snapshot);
    assert.throws(()=>proportionalAllocation(rows,sizes.length-1,'activity_state'));
  }
  assert.deepEqual(proportionalAllocation(population([5,3,2]),6,'activity_state').map(x=>x.count),[3,2,1]);
});
test('stratified estimate uses population weights when sample allocation is not proportional', () => {
  const rows=population([1,9]);
  const result=stratifiedSample(rows,2,'weighted','activity_state');
  assert.equal(result.estimate,91);
  assert.equal(mean(result.sample),55);
  assert.equal(weightedStratifiedMean(result.strata),91);
  assert.deepEqual(result,stratifiedSample(rows,2,'weighted','activity_state'));
  assert.equal(new Set(result.sample.map(r=>r.row_id)).size,2);
  assert.equal(stratifiedSample(rows,rows.length,'full','activity_state').estimate,mean(rows));
});
test('n below number of groups disables only stratified panel', () => {
  const rows=population([3,4,5]);
  for(const n of [1,2]) {
    const result=methodSamples(rows,n,'small');
    assert.equal(result.srs.sample.length,n);
    assert.equal(result.systematic.sample.length,n);
    assert.equal(result.stratified.unavailable,true);
    assert.equal(result.stratified.estimate,null);
    assert.deepEqual(result.stratified.sample,[]);
  }
});
test('known-answer summary obeys RMSE squared equals bias squared plus SD squared', () => {
  const summary=summarizeEstimates([1,3,5],2);
  assert.equal(summary.bias,1);
  assert.ok(Math.abs(summary.sd-Math.sqrt(8/3))<1e-12);
  assert.ok(Math.abs(summary.rmse**2-summary.bias**2-summary.sd**2)<1e-12);
});
test('real CSV sample invariants for all three methods without reporting investigation results', () => {
  const rows=parseHeartRateCsv(readFileSync(new URL('../data/heart_rate_week.csv',import.meta.url),'utf8'));
  assert.notEqual(rows.length % 101,0);
  for(const n of [1,2,3,10,100,101,rows.length]) {
    const results=[{sample:simpleRandomSample(rows,n,'verify')},systematicSample(rows,n,'verify')];
    if(n>=3) results.push(stratifiedSample(rows,n,'verify','activity_state'));
    for(const result of results) {
      assert.equal(result.sample.length,n);
      assert.equal(new Set(result.sample.map(r=>r.row_id)).size,n);
      assert.ok(result.sample.every(r=>rows.includes(r)));
    }
    assert.deepEqual(simpleRandomSample(rows,n,'verify'),simpleRandomSample(rows,n,'verify'));
    assert.deepEqual(systematicSample(rows,n,'verify'),systematicSample(rows,n,'verify'));
    if(n>=3) {
      const stratified=stratifiedSample(rows,n,'verify','activity_state');
      assert.deepEqual(stratified,stratifiedSample(rows,n,'verify','activity_state'));
      assert.equal(stratified.strata.reduce((sum,item)=>sum+item.count,0),n);
      assert.ok(stratified.strata.every(item=>Number.isInteger(item.count)&&item.count>=1&&item.count<=item.size));
      assert.ok(Math.abs(stratified.strata.reduce((sum,item)=>sum+item.weight,0)-1)<1e-12);
    }
  }
});
