import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { countNight, readNight } from './read.js';

const tmp = mkdtempSync(join(tmpdir(), 'rig-read-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');
  const row = (job: string) => night?.rows.find((r) => r.job === job);

  it('has 5 jobs, sorted, and 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.rows).toHaveLength(5);
    const jobs = night?.rows.map((r) => r.job) ?? [];
    expect(jobs).toEqual([...jobs].sort());
    expect(night?.badLines).toBe(1);
  });

  it('keeps the digest/render row with a null owner', () => {
    expect(row('digest/render')?.owner).toBeNull();
  });

  it('counts fixtures/refresh retries and its last status', () => {
    expect(row('fixtures/refresh')).toMatchObject({ retries: 3, runs: 4, lastStatus: 'ok', lastError: 'upstream 503' });
  });

  it('reports notes/backup failing with its error', () => {
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps the offset on first/last as written', () => {
    expect(row('fixtures/refresh')).toMatchObject({ first: '2026-10-29T01:30:00+01:00', last: '2026-10-29T01:37:00+01:00' });
  });
});

describe('readNight edge cases', () => {
  it('returns null for a missing night', () => {
    expect(readNight(tmp, '1999-01-01')).toBeNull();
    expect(countNight(tmp, '1999-01-01')).toBeNull();
  });

  it('returns no rows for an empty file', () => {
    writeFileSync(join(tmp, '2026-01-01.jsonl'), '');
    expect(readNight(tmp, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
    expect(countNight(tmp, '2026-01-01')).toEqual({ ok: 0, retry: 0, fail: 0 });
  });

  it('counts invalid lines and ignores blank ones', () => {
    const lines = [
      '{"at":"2026-01-02T01:00:00+02:00","job":"a","status":"ok","owner":"x"}',
      '',
      '   ',
      'not json',
      '{"at":"2026-01-02T01:00:00+02:00","job":"a","status":"maybe","owner":"x"}',
      '{"job":"a","status":"ok","owner":"x"}',
      '{"at":"2026-01-02T01:00:00+02:00","job":"a","status":"ok","owner":7}',
      '{"at":"2026-01-02T02:00:00+02:00","job":"a","status":"fail","owner":null,"error":"boom"}',
      '',
    ];
    writeFileSync(join(tmp, '2026-01-02.jsonl'), lines.join('\n'));
    const night = readNight(tmp, '2026-01-02');
    expect(night?.badLines).toBe(4);
    expect(night?.rows).toEqual([
      { job: 'a', owner: null, runs: 2, retries: 0, lastStatus: 'fail', lastError: 'boom', first: '2026-01-02T01:00:00+02:00', last: '2026-01-02T02:00:00+02:00' },
    ]);
    expect(countNight(tmp, '2026-01-02')).toEqual({ ok: 1, retry: 0, fail: 1 });
  });
});
