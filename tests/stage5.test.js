import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { challengePopulation,runChallenge,mean,repeatedSampling } from '../src/sampling.js';
import { parseHeartRateCsv } from '../src/data.js';
const tiny=Array.from({length:12},(_,i)=>Object.freeze({row_id:i+1,heart_rate_bpm:10+i,activity_state:String(i%3)}));

test('modified population is an independent copy; reset restores original labels',()=>{
  const before=structuredClone(tiny),modified=challengePopulation(tiny,true);
  assert.ok(modified.every((row,i)=>row!==tiny[i]&&row.activity_state==='exercise'));
  assert.deepEqual(modified.map(r=>r.heart_rate_bpm),tiny.map(r=>r.heart_rate_bpm));
  assert.deepEqual(modified.map(r=>r.row_id),tiny.map(r=>r.row_id));
  assert.deepEqual(tiny,before);assert.deepEqual(challengePopulation(tiny,false),tiny);
});
test('modified true mean uses its own rows and reordering alone preserves it',()=>{
  const modified=challengePopulation(tiny,true);
  modified[0].heart_rate_bpm=100;
  const subset=modified.slice(0,8);
  const result=repeatedSampling(subset,{method:'srs',n:3,seed:'truth'});
  assert.equal(result.trueMean,subset.reduce((sum,row)=>sum+row.heart_rate_bpm,0)/subset.length);
  assert.equal(mean([...subset].reverse()),result.trueMean);
  assert.equal(result.bias,result.estimates.reduce((a,b)=>a+b,0)/result.count-result.trueMean);
  assert.equal(tiny[0].heart_rate_bpm,10);
});
test('systematic design is rechecked against modified N',()=>{
  const baseline=repeatedSampling(tiny,{method:'systematic',n:3,seed:'design'});
  const modified=repeatedSampling(tiny.slice(1),{method:'systematic',n:3,seed:'design'});
  assert.equal(baseline.type,'exact');assert.equal(baseline.settings.interval,4);
  assert.equal(modified.type,'Monte Carlo');assert.equal(modified.settings.design,'fractional interval');
  assert.equal(modified.settings.interval,11/3);assert.equal(modified.count,100);
});
test('all four challenge results use the same n and reproduce seeded numbers',()=>{
  const modified=challengePopulation(tiny,true),options={n:5,repetitions:100,seed:'challenge-test'};
  let draws=0;
  const result=runChallenge(tiny,modified,options,({sample})=>{
    assert.equal(sample.length,5);assert.equal(new Set(sample).size,5);draws++;
  });
  assert.equal(draws,400);assert.equal(result.length,4);
  assert.deepEqual(result.map(r=>r.n),[5,5,5,5]);
  assert.ok(result.every(r=>r.estimates.length===100&&r.seed==='challenge-test'&&r.type==='Monte Carlo'));
  assert.deepEqual(result,runChallenge(tiny,modified,options));
  for(const item of result) {
    assert.equal(item.trueMean,mean(item.sourceRows));
    assert.ok(Math.abs(item.rmse**2-item.bias**2-item.sd**2)<1e-10);
  }
  assert.throws(()=>runChallenge(tiny,modified,{...options,n:2}));
});
test('original CSV bytes are unchanged by creating and resetting a modified copy',()=>{
  const path=new URL('../data/heart_rate_week.csv',import.meta.url);
  const before=readFileSync(path),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  const rows=parseHeartRateCsv(before.toString('utf8'));
  const changed=challengePopulation(rows,true);
  assert.equal(changed.length,rows.length);assert.equal(changed[0].activity_state,'exercise');
  assert.deepEqual(challengePopulation(rows,false),rows);
  assert.equal(hash(readFileSync(path)),hash(before));
  // No repeated-sampling investigation is run on the real dataset.
});
