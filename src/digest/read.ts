import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightCounts, ReadNight, RunLine, RunStatus } from './types.js';

const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

function isStatus(value: unknown): value is RunStatus {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value);
}

/** Parses one non-blank line. Returns null when it is not a valid run line. */
export function parseRunLine(text: string): RunLine | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const { at, job, status, owner, error } = obj;
  if (typeof at !== 'string' || typeof job !== 'string' || !isStatus(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  const line: RunLine = { at, job, status, owner };
  // A non-string `error` is not one of the bad-line rules; treat it as absent.
  if (typeof error === 'string') line.error = error;
  return line;
}

type ParsedNight = { lines: RunLine[]; badLines: number };

/** Reads and parses <runsDir>/<night>.jsonl; null when the file does not exist. */
function parseNight(runsDir: string, night: string): ParsedNight | null {
  const file = join(runsDir, `${night}.jsonl`);
  if (!existsSync(file)) return null;
  const lines: RunLine[] = [];
  let badLines = 0;
  for (const text of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (text.trim() === '') continue;
    const line = parseRunLine(text);
    if (line) lines.push(line);
    else badLines++;
  }
  return { lines, badLines };
}

export const readNight: ReadNight = (runsDir, night) => {
  const parsed = parseNight(runsDir, night);
  if (!parsed) return null;
  const byJob = new Map<string, DigestRow>();
  for (const line of parsed.lines) {
    const row = byJob.get(line.job);
    if (!row) {
      byJob.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error ?? null,
        first: line.at,
        last: line.at,
      });
      continue;
    }
    row.owner = line.owner;
    row.runs++;
    if (line.status === 'retry') row.retries++;
    row.lastStatus = line.status;
    if (line.error !== undefined) row.lastError = line.error;
    row.last = line.at;
  }
  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines: parsed.badLines };
};

export function countNight(runsDir: string, night: string): NightCounts | null {
  const parsed = parseNight(runsDir, night);
  if (!parsed) return null;
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const line of parsed.lines) counts[line.status]++;
  return counts;
}
