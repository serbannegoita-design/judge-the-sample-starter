import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadHeartRatePopulation } from '../src/data.js';

test('hosted CSV copy is byte-identical to the original dataset', () => {
  assert.deepEqual(readFileSync(new URL('../public/heart_rate_week.csv', import.meta.url)),
    readFileSync(new URL('../data/heart_rate_week.csv', import.meta.url)));
});
test('CSV loader requests its base-prefixed URL and parses the response', async () => {
  const url = '/judge-the-sample-starter/heart_rate_week.csv';
  const rows = await loadHeartRatePopulation(url, async requested => {
    assert.equal(requested,url);
    return { ok:true, text:async () => 'row_id,timestamp,heart_rate_bpm,n_readings,activity_state\n1,2016-04-25 00:00,60,1,rest' };
  });
  assert.equal(rows.length,1);assert.equal(rows[0].heart_rate_bpm,60);
});
test('CSV loader gives a readable HTTP error rather than a blank app', async () => {
  await assert.rejects(loadHeartRatePopulation('/missing.csv', async () => ({ok:false,status:404})), /HTTP 404.*missing.csv/);
});
