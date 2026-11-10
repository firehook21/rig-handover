import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';

describe('digest routes', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'digest-test-'));
    // Copy 2026-10-28.jsonl from runs to temp dir
    const sourceData = readFileSync('runs/2026-10-28.jsonl', 'utf8');
    writeFileSync(join(tempDir, '2026-10-28.jsonl'), sourceData);
    // Create empty file for 2026-10-30
    writeFileSync(join(tempDir, '2026-10-30.jsonl'), '');
    // Create file with one bad line
    writeFileSync(
      join(tempDir, '2026-10-29.jsonl'),
      '{"at":"2026-10-29T00:00:00+01:00","job":"test/job","status":"ok","owner":"test"}\n' +
      'this is a bad line that will not parse\n' +
      '{"at":"2026-10-29T01:00:00+01:00","job":"test/job","status":"ok","owner":"test"}\n',
    );
  });

  describe('GET /digest/:night', () => {
    it('returns 200 with job names and lane marker for 2026-10-28', async () => {
      process.env.LANE_MARKER = 'TEST-MARKER';
      const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir };
      const res = await createApp(config).request('/digest/2026-10-28');
      const html = await res.text();
      
      expect(res.status).toBe(200);
      expect(html).toContain('TEST-MARKER');
      // Check for job names from the data
      expect(html).toContain('rig/rotate-logs');
      expect(html).toContain('lane/sync');
      expect(html).toContain('fixtures/refresh');
      expect(html).toContain('notes/backup');
      expect(html).toContain('digest/render');
    });

    it('returns 404 for a night with no file', async () => {
      const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir };
      const res = await createApp(config).request('/digest/2026-11-01');
      
      expect(res.status).toBe(404);
    });

    it('returns 200 with "nothing ran" for empty file', async () => {
      const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir };
      const res = await createApp(config).request('/digest/2026-10-30');
      const html = await res.text();
      
      expect(res.status).toBe(200);
      expect(html).toContain('nothing ran');
    });

    it('returns 200 for night with bad line, showing only good rows', async () => {
      const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir };
      const res = await createApp(config).request('/digest/2026-10-29');
      const html = await res.text();
      
      expect(res.status).toBe(200);
      expect(html).toContain('test/job');
    });

    it('lists jobs in the same order as the JSON rows', async () => {
      const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir };
      const pageRes = await createApp(config).request('/digest/2026-10-28');
      const pageHtml = await pageRes.text();
      
      const jsonRes = await createApp(config).request('/api/digest/2026-10-28');
      const jsonData = await jsonRes.json() as any;
      
      // Extract all job cell content in order
      const cellPattern = /<td>([^<]*)<\/td>/g;
      let cellMatch;
      let cellCount = 0;
      const jobsInPage: string[] = [];
      
      while ((cellMatch = cellPattern.exec(pageHtml)) !== null) {
        // Job is the first column (index 0) of each row, and each row has 8 columns
        if (cellCount % 8 === 0) {
          jobsInPage.push(cellMatch[1]);
        }
        cellCount++;
      }
      
      const jobsInJson = jsonData.rows.map((r: any) => r.job);
      
      expect(jobsInPage).toEqual(jobsInJson);
    });
  });

  describe('GET /api/digest/:night', () => {
    it('returns JSON with 5 rows and badLines 1 for 2026-10-28', async () => {
      const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir };
      const res = await createApp(config).request('/api/digest/2026-10-28');
      const data = await res.json() as any;
      
      expect(res.status).toBe(200);
      expect(data.rows).toHaveLength(5);
      expect(data.badLines).toBe(1);
    });

    it('returns 404 with JSON error for night with no file', async () => {
      const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir };
      const res = await createApp(config).request('/api/digest/2026-11-01');
      const data = await res.json() as any;
      
      expect(res.status).toBe(404);
      expect(data.error).toBe('no run log');
      expect(data.night).toBe('2026-11-01');
    });

    it('returns JSON with empty rows for empty night', async () => {
      const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir };
      const res = await createApp(config).request('/api/digest/2026-10-30');
      const data = await res.json() as any;
      
      expect(res.status).toBe(200);
      expect(data.rows).toEqual([]);
    });
  });
});
