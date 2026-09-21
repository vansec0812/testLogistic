import test, { before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

let ai;
let client;
let timeouts;
const realFetch = globalThis.fetch;
const oldWindow = globalThis.window;
const oldReader = globalThis.FileReader;
const photos = Array(6).fill('data:image/png;base64,iVBORw0KGgo=');
const expected = { containerNumber: 'TEST1234567', containerType: '40HC', carrierCode: 'OTHER', declaredCondition: 'GOOD' };
const file = { name: 'fixture.pdf', type: 'application/pdf' };

async function loadTs(relative) {
  const output = await build({
    entryPoints: [fileURLToPath(new URL(relative, import.meta.url))],
    bundle: true, write: false, platform: 'browser', format: 'esm',
    define: { 'import.meta.env': '{}' },
  });
  return import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
}
before(async () => {
  globalThis.window = { location: { origin: 'http://local.test' } };
  ai = await loadTs('../src/services/aiService.ts');
  client = await loadTs('../src/services/apiClient.ts');
  globalThis.window = oldWindow;
});
beforeEach(() => {
  timeouts = [];
  globalThis.window = { location: { origin: 'http://local.test' }, setTimeout: (_fn, ms) => { timeouts.push(ms); return 0; }, clearTimeout() {} };
  globalThis.FileReader = class {
    readAsDataURL() { this.result = 'data:application/pdf;base64,JVBERi0xLjQ='; queueMicrotask(() => this.onload()); }
  };
});
afterEach(() => {
  globalThis.fetch = realFetch;
  globalThis.window = oldWindow;
  globalThis.FileReader = oldReader;
});
const respond = (body, status = 200) => { globalThis.fetch = async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); };

test('missing key is surfaced and never marks eDO as valid', async () => {
  respond({ code: 'AI_KEY_MISSING', message: 'Chưa cấu hình khóa API cho dịch vụ AI.' }, 503);
  const result = await ai.verifyEdoWithAI(file);
  assert.equal(result.status, 'MANUAL_REVIEW');
  assert.equal(result.isLegal, false);
  assert.match(result.error, /khóa API/);
  assert.equal(result.requiresOpsReview, true);
});
test('provider manual-review result is not relabeled INVALID', async () => {
  respond({ status: 'MANUAL_REVIEW', isLegal: false, hasAnomaly: false, summary: 'Ảnh mờ', details: ['Cần ảnh rõ hơn'], requiresOpsReview: true });
  const result = await ai.verifyEdoWithAI(file);
  assert.equal(result.status, 'MANUAL_REVIEW');
  assert.deepEqual(result.details, ['Cần ảnh rõ hơn']);
});
test('provider anomaly remains visible', async () => {
  respond({ status: 'ANOMALY', isLegal: false, hasAnomaly: true, summary: 'Có dấu hiệu sửa', requiresOpsReview: true });
  assert.equal((await ai.verifyEdoWithAI(file)).status, 'ANOMALY');
});
test('Booking is compared with manual registration fields and mismatches stay visible for Ops', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'http://local.test/api/ai/edo/verify');
    const sent = JSON.parse(init.body);
    assert.equal(sent.task, 'BOOKING_LEGALITY_AND_REGISTRATION_MATCH');
    assert.deepEqual(sent.expectedBooking, {
      bookingNumber: 'MSK-VN-984210',
      carrierCode: 'MSK',
      containerType: '40HC',
      cutOffDate: '30/09/2026',
    });
    return new Response(JSON.stringify({
      status: 'VALID',
      isLegal: true,
      hasAnomaly: false,
      summary: 'File Booking đọc rõ.',
      actualBookingNumber: 'MSK-VN-111111',
      actualCarrierCode: 'CMA CGM',
      actualContainerType: '20GP',
      actualCutOffDate: '29/09/2026',
      matchesRegistration: false,
      mismatchDetails: ['Thông tin Booking khác dữ liệu đăng ký.'],
      requiresOpsReview: true,
    }), { headers: { 'Content-Type': 'application/json' } });
  };
  const result = await ai.verifyBookingWithAI(file, {
    bookingNumber: 'MSK-VN-984210', carrierCode: 'MSK', containerType: '40HC', cutOffTime: '2026-09-30T23:59:59',
  });
  assert.equal(result.status, 'ANOMALY');
  assert.equal(result.matchesRegistration, false);
  assert.deepEqual(result.mismatchedFields, ['BOOKING_NUMBER', 'CARRIER_CODE', 'CONTAINER_TYPE', 'CUT_OFF_TIME']);
  assert.match(result.mismatchDetails.join(' '), /Số Booking/);
});
test('Booking aliases and a file uploaded before form completion can be reconciled without re-uploading', async () => {
  respond({
    status: 'VALID',
    isLegal: true,
    hasAnomaly: false,
    summary: 'File Booking hợp lệ.',
    actualBookingNumber: 'MSK VN 984210',
    actualCarrierCode: 'Maersk Line',
    actualContainerType: '40HQ',
    actualCutOffDate: '30/09/2026',
    matchesRegistration: true,
    requiresOpsReview: false,
  });
  const pending = await ai.verifyBookingWithAI(file, {});
  assert.equal(pending.comparisonStatus, 'PENDING');
  const result = ai.reconcileBookingAiResult(pending, {
    bookingNumber: 'MSK-VN-984210', carrierCode: 'MSK', containerType: '40HC', cutOffTime: '2026-09-30T23:59:59',
  });
  assert.equal(result.status, 'VALID');
  assert.equal(result.comparisonStatus, 'MATCHED');
  assert.equal(result.matchesRegistration, true);
});
test('confirmed photo mismatch is not hidden by requiresOpsReview', async () => {
  respond({ status: 'MISMATCH', matchesRegistration: false, actualCondition: 'MINOR_DAMAGE', actualConditionNotes: 'Vách bị xước.', mismatchDetails: ['Tình trạng khác khai báo'], summary: 'Có vết xước', requiresOpsReview: true });
  const result = await ai.verifyContainerPhotosWithAI(photos, expected);
  assert.equal(result.status, 'MISMATCH');
  assert.equal(result.actualConditionNotes, 'Vách bị xước.');
  assert.equal(result.matchesRegistration, false);
});
test('English AI descriptions are localized before they reach Ops and the Offer form', async () => {
  respond({
    status: 'MISMATCH',
    matchesRegistration: false,
    actualCondition: 'MINOR_DAMAGE',
    actualConditionNotes: 'The container shows minor scratches and rust on the left wall.',
    mismatchDetails: ['The condition does not match the registration.'],
    summary: 'The container shows minor damage.',
    requiresOpsReview: true,
  });
  const result = await ai.verifyContainerPhotosWithAI(photos, expected);
  assert.match(result.summary, /hư hỏng nhẹ/);
  assert.match(result.actualConditionNotes, /vết xước/);
  assert.match(result.actualConditionNotes, /rỉ sét/);
  assert.match(result.mismatchDetails[0], /không khớp/);
});
test('all photos and declared identity are sent; AI requests get the longer timeout', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'http://local.test/api/ai/container/verify');
    const sent = JSON.parse(init.body);
    assert.deepEqual(sent.photos, photos);
    assert.deepEqual(sent.expected, expected);
    return new Response(JSON.stringify({ status: 'MATCHED', matchesRegistration: true, summary: 'Khớp', requiresOpsReview: false }), { headers: { 'Content-Type': 'application/json' } });
  };
  assert.equal((await ai.verifyContainerPhotosWithAI(photos, expected)).status, 'MATCHED');
  assert.deepEqual(timeouts, [120_000]);
});
test('empty or HTML 500 response yields a usable error without displaying server markup', async () => {
  for (const body of ['', '<html>internal proxy error</html>']) {
    globalThis.fetch = async () => new Response(body, { status: 500 });
    const result = await ai.verifyEdoWithAI(file);
    assert.match(result.error, /Máy chủ xử lý chưa sẵn sàng/);
    assert.ok(!result.error.includes('<html>'));
  }
});
test('a 200 HTML fallback or malformed JSON never becomes a clean inspection', async () => {
  for (const response of [new Response('<html>index page</html>'), new Response('{}', { headers: { 'Content-Type': 'application/json' } })]) {
    globalThis.fetch = async () => response;
    assert.equal((await ai.inspectContainerWithAI(photos)).success, false);
  }
});
test('API error code and status are preserved for configuration diagnostics', async () => {
  respond({ code: 'AI_KEY_REJECTED', message: 'Khóa AI không hợp lệ.' }, 503);
  await assert.rejects(client.postApi('/api/ai/edo/verify', {}), error => error.code === 'AI_KEY_REJECTED' && error.status === 503);
});
