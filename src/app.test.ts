import { describe, it, expect } from 'vitest';
import { createApp } from './app.js';
import { readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('GET /api/digest/:night', () => {
  it('returns JSON digest for valid night with existing file', async () => {
    const app = createApp({
      adapter: 'test',
      installed: 'test',
      beatEverySeconds: 60,
      runsDir: './runs',
    });
    
    const response = await app.request('/api/digest/2026-10-28');
    expect(response.status).toBe(200);
    
    const data = await response.json() as any;
    expect(data.night).toBe('2026-10-28');
    expect(Array.isArray(data.rows)).toBe(true);
    expect(data.badLines).toBe(1);
    
    // Check that rows are sorted by job
    const jobNames = data.rows.map((r: any) => r.job);
    expect(jobNames).toEqual([...jobNames].sort());
    
    // Verify specific jobs from the test data
    expect(jobNames).toContain('digest/render');
    expect(jobNames).toContain('fixtures/refresh');
    expect(jobNames).toContain('lane/sync');
    expect(jobNames).toContain('notes/backup');
    expect(jobNames).toContain('rig/rotate-logs');
  });

  it('returns 404 with error JSON for night with no file', async () => {
    const app = createApp({
      adapter: 'test',
      installed: 'test',
      beatEverySeconds: 60,
      runsDir: './runs',
    });
    
    const response = await app.request('/api/digest/9999-99-99');
    expect(response.status).toBe(404);
    
    const data = await response.json() as any;
    expect(data.error).toBe('no run log');
    expect(data.night).toBe('9999-99-99');
  });

  it('returns 404 for invalid night format', async () => {
    const app = createApp({
      adapter: 'test',
      installed: 'test',
      beatEverySeconds: 60,
      runsDir: './runs',
    });
    
    const response = await app.request('/api/digest/not-a-date');
    expect(response.status).toBe(404);
    
    const data = await response.json() as any;
    expect(data.error).toBe('no run log');
    expect(data.night).toBe('not-a-date');
  });
});
