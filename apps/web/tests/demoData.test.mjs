import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

async function loadDemoDatasetSummary() {
  const source = `
    import { INITIAL_OFFERS, INITIAL_REQUESTS, INITIAL_TRANSACTIONS } from './data/mockData';
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
