import test, { before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

let ai;
let client;
let timeouts;
const realFetch = globalThis.fetch;
const oldWindow = globalThis.window;
const oldReader = globalThis.FileReader;
const photos = Array(7).fill("data:image/png;base64,iVBORw0KGgo=");
const expected = {
  containerNumber: "TEST1234567",
  containerType: "40HC",
  carrierCode: "OTHER",
  declaredCondition: "GOOD",
};
const file = { name: "fixture.pdf", type: "application/pdf" };

async function loadTs(relative) {
  const output = await build({
    entryPoints: [fileURLToPath(new URL(relative, import.meta.url))],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    define: { "import.meta.env": "{}" },
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`
  );
}
before(async () => {
  globalThis.window = { location: { origin: "http://local.test" } };
  ai = await loadTs("../src/services/aiService.ts");
  client = await loadTs("../src/services/apiClient.ts");
  globalThis.window = oldWindow;
});
beforeEach(() => {
  timeouts = [];
  globalThis.window = {
    location: { origin: "http://local.test" },
    setTimeout: (_fn, ms) => {
      timeouts.push(ms);
      return 0;
    },
    clearTimeout() {},
  };
  globalThis.FileReader = class {
    readAsDataURL() {
      this.result = "data:application/pdf;base64,JVBERi0xLjQ=";
      queueMicrotask(() => this.onload());
    }
  };
});
afterEach(() => {
  globalThis.fetch = realFetch;
  globalThis.window = oldWindow;
  globalThis.FileReader = oldReader;
});
const respond = (body, status = 200) => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
};

test("missing key is surfaced and never marks eDO as valid", async () => {
  respond(
    {
      code: "AI_KEY_MISSING",
      message: "Chưa cấu hình khóa API cho dịch vụ AI.",
    },
    503,
  );
  const result = await ai.verifyEdoWithAI(file);
  assert.equal(result.status, "MANUAL_REVIEW");
  assert.equal(result.isLegal, false);
  assert.match(result.error, /khóa API/);
  assert.equal(result.requiresOpsReview, true);
});
test("provider manual-review result is not relabeled INVALID", async () => {
  respond({
    status: "MANUAL_REVIEW",
    isLegal: false,
    hasAnomaly: false,
    summary: "Ảnh mờ",
    details: ["Cần ảnh rõ hơn"],
    requiresOpsReview: true,
  });
  const result = await ai.verifyEdoWithAI(file);
  assert.equal(result.status, "MANUAL_REVIEW");
  assert.ok(result.details.includes("Cần ảnh rõ hơn"));
  assert.equal(result.requiresOpsReview, true);
});
test("provider anomaly remains visible", async () => {
  respond({
    status: "ANOMALY",
    isLegal: false,
    hasAnomaly: true,
    summary: "Có dấu hiệu sửa",
    requiresOpsReview: true,
  });
  assert.equal((await ai.verifyEdoWithAI(file)).status, "ANOMALY");
});
test("eDO reported VALID for another container is still rejected against Offer fields", async () => {
  globalThis.fetch = async (_url, init) => {
    const sent = JSON.parse(init.body);
    assert.equal(sent.task, "EDO_LEGALITY_AND_FIELD_EXTRACTION");
    assert.equal(sent.documentType, "EDO");
    assert.equal("expectedEdo" in sent, false);
    return new Response(
      JSON.stringify({
        status: "VALID",
        isLegal: true,
        hasAnomaly: false,
        requiresOpsReview: false,
        documentType: "EDO",
        matchesRegistration: true,
        summary: "eDO hợp lệ.",
        details: [],
        actualContainerNumber: "CMAU2197439",
        actualCarrierCode: "CMA CGM",
        actualContainerType: "20GP",
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  };
  const result = await ai.verifyEdoWithAI(file, {
    containerNumber: "MSKU8421093",
    carrierCode: "MSK",
    containerType: "40HC",
  });
  assert.equal(result.status, "ANOMALY");
  assert.equal(result.matchesRegistration, false);
  assert.equal(result.requiresOpsReview, true);
  assert.deepEqual(result.mismatchedFields, [
    "CONTAINER_NUMBER",
    "CARRIER_CODE",
    "CONTAINER_TYPE",
  ]);
  assert.match(result.mismatchDetails.join(" "), /Số container trên eDO/);
});
test("eDO accepts equivalent logistics labels instead of flagging false mismatches", async () => {
  for (const [
    actualCarrierCode,
    actualContainerType,
    carrierCode,
    containerType,
  ] of [
    ["Evergreen Line", "20'", "EMC", "20GP"],
    ["Evergreen Marine Corp", "20GP (20 foot)", "EMC", "20GP"],
    ["Maersk Line A/S", "40'", "MSK", "40HC"],
    ["Ocean Network Express", "40HQ", "ONE", "40HC"],
    ["COSCO Shipping Line", "20'", "COSCO", "20GP"],
  ]) {
    respond({
      status: "VALID",
      isLegal: true,
      hasAnomaly: false,
      requiresOpsReview: false,
      documentType: "EDO",
      summary: "eDO hợp lệ.",
      details: [],
      actualContainerNumber: "MSKU8421093",
      actualCarrierCode,
      actualContainerType,
    });
    const result = await ai.verifyEdoWithAI(file, {
      containerNumber: "MSKU8421093",
      carrierCode,
      containerType,
    });
    assert.equal(result.status, "VALID", actualCarrierCode);
    assert.equal(result.comparisonStatus, "MATCHED", actualCarrierCode);
    assert.deepEqual(result.mismatchedFields, [], actualCarrierCode);
  }
});
test("eDO cannot pass when AI did not read identity or confirm document type", async () => {
  respond({
    status: "VALID",
    isLegal: true,
    hasAnomaly: false,
    requiresOpsReview: false,
    summary: "Có vẻ hợp lệ.",
    details: [],
  });
  const result = await ai.verifyEdoWithAI(file, {
    containerNumber: "MSKU8421093",
    carrierCode: "MSK",
    containerType: "40HC",
  });
  assert.equal(result.status, "MANUAL_REVIEW");
  assert.equal(result.matchesRegistration, undefined);
  assert.equal(result.requiresOpsReview, true);
  assert.equal((await ai.verifyEdoWithAI(file)).status, "MANUAL_REVIEW");
});
test("a Booking PDF renamed as eDO is flagged for Ops even when its fields match", async () => {
  respond({
    status: "VALID",
    isLegal: true,
    hasAnomaly: false,
    requiresOpsReview: false,
    documentType: "BOOKING",
    summary: "Đọc rõ file.",
    details: [],
    actualContainerNumber: "MSKU8421093",
    actualCarrierCode: "MSK",
    actualContainerType: "40HC",
  });
  const result = await ai.verifyEdoWithAI(file, {
    containerNumber: "MSKU8421093",
    carrierCode: "MSK",
    containerType: "40HC",
  });
  assert.equal(result.status, "ANOMALY");
  assert.equal(result.requiresOpsReview, true);
});
test("eDO read before Offer fields are filled is rechecked when those fields change", async () => {
  respond({
    status: "VALID",
    isLegal: true,
    hasAnomaly: false,
    requiresOpsReview: false,
    documentType: "EDO",
    summary: "eDO rõ ràng.",
    details: [],
    actualContainerNumber: "MSKU 8421093",
    actualCarrierCode: "Maersk Line",
    actualContainerType: "40HQ",
  });
  const pending = await ai.verifyEdoWithAI(file, {});
  assert.equal(pending.status, "MANUAL_REVIEW");
  const matched = ai.reconcileEdoVerificationResult(pending, {
    containerNumber: "MSKU8421093",
    carrierCode: "MSK",
    containerType: "40HC",
  });
  assert.equal(matched.status, "VALID");
  assert.equal(matched.matchesRegistration, true);
  assert.equal(matched.requiresOpsReview, false);
  const changed = ai.reconcileEdoVerificationResult(pending, {
    containerNumber: "MSKU8421093",
    carrierCode: "MSK",
    containerType: "20GP",
  });
  assert.equal(changed.status, "ANOMALY");
});
test("conflicting eDO verdict or explicit Ops flag never becomes automatic success", async () => {
  respond({
    status: "INVALID",
    isLegal: true,
    hasAnomaly: false,
    requiresOpsReview: false,
    summary: "Không hợp lệ.",
  });
  assert.equal((await ai.verifyEdoWithAI(file)).status, "INVALID");
  respond({
    status: "VALID",
    isLegal: true,
    hasAnomaly: false,
    requiresOpsReview: true,
    summary: "Cần xác minh.",
  });
  assert.equal((await ai.verifyEdoWithAI(file)).status, "MANUAL_REVIEW");
});
test("confirmed photo mismatch is not hidden by requiresOpsReview", async () => {
  respond({
    status: "MISMATCH",
    matchesRegistration: false,
    actualCondition: "MINOR_DAMAGE",
    actualConditionNotes: "Vách bị xước.",
    mismatchDetails: ["Tình trạng khác khai báo"],
    summary: "Có vết xước",
    requiresOpsReview: true,
  });
  const result = await ai.verifyContainerPhotosWithAI(photos, expected);
  assert.equal(result.status, "MISMATCH");
  assert.equal(result.actualConditionNotes, "Vách bị xước.");
  assert.equal(result.matchesRegistration, false);
});
test("English AI descriptions are localized before they reach Ops and the Offer form", async () => {
  respond({
    status: "MISMATCH",
    matchesRegistration: false,
    actualCondition: "MINOR_DAMAGE",
    actualConditionNotes:
      "The container shows minor scratches and rust on the left wall.",
    mismatchDetails: ["The condition does not match the registration."],
    summary: "The container shows minor damage.",
    requiresOpsReview: true,
  });
  const result = await ai.verifyContainerPhotosWithAI(photos, expected);
  assert.match(result.summary, /không khớp/);
  assert.match(result.actualConditionNotes, /vết xước/);
  assert.match(result.actualConditionNotes, /rỉ sét/);
  assert.match(result.mismatchDetails[0], /không khớp/);
});
test("all photos and declared identity are sent; AI requests get the longer timeout", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "http://local.test/api/ai/container/verify");
    const sent = JSON.parse(init.body);
    assert.deepEqual(sent.photos, photos);
    assert.deepEqual(sent.expected, expected);
    assert.equal(sent.requiredPhotoCount, 7);
    assert.deepEqual(sent.photoAngles, [
      "front",
      "back_door",
      "left_side",
      "right_side",
      "inside",
      "floor",
      "container_number_plate",
    ]);
    return new Response(
      JSON.stringify({
        status: "OBSERVED",
        actualContainerNumber: expected.containerNumber,
        actualContainerType: expected.containerType,
        actualCarrierCode: expected.carrierCode,
        actualCondition: "GOOD",
        actualConditionNotes: "Vách và cửa nguyên vẹn, không thấy hư hỏng.",
        summary: "Ảnh rõ",
        requiresOpsReview: false,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  };
  assert.equal(
    (await ai.verifyContainerPhotosWithAI(photos, expected)).status,
    "MATCHED",
  );
  assert.deepEqual(timeouts, [120_000]);
});
test("empty or HTML 500 response yields a usable error without displaying server markup", async () => {
  for (const body of ["", "<html>internal proxy error</html>"]) {
    globalThis.fetch = async () => new Response(body, { status: 500 });
    const result = await ai.verifyEdoWithAI(file);
    assert.match(result.error, /Máy chủ xử lý chưa sẵn sàng/);
    assert.ok(!result.error.includes("<html>"));
  }
});
test("a 200 HTML fallback or malformed JSON never becomes a clean inspection", async () => {
  for (const response of [
    new Response("<html>index page</html>"),
    new Response("{}", { headers: { "Content-Type": "application/json" } }),
  ]) {
    globalThis.fetch = async () => response;
    assert.equal((await ai.inspectContainerWithAI(photos)).success, false);
  }
});
test("API error code and status are preserved for configuration diagnostics", async () => {
  respond({ code: "AI_KEY_REJECTED", message: "Khóa AI không hợp lệ." }, 503);
  await assert.rejects(
    client.postApi("/api/ai/edo/verify", {}),
    (error) => error.code === "AI_KEY_REJECTED" && error.status === 503,
  );
});

const bookingExpected = {
  bookingNumber: "BK-12345",
  carrierCode: "MSK",
  containerType: "40HC",
  cutOffTime: "2026-10-20T23:59:59",
};
const bookingObserved = {
  status: "VALID",
  isLegal: true,
  hasAnomaly: false,
  requiresOpsReview: false,
  summary: "Booking rõ ràng.",
  details: [],
  documentType: "BOOKING",
  actualBookingNumber: "BK12345",
  actualCarrierCode: "Maersk Line",
  actualContainerType: "40HQ",
  actualCutOffDate: "20/10/2026",
};

test("Booking matches normalized booking number, carrier, type and dd/mm/yyyy cut-off", async () => {
  globalThis.fetch = async (_url, init) => {
    const sent = JSON.parse(init.body);
    assert.equal(sent.documentType, "BOOKING");
    assert.equal(sent.task, "BOOKING_LEGALITY_AND_FIELD_EXTRACTION");
    assert.equal(sent.expected, undefined);
    return new Response(JSON.stringify(bookingObserved), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const result = await ai.verifyBookingWithAI(file, bookingExpected);
  assert.equal(result.status, "VALID");
  assert.equal(result.comparisonStatus, "MATCHED");
  assert.equal(result.requiresOpsReview, false);
});

test("Booking accepts carrier and container aliases found on logistics documents", async () => {
  respond({
    ...bookingObserved,
    actualCarrierCode: "Maersk Line A/S",
    actualContainerType: "40'",
  });
  const result = await ai.verifyBookingWithAI(file, {
    ...bookingExpected,
    carrierCode: "MSK",
    containerType: "40HC",
  });
  assert.equal(result.status, "VALID");
  assert.equal(result.comparisonStatus, "MATCHED");
  assert.deepEqual(result.mismatchedFields, []);
  assert.equal(result.requiresOpsReview, false);
});

for (const [field, value, flagged] of [
  ["bookingNumber", "BK99999", "BOOKING_NUMBER"],
  ["carrierCode", "ONE", "CARRIER_CODE"],
  ["containerType", "20GP", "CONTAINER_TYPE"],
  ["cutOffTime", "2026-10-21T00:00:00", "CUT_OFF_TIME"],
]) {
  test(`Booking ${field} changes after scan: both create/edit must become a mismatch`, async () => {
    respond(bookingObserved);
    const observed = await ai.verifyBookingWithAI(file, bookingExpected);
    const changed = ai.reconcileBookingVerificationResult(observed, {
      ...bookingExpected,
      [field]: value,
    });
    assert.equal(changed.status, "ANOMALY");
    assert.equal(changed.isLegal, false);
    assert.equal(changed.requiresOpsReview, true);
    assert.ok(changed.mismatchedFields.includes(flagged));
    assert.equal(
      ai.reconcileBookingVerificationResult(changed, bookingExpected).status,
      "VALID",
    );
  });
}

test("Booking uploaded before typing is pending; it can match after fields are filled", async () => {
  respond(bookingObserved);
  const pending = await ai.verifyBookingWithAI(file, {});
  assert.equal(pending.status, "MANUAL_REVIEW");
  assert.equal(
    ai.reconcileBookingVerificationResult(pending, bookingExpected).status,
    "VALID",
  );
});
test("Booking missing identity, document type or cut-off never auto succeeds", async () => {
  for (const field of [
    "actualBookingNumber",
    "actualCarrierCode",
    "actualContainerType",
    "actualCutOffDate",
    "documentType",
  ]) {
    respond({ ...bookingObserved, [field]: "" });
    const result = await ai.verifyBookingWithAI(file, bookingExpected);
    assert.equal(result.status, "MANUAL_REVIEW", field);
    assert.equal(result.requiresOpsReview, true, field);
  }
});
test("Booking provider anomaly remains after all manually entered fields match", async () => {
  respond({
    ...bookingObserved,
    status: "ANOMALY",
    hasAnomaly: true,
    isLegal: false,
    requiresOpsReview: true,
    summary: "Có dấu hiệu chắp vá chứng từ.",
  });
  const result = await ai.verifyBookingWithAI(file, bookingExpected);
  assert.equal(
    ai.reconcileBookingVerificationResult(result, bookingExpected).status,
    "ANOMALY",
  );
});
test("wrong document and transient error stay in the Booking flow, not eDO copy", async () => {
  respond({ ...bookingObserved, documentType: "EDO" });
  assert.equal(
    (await ai.verifyBookingWithAI(file, bookingExpected)).status,
    "ANOMALY",
  );
  respond(
    { message: "Dịch vụ AI đang bận.", code: "AI_PROVIDER_UNAVAILABLE" },
    502,
  );
  const result = await ai.verifyBookingWithAI(file, bookingExpected);
  assert.equal(result.success, false);
  assert.equal(result.requiresOpsReview, true);
  assert.match(result.summary, /Booking/);
  assert.doesNotMatch(result.summary, /eDO/);
});
test("bare VALID without explicit verdict cannot approve a document", async () => {
  respond({ ...bookingObserved, isLegal: undefined });
  assert.equal(
    (await ai.verifyBookingWithAI(file, bookingExpected)).status,
    "MANUAL_REVIEW",
  );
  respond({ ...bookingObserved, hasAnomaly: undefined });
  assert.equal(
    (await ai.verifyBookingWithAI(file, bookingExpected)).status,
    "MANUAL_REVIEW",
  );
});
const photoObserved = {
  status: "OBSERVED",
  actualContainerNumber: "TGBU2415784",
  actualContainerType: "40HQ",
  actualCarrierCode: "Maersk Line",
  actualCondition: "GOOD",
  actualConditionNotes: "Vách và cửa nguyên vẹn.",
  summary: "Đã đọc ảnh.",
  requiresOpsReview: false,
};
test("photo OCR check digit is never rewritten to match the registration", async () => {
  respond(photoObserved);
  const result = await ai.verifyContainerPhotosWithAI(photos, {
    ...expected,
    containerNumber: "TGBU2415789",
    carrierCode: "MSK",
  });
  assert.equal(result.status, "MISMATCH");
  assert.equal(result.actualContainerNumber, "TGBU2415784");
  assert.equal(result.requiresOpsReview, true);
});
test("photo OCR accepts spacing in a correctly recognized container number", async () => {
  respond({
    ...photoObserved,
    status: "MISMATCH",
    matchesRegistration: false,
    actualContainerNumber: "TGBU 241578 9",
    mismatchDetails: [
      "Ảnh nhận diện số cont TGBU 241578 9 không khớp TGBU2415789.",
    ],
  });
  const result = await ai.verifyContainerPhotosWithAI(photos, {
    containerNumber: "TGBU2415789",
    containerType: "40HC",
    carrierCode: "MSK",
    declaredCondition: "GOOD",
  });
  assert.equal(result.status, "MATCHED");
  assert.equal(result.matchesRegistration, true);
  assert.equal(result.actualContainerNumber, "TGBU2415789");
  assert.equal(result.mismatchDetails.length, 0);
});
test("photo scan reports each missing angle while keeping the detected condition", async () => {
  respond({
    ...photoObserved,
    missingAngles: ["left_side", "floor"],
    actualCondition: "GOOD",
    actualConditionNotes: "Ảnh cho thấy vỏ sạch, chưa thấy hư hỏng rõ.",
  });
  const result = await ai.verifyContainerPhotosWithAI(photos, {
    ...expected,
    containerNumber: "TGBU2415784",
    carrierCode: "MSK",
  });
  assert.equal(result.status, "INSPECTION_INCOMPLETE");
  assert.equal(result.actualCondition, "GOOD");
  assert.equal(
    result.actualConditionNotes,
    "Ảnh cho thấy vỏ sạch, chưa thấy hư hỏng rõ.",
  );
  assert.deepEqual(result.missingAngles, ["left_side", "floor"]);
  assert.match(result.mismatchDetails[0], /Mặt trái/);
  assert.match(result.mismatchDetails[0], /Mặt sàn/);
});
test("photo provider MATCHED without observed identity/condition is manual review", async () => {
  for (const field of [
    "actualContainerNumber",
    "actualCarrierCode",
    "actualContainerType",
    "actualCondition",
    "actualConditionNotes",
  ]) {
    respond({
      ...photoObserved,
      status: "MATCHED",
      matchesRegistration: true,
      [field]: "",
    });
    const result = await ai.verifyContainerPhotosWithAI(photos, {
      ...expected,
      containerNumber: "TGBU2415784",
      carrierCode: "MSK",
    });
    assert.equal(result.status, "MANUAL_REVIEW", field);
    assert.equal(result.matchesRegistration, false, field);
  }
});
test("photo comparison supports carrier/type aliases and retains actual Vietnamese description", async () => {
  respond(photoObserved);
  const result = await ai.verifyContainerPhotosWithAI(photos, {
    ...expected,
    containerNumber: "TGBU2415784",
    carrierCode: "MSK",
  });
  assert.equal(result.status, "MATCHED");
  assert.equal(result.actualConditionNotes, photoObserved.actualConditionNotes);
});
test("API failure cannot manufacture a physical condition description", async () => {
  respond({ message: "Dịch vụ AI đang bận." }, 502);
  const result = await ai.verifyContainerPhotosWithAI(photos, expected);
  assert.equal(result.status, "MANUAL_REVIEW");
  assert.equal(result.actualConditionNotes, undefined);
  assert.equal(result.actualCondition, undefined);
});

test("Ops AI evidence summarizes eDO and photo findings without a long transcript", async () => {
  const review = await loadTs("../src/services/offerReview.ts");
  const evidence = review.getOfferAiReviewEvidence({
    id: "OFR-TEST",
    asset: {
      containerNumber: "TGBU2415789",
      carrierCode: "EMC",
      containerType: "40HC",
    },
    aiCheck: {
      passed: false,
      score: 62,
      summary: "eDO cần xác minh và ảnh có sai lệch.",
      hasAnomaly: true,
      edoAnomaly: true,
      edoMatchesRegistration: false,
      edoMismatchDetails: ["Hãng tàu trên eDO không khớp hãng đã chọn."],
      edoActualContainerNumber: "TGBU2415789",
      edoActualCarrierCode: "EMC",
      edoActualContainerType: "40HC",
      photoStatus: "MISMATCH",
      missingAngles: ["left_side", "floor"],
      matchesRegistration: false,
      actualContainerNumber: "TGBU2415789",
      actualContainerType: "40HC",
      actualCarrierCode: "EMC",
      photoCondition: "MINOR_DAMAGE",
      photoConditionNotes: "Vách trái có xước nhẹ và rỉ sét cục bộ.",
      mismatchDetails: ["Tình trạng thực tế khác tình trạng khai báo."],
      details: ["Cần Ops đối chiếu lại bộ ảnh và eDO."],
      verificationStatus: "MANUAL_REVIEW",
    },
  });
  assert.ok(evidence.some((item) => item.includes("Hãng tàu trên eDO")));
  assert.ok(evidence.some((item) => item.includes("Tình trạng thực tế")));
  assert.ok(evidence.some((item) => item.includes("Mặt trái") || item.includes("Vách trái")));
  assert.ok(evidence.length <= 4);
});

test("saved Booking comparison is identical for requester and Ops, including errors", async () => {
  const review = await loadTs("../src/services/bookingReview.ts");
  respond(bookingObserved);
  const result = await ai.verifyBookingWithAI(file, {
    ...bookingExpected,
    bookingNumber: "OTHER-BOOKING",
  });
  const saved = JSON.parse(JSON.stringify(review.mapBookingAiResult(result)));
  assert.equal(review.bookingNeedsOpsReview(saved), true);
  assert.match(review.getBookingAiReviewTitle(saved), /Số Booking không khớp/);
  assert.ok(
    review
      .getBookingAiEvidence(saved)
      .some((value) => value.includes("OTHER-BOOKING")),
  );
  assert.equal(
    review.reconcileBookingAiCheck(saved, bookingExpected).isValid,
    true,
  );
  assert.equal(
    review.bookingNeedsOpsReview({ status: "VALID", isValid: true }),
    true,
  );
});

test("blank or transparent images are not eligible for OCR", () => {
  assert.equal(
    ai.isBlankImagePixels(
      new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255]),
    ),
    true,
  );
  assert.equal(
    ai.isBlankImagePixels(new Uint8ClampedArray([0, 0, 0, 0, 255, 0, 0, 0])),
    true,
  );
  assert.equal(
    ai.isBlankImagePixels(
      new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]),
    ),
    false,
  );
});
