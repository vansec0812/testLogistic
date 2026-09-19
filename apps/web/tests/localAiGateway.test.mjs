import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { createServer, preview } from 'vite';
import { localAiGateway } from '../../api/vite-plugin.mjs';
import { readGatewayConfig } from '../../api/gateway.mjs';

async function getAvailablePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

for (const mode of ['dev', 'preview']) {
  test(`${mode} serves AI on the web origin without a separate port-8000 process`, async t => {
    const plugin = localAiGateway({ getConfig: () => readGatewayConfig({ env: {}, envPath: '/nonexistent/econt-test.env' }) });
    const port = await getAvailablePort();
    const options = { configFile: false, plugins: [plugin], logLevel: 'silent', server: { host: '127.0.0.1', port, strictPort: true }, preview: { host: '127.0.0.1', port, strictPort: true } };
    const server = mode === 'dev' ? await createServer(options) : await preview(options);
    if (mode === 'dev') await server.listen();
    const httpServer = server.httpServer;
    t.after(async () => {
      httpServer.closeAllConnections();
      if (mode === 'dev') await server.close();
      else await new Promise(resolve => httpServer.close(resolve));
    });
    const base = `http://127.0.0.1:${httpServer.address().port}`;
    const response = await fetch(`${base}/api/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).service, 'econt-ai');
    const scan = await fetch(`${base}/api/ai/container/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(scan.status, 503);
    assert.equal((await scan.json()).code, 'AI_KEY_MISSING');
  });
}
