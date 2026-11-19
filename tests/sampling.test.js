import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mean, simpleRandomSample, seededRandom } from '../src/sampling.js';
import { parseHeartRateCsv, parseDeviceMinute, recordingGaps, timelineSegments } from '../src/data.js';

const tiny = Array.from({length: 12}, (_,i) => ({row_id: i+1, heart_rate_bpm: i+1}));
test('known-answer means and sample boundaries', () => {
  assert.equal(mean(tiny), 6.5);
  assert.equal(mean(simpleRandomSample(tiny, 12, 'full')), 6.5);
  assert.throws(() => mean([]));
  for (const n of [0, -1, 13, 1.5]) assert.throws(() => simpleRandomSample(tiny,n,'x'));
});
test('samples have n distinct original rows, preserve input and reproduce', () => {
  const before = structuredClone(tiny);
  for (const n of [1, 10, 12]) {
    for (const seed of ['one','two','three']) {
      const sample = simpleRandomSample(tiny,n,seed);
      assert.equal(sample.length,n);
      assert.equal(new Set(sample.map(r => r.row_id)).size,n);
      assert.ok(sample.every(r => tiny.includes(r)));
      assert.deepEqual(sample,simpleRandomSample(tiny,n,seed));
    }
  }
  assert.deepEqual(tiny,before);
});
test('random generator stays in [0,1) and is reproducible', () => {
  const a = seededRandom('check'), b = seededRandom('check');
  for (let i=0;i<10000;i++) { const value=a(); assert.ok(value>=0 && value<1); assert.equal(value,b()); }
});
test('clock coordinate is timezone independent and rejects invalid timestamps', () => {
  assert.equal(parseDeviceMinute('2016-04-25 00:01')-parseDeviceMinute('2016-04-25 00:00'),60000);
  assert.throws(() => parseDeviceMinute('2016-02-30 00:00'));
});
test('gaps and separate segments include leading, interior and trailing missing minutes', () => {
  const start=parseDeviceMinute('2016-04-25 00:00');
  const rows=[1,2,5].map(i=>({time:start+i*60000}));
  assert.deepEqual(recordingGaps(rows,start,start+7*60000),[
    {start,end:start+60000}, {start:start+3*60000,end:start+5*60000},
    {start:start+6*60000,end:start+7*60000}]);
  assert.deepEqual(timelineSegments(rows).map(s=>s.length),[2,1]);
  assert.throws(() => recordingGaps([...rows].reverse(),start,start+7*60000));
});
test('real CSV parses and stage 2 selects 100 distinct rows without calculating investigation results', () => {
  const raw=readFileSync(new URL('../data/heart_rate_week.csv',import.meta.url),'utf8');
  const rows=parseHeartRateCsv(raw);
  assert.equal(rows.length,9864);
  const sample=simpleRandomSample(rows,100,'stage2-2026');
  assert.equal(sample.length,100);
  assert.equal(new Set(sample.map(r=>r.row_id)).size,100);
  const start=parseDeviceMinute('2016-04-25 00:00'),end=parseDeviceMinute('2016-05-02 00:00');
  const gaps=recordingGaps(rows,start,end);
  assert.equal(gaps.reduce((sum,g)=>sum+(g.end-g.start)/60000,0),216);
  assert.equal(timelineSegments(rows).flat().length,rows.length);
});
