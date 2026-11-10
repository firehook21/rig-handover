// Plan morning-digest § 1. The contract every part of § 2 builds against.

/** One line of runs/<night>.jsonl, after parsing. */
export type RunStatus = 'ok' | 'retry' | 'fail';

export type RunLine = {
  at: string; // ISO 8601 with the log's own offset; never converted to UTC
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

/** One row per job for the night. */
export type DigestRow = {
  job: string;
  /** null when the log says null; views render it as `—`. */
  owner: string | null;
  /** Lines seen for this job (every status). */
  runs: number;
  /** Lines with status `retry`. */
  retries: number;
  lastStatus: RunStatus;
  /** `error` of the last line for this job that had one, or null. */
  lastError: string | null;
  /** `at` of the first and last line for this job, offset kept as written. */
  first: string;
  last: string;
};

export type Night = {
  night: string; // YYYY-MM-DD
  /** Sorted by job. */
  rows: DigestRow[];
  /** Lines that did not parse as a run line. Counted, never thrown. */
  badLines: number;
};

/**
 * Reads runs/<night>.jsonl. Returns null when the file does not exist (routes answer 404).
 * An empty file returns { rows: [], badLines: 0 }.
 */
export type ReadNight = (runsDir: string, night: string) => Night | null;

/** Ok / retry / fail line counts for one night (status board). */
export type NightCounts = { ok: number; retry: number; fail: number };
