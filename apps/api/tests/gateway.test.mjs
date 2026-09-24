import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createApiHandler, readGatewayConfig } from '../gateway.mjs';

const config = { ...readGatewayConfig({ env: {}, envPath: '/nonexistent/econt-test.env' }), apiKey: 'fixture-key-not-a-real-credential' };
const png = 'data:image/png;base64,iVBORw0KGgo=';
const document = { fileName: 'fixture.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQ=' };
const providerJson = value => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }), { headers: { 'Content-Type': 'application/json' } });

async function startGateway(t, options = {}) {
  const server = http.createServer(createApiHandler({ getConfig: () => config, ...options }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  return (path, payload) => fetch(`${base}${path}`, payload === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}

test('health and both scan routes distinguish a missing key without calling the provider', async t => {
  let calls = 0;
  const request = await startGateway(t, { getConfig: () => ({ ...config, apiKey: '' }), fetchImpl: () => { calls++; } });
  const health = await request('/api/health');
  assert.equal(health.status, 200);
  assert.equal((await health.json()).code, 'AI_KEY_MISSING');
  for (const path of ['/api/ai/edo/verify', '/api/ai/container/verify']) {
    const response = await request(path, { document, photos: Array(6).fill(png) });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'AI_KEY_MISSING');
  }
  assert.equal(calls, 0);
});

test('keys are loaded from supported env names and example placeholders do not count', () => {
  const read = env => readGatewayConfig({ env, envPath: '/nonexistent/econt-test.env' });
  assert.equal(read({ ECONT_AI_API_KEY: 'replace-with-server-side-key' }).apiKey, '');
  assert.equal(read({ GEMINI_API_KEY: config.apiKey }).apiKey, config.apiKey);
  assert.equal(read({ ECONT_AI_API_KEY: '   ' }).apiKey, '');
  assert.equal(read({ ECONT_AI_API_KEY: config.apiKey, GEMINI_API_KEY: 'second' }).apiKey, config.apiKey);
});

test('eDO forwards actual PDF bytes using a server-side header and preserves manual review', async t => {
  const result = { status: 'MANUAL_REVIEW', isLegal: false, hasAnomaly: false, requiresOpsReview: true, summary: 'Ảnh mờ', details: [] };
  const request = await startGateway(t, { fetchImpl: async (url, init) => {
    assert.equal(new URL(url).search, '');
    assert.equal(init.headers['x-goog-api-key'], config.apiKey);
    assert.deepEqual(JSON.parse(init.body).contents[0].parts[1].inline_data, { mime_type: document.mimeType, data: document.data });
    return providerJson(result);
  } });
  const response = await request('/api/ai/edo/verify', { document });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), result);
});

test('eDO verification extracts file identity without showing Offer values to the model', async t => {
  const result = {
    status: 'VALID', isLegal: true, hasAnomaly: false, requiresOpsReview: false,
    documentType: 'EDO', actualContainerNumber: 'CMAU2197439',
    actualCarrierCode: 'CMA', actualContainerType: '20GP',
    summary: 'eDO đọc rõ.', details: [],
  };
  const request = await startGateway(t, { fetchImpl: async (_url, init) => {
    const parts = JSON.parse(init.body).contents[0].parts;
    assert.match(parts[0].text, /kiểm tra chứng từ eDO/i);
    assert.doesNotMatch(parts[0].text, /MSKU8421093/);
    assert.match(parts[0].text, /actualContainerNumber/);
    assert.deepEqual(parts[1].inline_data, { mime_type: document.mimeType, data: document.data });
    return providerJson(result);
  } });
  const response = await request('/api/ai/edo/verify', {
    task: 'EDO_LEGALITY_AND_FIELD_EXTRACTION', documentType: 'EDO', document,
    expectedEdo: { containerNumber: 'MSKU8421093', carrierCode: 'MSK', containerType: '40HC' },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), result);
});
test('container scan forwards all six images but hides declared identity from OCR', async t => {
  const result = { status: 'MISMATCH', matchesRegistration: false, actualCondition: 'MINOR_DAMAGE', actualConditionNotes: 'Vách xước và rỉ.', summary: 'Có hư hỏng', requiresOpsReview: true };
  const request = await startGateway(t, { fetchImpl: async (_url, init) => {
    const parts = JSON.parse(init.body).contents[0].parts;
    assert.equal(parts.length, 7);
    assert.ok(parts.slice(1).every(part => part.inline_data.mime_type === 'image/png'));
    assert.doesNotMatch(parts[0].text, /TEST1234567/);
    assert.match(parts[0].text, /actualConditionNotes/);
    return providerJson(result);
  } });
  const response = await request('/api/ai/container/verify', { photos: Array(6).fill(png), expected: { containerNumber: 'TEST1234567' } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), result);
});

for (const [upstreamStatus, upstreamMessage, status, code] of [
  [400, 'API key not valid fixture-key-not-a-real-credential', 503, 'AI_KEY_REJECTED'],
  [403, 'Permission denied', 503, 'AI_KEY_REJECTED'],
  [404, 'Model not found', 503, 'AI_MODEL_UNAVAILABLE'],
  [429, 'Quota exhausted', 429, 'AI_RATE_LIMITED'],
  [503, 'Service unavailable', 502, 'AI_PROVIDER_UNAVAILABLE'],
]) {
  test(`provider ${upstreamStatus} maps to ${code} without disclosing provider messages`, async t => {
    const request = await startGateway(t, { fetchImpl: async () => new Response(JSON.stringify({ error: { message: upstreamMessage } }), { status: upstreamStatus }) });
    const response = await request('/api/ai/edo/verify', { document });
    assert.equal(response.status, status);
    const body = await response.json();
    assert.equal(body.code, code);
    assert.ok(!JSON.stringify(body).includes(config.apiKey));
  });
}

test('provider timeout returns a distinct 504 response', async t => {
  const request = await startGateway(t, { fetchImpl: async () => { throw new DOMException('timed out', 'TimeoutError'); } });
  const response = await request('/api/ai/edo/verify', { document });
  assert.equal(response.status, 504);
  assert.equal((await response.json()).code, 'AI_TIMEOUT');
});

test('incomplete uploads fail validation before provider invocation', async t => {
  let calls = 0;
  const request = await startGateway(t, { fetchImpl: () => { calls++; } });
  assert.equal((await request('/api/ai/edo/verify', {})).status, 400);
  assert.equal((await request('/api/ai/container/verify', { photos: Array(5).fill(png) })).status, 400);
  assert.equal((await request('/api/ai/edo/verify', null)).status, 400);
  assert.equal(calls, 0);
});

test('empty model JSON is not accepted as a successful inspection', async t => {
  const request = await startGateway(t, { fetchImpl: async () => providerJson({}) });
  const response = await request('/api/ai/container/inspect', { photos: Array(6).fill(png) });
  assert.equal(response.status, 502);
  assert.equal((await response.json()).code, 'AI_INVALID_RESPONSE');
});

test('configuration is reread on retry so adding a key does not require a server restart', async t => {
  let apiKey = '';
  const request = await startGateway(t, {
    getConfig: () => ({ ...config, apiKey }),
    fetchImpl: async () => providerJson({ status: 'VALID', isLegal: true, summary: 'Readable fixture' }),
  });
  assert.equal((await request('/api/ai/edo/verify', { document })).status, 503);
  apiKey = config.apiKey;
  assert.equal((await request('/api/ai/edo/verify', { document })).status, 200);
  assert.ok(!JSON.stringify(await (await request('/api/health')).json()).includes(apiKey));
});

test('Booking extracts its own fields without being primed by manually entered values', async t => {
  const request = await startGateway(t, { fetchImpl: async (_url, init) => {
    const parts = JSON.parse(init.body).contents[0].parts;
    assert.match(parts[0].text, /actualBookingNumber/);
    assert.match(parts[0].text, /actualCutOffDate/);
    assert.doesNotMatch(parts[0].text, /SECRET-EXPECTED-BOOKING/);
    assert.equal(parts[1].inline_data.data, document.data);
    return providerJson({ status: 'MANUAL_REVIEW', summary: 'Cần kiểm tra' });
  } });
  assert.equal((await request('/api/ai/edo/verify', { document, documentType: 'BOOKING', expected: { bookingNumber: 'SECRET-EXPECTED-BOOKING' } })).status, 200);
});

for (const failure of ['busy', 'html', 'timeout', 'missing-model']) {
  test(`${failure}: retry/fallback preserves all uploaded evidence`, async t => {
    const calls = [];
    const request = await startGateway(t, {
      getConfig: () => ({ ...config, model: 'primary-fixture', fallbackModels: ['fallback-fixture'] }),
      fetchImpl: async (url, init) => {
        calls.push({ url, body: init.body });
        if (calls.length === 1) {
          if (failure === 'timeout') throw new DOMException('timed out', 'TimeoutError');
          if (failure === 'html') return new Response('<html>busy</html>', { status: 503 });
          return new Response(JSON.stringify({ error: { message: 'temporary fixture error' } }), { status: failure === 'missing-model' ? 404 : 503 });
        }
        return providerJson({ status: 'MANUAL_REVIEW', summary: 'Đã đọc file, cần Ops kiểm tra' });
      },
    });
    const result = await request('/api/ai/edo/verify', { document, documentType: 'BOOKING' });
    assert.equal(result.status, 200);
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /primary-fixture/);
    assert.match(calls[1].url, /fallback-fixture/);
    assert.equal(calls[0].body, calls[1].body);
  });
}
test('invalid key fails immediately without wasting calls on another model', async t => {
  let calls = 0;
  const request = await startGateway(t, {
    getConfig: () => ({ ...config, fallbackModels: ['fallback-fixture'] }),
    fetchImpl: async () => { calls++; return new Response(JSON.stringify({ error: { message: 'API key not valid' } }), { status: 400 }); },
  });
  assert.equal((await request('/api/ai/edo/verify', { document })).status, 503);
  assert.equal(calls, 1);
});
test('Vercel timeout remains below function limit even if configured for local use', () => {
  const result = readGatewayConfig({ env: { VERCEL: '1', ECONT_AI_TIMEOUT_MS: '90000' }, envPath: '/nonexistent/econt-test.env' });
  assert.equal(result.providerTimeoutMs, 50000);
});
test('retry budget expires without accepting a result or calling indefinitely', async t => {
  let calls = 0;
  const request = await startGateway(t, {
    getConfig: () => ({ ...config, providerTimeoutMs: 100 }),
    fetchImpl: async () => { calls++; return new Response('{}', { status: 503 }); },
  });
  const result = await request('/api/ai/container/verify', { photos: Array(6).fill(png) });
  assert.equal(result.status, 502);
  assert.equal(calls, 1);
});

test('tiny image is rejected before Gemini can hallucinate eDO, Booking or photo evidence', async t => {
  let calls = 0;
  const request = await startGateway(t, { fetchImpl: async () => { calls++; return providerJson({ status: 'VALID' }); } });
  const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/J/0AAAAASUVORK5CYII=';
  for (const documentType of ['EDO', 'BOOKING']) {
    const result = await request('/api/ai/edo/verify', { documentType, document: { mimeType: 'image/png', data: pixel } });
    assert.equal(result.status, 422);
    assert.equal((await result.json()).code, 'AI_IMAGE_TOO_SMALL');
  }
  const result = await request('/api/ai/container/verify', { photos: Array(6).fill('data:image/png;base64,' + pixel) });
  assert.equal(result.status, 422);
  assert.equal(calls, 0);
});
