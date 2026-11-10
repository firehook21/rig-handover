import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readNight } from './digest/read.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

const NIGHT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    
    if (!NIGHT_REGEX.test(night)) {
      return c.json({ error: 'no run log', night }, 404);
    }
    
    const data = readNight(config.runsDir, night);
    if (!data) {
      return c.json({ error: 'no run log', night }, 404);
    }
    
    return c.json(data);
  });

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  return app;
}
