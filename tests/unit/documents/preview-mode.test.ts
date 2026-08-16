import { test } from "node:test";
import assert from "node:assert";

import { partitionPageNumbers } from "@/shared/utils/documents/page-request";
import {
  resolvePreviewMode,
  PreviewResolveInput,
} from "@/shared/utils/documents/preview-mode";

function resolve(overrides: Partial<PreviewResolveInput> = {}) {
  return resolvePreviewMode({
    type: "pdf",
    file: "doc_team_x/Hemachandra_Reddy_Resume.pdf",
    hasPages: false,
    numPages: 1,
    generatedPageCount: 0,
    ...overrides,
  });
}

test("preview mode: fully generated 1-page PDF serves the page viewer", () => {
  const mode = resolve({ hasPages: true, numPages: 1, generatedPageCount: 1 });
  assert.strictEqual(mode.mode, "pages");
  assert.strictEqual(mode.isProcessing, false);
});

test("preview mode: hasPages=true + zero DocumentPages + PDF falls back to raw PDF", () => {
  // The exact legacy broken state (document cmstyd86e0004lhc522dkaifw):
  // hasPages=true, numPages=1, but zero DocumentPage rows exist.
  const mode = resolve({ hasPages: true, numPages: 1, generatedPageCount: 0 });
  assert.strictEqual(mode.mode, "pdf");
  assert.strictEqual(mode.isProcessing, true);
});

test("preview mode: hasPages=true + zero pages never resolves to the page viewer", () => {
  const mode = resolve({ hasPages: true, numPages: 3, generatedPageCount: 0 });
  assert.notStrictEqual(mode.mode, "pages");
});

test("preview mode: hasPages=false PDF (converting) falls back to raw PDF", () => {
  const mode = resolve({ hasPages: false, numPages: 1, generatedPageCount: 0 });
  assert.strictEqual(mode.mode, "pdf");
  assert.strictEqual(mode.isProcessing, true);
});

test("preview mode: partial 10/20 generated pages is still processing, not ready", () => {
  const mode = resolve({ hasPages: true, numPages: 20, generatedPageCount: 10 });
  assert.strictEqual(mode.mode, "pdf");
  assert.strictEqual(mode.isProcessing, true);
});

test("preview mode: generated pages equal numPages but hasPages=false is not ready", () => {
  // The task flips hasPages only after all rows exist; a mismatch means the
  // document is mid-flight, so never claim the page viewer.
  const mode = resolve({ hasPages: false, numPages: 2, generatedPageCount: 2 });
  assert.notStrictEqual(mode.mode, "pages");
});

test("preview mode: numPages missing means not ready even with pages present", () => {
  const mode = resolve({ hasPages: true, numPages: null, generatedPageCount: 3 });
  assert.strictEqual(mode.mode, "pdf");
  assert.strictEqual(mode.isProcessing, true);
});

test("preview mode: docs/slides not ready surface a processing message", () => {
  const mode = resolve({
    type: "docs",
    file: "doc_team_x/Hemachandra_Reddy_Resume.docx",
    hasPages: true,
    numPages: 5,
    generatedPageCount: 0,
  });
  assert.strictEqual(mode.mode, "processing");
  assert.strictEqual(mode.isProcessing, true);
});

test("preview mode: non-page types are left to the type-specific handlers", () => {
  const mode = resolve({
    type: "image",
    file: "doc_team_x/photo.jpg",
    hasPages: true,
    numPages: 1,
  });
  assert.strictEqual(mode.mode, "unsupported");
  assert.strictEqual(mode.isProcessing, false);
});

test("preview mode: a plain pdf file outside page-based types renders inline", () => {
  const mode = resolve({
    type: "other",
    file: "some/document.PDF",
    hasPages: false,
    numPages: 1,
  });
  assert.strictEqual(mode.mode, "pdf");
  assert.strictEqual(mode.isProcessing, false);
});

test("partitionPageNumbers reports every requested page as missing when none found", () => {
  const { found, missing } = partitionPageNumbers([1], []);
  assert.deepStrictEqual(found, []);
  assert.deepStrictEqual(missing, [1]);
});

test("partitionPageNumbers splits resolved and missing pages", () => {
  const { found, missing } = partitionPageNumbers([1, 2, 3, 4], [2, 4]);
  assert.deepStrictEqual(found, [2, 4]);
  assert.deepStrictEqual(missing, [1, 3]);
});

test("partitionPageNumbers handles duplicates and unknown page numbers", () => {
  const { found, missing } = partitionPageNumbers([1, 1, 5], [1]);
  assert.deepStrictEqual(found, [1]);
  assert.deepStrictEqual(missing, [5]);
});
