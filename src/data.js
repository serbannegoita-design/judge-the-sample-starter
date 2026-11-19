const MINUTE = 60000;

// Treat device-local timestamps as a clock coordinate, without timezone or DST conversion.
export function parseDeviceMinute(timestamp) {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(timestamp);
  if (!match) throw new Error(`Invalid timestamp: ${timestamp}`);
  const [, year, month, day, hour, minute] = match.map(Number);
  const result = Date.UTC(year, month - 1, day, hour, minute);
  const date = new Date(result);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day || date.getUTCHours() !== hour || date.getUTCMinutes() !== minute) {
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }
  return result;
}

export function parseHeartRateCsv(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  if (header !== 'row_id,timestamp,heart_rate_bpm,n_readings,activity_state') {
    throw new Error('Unexpected CSV columns.');
  }
  return lines.map((line, index) => {
    const fields = line.split(',');
    if (fields.length !== 5 || fields.some(value => !value.trim())) throw new Error(`Invalid CSV row ${index + 2}.`);
    const [id, timestamp, rate, readings, state] = fields;
    const row = { row_id: Number(id), timestamp, heart_rate_bpm: Number(rate),
      n_readings: Number(readings), activity_state: state, time: parseDeviceMinute(timestamp) };
    if (row.row_id !== index + 1 || !Number.isFinite(row.heart_rate_bpm) ||
        row.heart_rate_bpm < 0 || !Number.isInteger(row.n_readings) || row.n_readings < 1 ||
        !['sleep', 'rest', 'exercise'].includes(state)) throw new Error(`Invalid CSV row ${index + 2}.`);
    return row;
  });
}

export function recordingGaps(rows, start, endExclusive) {
  const gaps = [];
  let expected = start;
  for (const row of rows) {
    if (row.time < expected || row.time >= endExclusive) throw new Error('Rows must be chronological and within the displayed period.');
    if (row.time > expected) gaps.push({ start: expected, end: row.time });
    expected = row.time + MINUTE;
  }
  if (expected < endExclusive) gaps.push({ start: expected, end: endExclusive });
  return gaps;
}

export function timelineSegments(rows) {
  const segments = [];
  for (const row of rows) {
    const current = segments[segments.length - 1];
    if (!current || row.time - current[current.length - 1].time !== MINUTE) segments.push([row]);
    else current.push(row);
  }
  return segments;
}
