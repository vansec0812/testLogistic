import test, { before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Real DatabaseContext actions with an isolated hook adapter and in-memory
// storage. No browser data, external database, seed reset, or AI bill is touched.
let database;
let fixtures;
const previousStorage = globalThis.localStorage;
const previousAuth = globalThis.__bookingTestAuth;
async function compile(entry, plugins = []) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(entry, import.meta.url))],
    bundle: true, write: false, platform: 'node', format: 'esm',
    define: { 'import.meta.env': '{}' }, plugins,
  });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
}
before(async () => {
  fixtures = await compile('../src/data/mockData.ts');
  database = await compile('../src/context/DatabaseContext.tsx', [{
    name: 'isolated-context-adapter',
    setup(builder) {
      builder.onResolve({ filter: /^(react|react\/jsx-runtime)$|\/AuthContext$|\/onlineDbClient$/ }, args => ({ path: args.path, namespace: 'test-adapter' }));
      builder.onLoad({ filter: /.*/, namespace: 'test-adapter' }, args => ({
        contents: args.path.endsWith('/AuthContext') ? 'export const useAuth = () => globalThis.__bookingTestAuth;'
          : args.path.endsWith('/onlineDbClient') ? 'export const onlineDb = { getConfig: () => ({ enabled: false }) };'
            : args.path === 'react/jsx-runtime' ? 'export const jsx = (type, props) => ({type, props}); export const jsxs = jsx;'
              : `export const createContext = () => ({Provider: 'Provider'});
                 export const useState = initial => { let current = typeof initial === 'function' ? initial() : initial; return [current, next => { current = typeof next === 'function' ? next(current) : next; }]; };
                 export const useCallback = fn => fn;
                 export const useMemo = fn => fn();
                 export const useEffect = () => {};
                 export const useContext = () => {};
                 export default { createElement: (type, props) => ({ type, props }) };`,
        loader: 'js',
      }));
    },
  }]);
});
beforeEach(() => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
  };
});
afterEach(() => {
  globalThis.localStorage = previousStorage;
  globalThis.__bookingTestAuth = previousAuth;
});
const persisted = key => JSON.parse(localStorage.getItem(key) || '[]');
function asRole(role) {
  const requester = fixtures.INITIAL_COMPANIES.find(company => company.id === (role === 'ENTERPRISE_A' ? 'COMP-A01' : 'COMP-B01'));
  const currentCompany = role === 'OPS' ? { ...requester, id: 'COMP-OPS', shortName: 'Ops' } : requester;
  assert.ok(currentCompany, 'seed account exists');
  globalThis.__bookingTestAuth = { currentRole: role, currentCompany, currentUserEmail: 'fixture@example.invalid', currentUserId: 'fixture-user' };
  return database.DatabaseProvider({ children: null }).props.value;
}
function bookingForm() {
  const day = offset => new Date(Date.now() + offset * 86400000).toISOString();
  const cutOffTime = day(5);
  const verdict = { success: true, status: 'VALID', isLegal: true, hasAnomaly: false, requiresOpsReview: false, summary: 'Booking rõ ràng.', details: [] };
  return {
    carrierId: 'CARR-MSK', containerType: '40HC', bookingNumber: 'BK-QA-12345',
    deliveryLocationName: 'Kho thử nghiệm', deliveryLatitude: 10.74, deliveryLongitude: 106.7,
    pickupWindowStart: day(2), pickupWindowEnd: day(3), cutOffTime,
    maxDistanceKm: 30, baselinePickupCostVnd: 3400000, bookingFileName: 'booking-fixture.pdf',
    bookingAiCheck: {
      ...verdict, isValid: true, documentVerification: verdict, documentType: 'BOOKING',
      matchesRegistration: true, comparisonStatus: 'MATCHED', actualBookingNumber: 'BK-QA-12345',
      actualCarrierCode: 'MSK', actualContainerType: '40HC', actualCutOffDate: cutOffTime.slice(0, 10),
    },
  };
}
test('create Booking rechecks stale VALID against manual fields and alerts Ops without replacing seed data', () => {
  const context = asRole('ENTERPRISE_B');
  const original = context.requests;
  const form = bookingForm();
  form.bookingNumber = 'BK-QA-DIFFERENT';
  const result = context.addRequest(form);
  assert.equal(result.success, true, result.message);
  assert.equal(result.data.status, 'UNDER_REVIEW');
  assert.equal(result.data.bookingAiCheck.status, 'ANOMALY');
  assert.deepEqual(result.data.bookingAiCheck.mismatchedFields, ['BOOKING_NUMBER']);
  assert.equal(persisted('econt_v2_requests').length, original.length + 1);
  assert.deepEqual(persisted('econt_v2_requests').slice(0, original.length), original);
  const notice = persisted('econt_notifications_v2').find(notification => notification.relatedEntityId === result.data.id);
  assert.equal(notice.recipientCompanyId, 'COMP-OPS');
  assert.match(notice.title, /Số Booking không khớp/);
  assert.match(notice.body, /BK-QA-DIFFERENT/);
});
test('failed or absent AI still permits registration but always enters the Ops queue', () => {
  const context = asRole('ENTERPRISE_B');
  const form = bookingForm();
  form.bookingAiCheck = undefined;
  const result = context.addRequest(form);
  assert.equal(result.success, true, result.message);
  assert.equal(result.data.status, 'UNDER_REVIEW');
});
test('Ops can manually approve flagged Booking; later file/identity edits require review again', () => {
  const form = bookingForm();
  form.bookingAiCheck = { ...form.bookingAiCheck, status: 'MANUAL_REVIEW', isValid: false, requiresOpsReview: true, documentVerification: undefined };
  const created = asRole('ENTERPRISE_B').addRequest(form);
  assert.equal(created.success, true, created.message);
  const approved = asRole('OPS').opsReviewRequest(created.data.id, 'APPROVE', 'Đã đối chiếu thủ công file Booking và hãng tàu.');
  assert.equal(approved.success, true, approved.message);
  assert.equal(persisted('econt_v2_requests').find(request => request.id === created.data.id).status, 'OPEN');
  const changed = asRole('ENTERPRISE_B').updateRequest(created.data.id, { bookingNumber: 'BK-EDITED-456' });
  assert.equal(changed.success, true, changed.message);
  const request = persisted('econt_v2_requests').find(request => request.id === created.data.id);
  assert.equal(request.status, 'UNDER_REVIEW');
  assert.equal(request.bookingAiCheck.status, 'ANOMALY');
  assert.ok(persisted('econt_notifications_v2').some(notice => notice.relatedEntityId === request.id && /không khớp/.test(notice.title)));
});
test('all-pass Booking retains the existing draft -> submit -> Ops -> matching flow', () => {
  const created = asRole('ENTERPRISE_B').addRequest(bookingForm());
  assert.equal(created.success, true, created.message);
  assert.equal(created.data.status, 'DRAFT');
  assert.equal(created.data.bookingAiCheck.isValid, true);
  const submitted = asRole('ENTERPRISE_B').submitRequestForReview(created.data.id);
  assert.equal(submitted.success, true, submitted.message);
  assert.equal(persisted('econt_v2_requests').find(request => request.id === created.data.id).status, 'UNDER_REVIEW');
  assert.equal(asRole('OPS').opsReviewRequest(created.data.id, 'APPROVE', 'Đã xác minh Booking.').success, true);
  assert.equal(persisted('econt_v2_requests').find(request => request.id === created.data.id).status, 'OPEN');
});

function offerForm() {
  return {
    containerNumber: 'MSKU9234511', containerType: '40HC', carrierId: 'CARR-MSK',
    declaredCondition: 'GOOD', conditionNotes: 'Vách, cửa và gầm nguyên vẹn.',
    photos: Array.from({length: 6}, (_, index) => 'fixture-photo-' + index),
    edoFileName: 'edo-fixture.pdf', pickupLocationName: 'Bãi kiểm thử',
    pickupLatitude: 10.74, pickupLongitude: 106.7,
    availableFrom: new Date(Date.now() + 86400000).toISOString(),
    availableTo: new Date(Date.now() + 3 * 86400000).toISOString(),
    aiCheck: {
      passed: true, score: 95, summary: 'eDO và ảnh khớp.', hasAnomaly: false,
      edoChecked: true, edoValid: true, edoAnomaly: false, edoMatchesRegistration: true,
      edoDocumentType: 'EDO', edoActualContainerNumber: 'MSKU9234511', edoActualCarrierCode: 'MSK', edoActualContainerType: '40HC',
      photoChecked: true, photoStatus: 'MATCHED', matchesRegistration: true,
      actualContainerNumber: 'MSKU9234511', actualContainerType: '40HC', actualCarrierCode: 'MSK',
      photoCondition: 'GOOD', photoConditionNotes: 'Vách, cửa và gầm nguyên vẹn.', verificationStatus: 'VERIFIED',
    },
  };
}
test('Offer auto approves only when eDO and photo evidence both pass', () => {
  const created = asRole('ENTERPRISE_A').addOffer(offerForm());
  assert.equal(created.success, true, created.message);
  assert.equal(created.data.status, 'AVAILABLE');
});
test('partial old Offer verdict never auto approves on create or resubmit', () => {
  const form = offerForm();
  delete form.aiCheck.edoMatchesRegistration;
  const created = asRole('ENTERPRISE_A').addOffer(form);
  assert.equal(created.success, true, created.message);
  assert.equal(created.data.status, 'UNDER_REVIEW');
  const saved = persisted('econt_v2_offers');
  localStorage.setItem('econt_v2_offers', JSON.stringify(saved.map(offer => offer.id === created.data.id ? { ...offer, status: 'CHANGES_REQUIRED', requiresOpsManualReview: false } : offer)));
  const submitted = asRole('ENTERPRISE_A').submitOfferForReview(created.data.id);
  assert.equal(submitted.success, true, submitted.message);
  assert.equal(persisted('econt_v2_offers').find(offer => offer.id === created.data.id).status, 'UNDER_REVIEW');
});
