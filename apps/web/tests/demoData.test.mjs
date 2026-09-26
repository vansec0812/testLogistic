import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

async function loadDemoDatasetSummary() {
  const source = `
    import { INITIAL_ASSETS, INITIAL_OFFERS, INITIAL_REQUESTS, INITIAL_TRANSACTIONS } from './data/mockData';
    import { findMatchesForRequest } from './services/matchingEngine';

    const findRequest = (id) => INITIAL_REQUESTS.find((request) => request.id === id);
    const matchIds = (id) => findMatchesForRequest(findRequest(id), INITIAL_OFFERS)
      .candidates
      .map((candidate) => candidate.offer.id)
      .sort();

    export default {
      supplierOfferCount: INITIAL_OFFERS.filter((offer) => offer.companyId === 'COMP-A01').length,
      requesterBookingCount: INITIAL_REQUESTS.filter((request) => request.companyId === 'COMP-B01').length,
      cmaCandidateIds: matchIds('REQ-2026-002'),
      oneCandidateIds: matchIds('REQ-2026-003'),
      allocatedOffer: INITIAL_OFFERS.find((offer) => offer.id === 'OFR-2026-001')?.status,
      withdrawnOffer: INITIAL_OFFERS.find((offer) => offer.id === 'OFR-2026-005')?.status,
      fulfilledOffer: INITIAL_OFFERS.find((offer) => offer.id === 'OFR-2026-006')?.status,
      activeTransaction: INITIAL_TRANSACTIONS.find((transaction) => transaction.id === 'TXN-2026-0042')?.status,
      containerPhotoSets: INITIAL_ASSETS.map((asset) => asset.photos),
      containerConditions: INITIAL_ASSETS.map((asset) => ({
        id: asset.id,
        declaredCondition: asset.declaredCondition,
        reviewedCondition: asset.reviewedCondition,
        aiCondition: asset.aiInspection?.condition,
        aiStatus: asset.aiInspection?.status,
        requiresOpsReview: asset.aiInspection?.requiresOpsReview,
      })),
    };
  `;

  const result = await build({
    stdin: {
      contents: source,
      resolveDir: resolve(process.cwd(), 'src'),
      sourcefile: 'demo-data-check.ts',
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    write: false,
  });
  const bundle = Buffer.from(result.outputFiles[0].text).toString('base64');
  const module = await import(`data:text/javascript;base64,${bundle}`);
  return module.default;
}

test('demo data creates the requested Offer, Booking, matching, and RU states', async () => {
  const summary = await loadDemoDatasetSummary();

  assert.equal(summary.supplierOfferCount, 5);
  assert.equal(summary.requesterBookingCount, 5);
  assert.deepEqual(summary.cmaCandidateIds, ['OFR-2026-002', 'OFR-2026-003']);
  assert.deepEqual(summary.oneCandidateIds, ['OFR-2026-004']);
  assert.equal(summary.allocatedOffer, 'ALLOCATED');
  assert.equal(summary.withdrawnOffer, 'WITHDRAWN');
  assert.equal(summary.fulfilledOffer, 'FULFILLED');
  assert.equal(summary.activeTransaction, 'PENDING_CARRIER');
});

test('each demo container item has its own complete seven-angle photo set', async () => {
  const summary = await loadDemoDatasetSummary();
  const expectedPhotoNames = ['front.jpg', 'left.jpg', 'right.jpg', 'rear.jpg', 'roof.jpg', 'underbody.jpg', 'floor.jpg'];
  const photoSetKeys = summary.containerPhotoSets.map((photos) => photos.join('|'));

  assert.equal(summary.containerPhotoSets.length, 6);
  assert.equal(new Set(photoSetKeys).size, 6, 'photo sets must not be shared between assets');

  for (const photos of summary.containerPhotoSets) {
    assert.deepEqual(photos.map((photo) => photo.split('/').at(-1)), expectedPhotoNames);
    for (const photo of photos) {
      assert.match(photo, /\/demo\/container\/asset-\d{2}\//);
      assert.ok(existsSync(resolve(process.cwd(), 'public', photo.slice(1))), `missing demo photo: ${photo}`);
    }
  }
});

test('each demo container asset has matching declared, reviewed, and AI condition data', async () => {
  const summary = await loadDemoDatasetSummary();
  const expectedConditions = [
    ['ASSET-01', 'GOOD', 'GOOD', 'GOOD', 'CLEAN', false],
    ['ASSET-02', 'MINOR_DAMAGE', 'MINOR_DAMAGE', 'MINOR_DAMAGE', 'OPS_VERIFIED', false],
    ['ASSET-03', 'MINOR_DAMAGE', 'MINOR_DAMAGE', 'MINOR_DAMAGE', 'OPS_VERIFIED', false],
    ['ASSET-04', 'MAJOR_DAMAGE', 'MAJOR_DAMAGE', 'MAJOR_DAMAGE', 'ANOMALY', true],
    ['ASSET-05', 'GOOD', 'GOOD', 'GOOD', 'CLEAN', false],
    ['ASSET-06', 'MINOR_DAMAGE', 'MINOR_DAMAGE', 'MINOR_DAMAGE', 'OPS_VERIFIED', false],
  ];

  assert.deepEqual(
    summary.containerConditions.map((condition) => [
      condition.id,
      condition.declaredCondition,
      condition.reviewedCondition,
      condition.aiCondition,
      condition.aiStatus,
      condition.requiresOpsReview,
    ]),
    expectedConditions,
  );
});
