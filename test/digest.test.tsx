import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest page', () => {
  it('renders /digest/2026-10-28 with all the jobs', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest 2026-10-28');
    expect(html).toContain('rig/rotate-logs');
    expect(html).toContain('lane/sync');
    expect(html).toContain('fixtures/refresh');
    expect(html).toContain('notes/backup');
    expect(html).toContain('digest/render');
    expect(html).toContain('1 line did not parse');
  });

  it('returns 404 for a night with no file', async () => {
    const res = await createApp(config).request('/digest/2026-10-99');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for');
  });

  it('returns 404 for an invalid date format', async () => {
    const res = await createApp(config).request('/digest/2026-13-01');
    expect(res.status).toBe(404);
  });
});
