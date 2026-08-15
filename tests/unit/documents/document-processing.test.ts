import { test } from "node:test";
import assert from "node:assert";

import {
  initialHasPages,
  PAGE_BASED_DOCUMENT_TYPES,
  shouldHavePages,
} from "@/shared/utils/documents/document-processing";
import {
  buildAttachmentDispositionForName,
  buildInlineContentDisposition,
  buildInlineDispositionForName,
} from "@/shared/utils/files/filename";

test("shouldHavePages identifies page-based document types", async (t) => {
  for (const type of PAGE_BASED_DOCUMENT_TYPES) {
    await t.test(`${type} should have pages`, () => {
      assert.strictEqual(shouldHavePages(type), true);
    });
  }

  await t.test("non-page types should not have pages", () => {
    assert.strictEqual(shouldHavePages("image"), false);
    assert.strictEqual(shouldHavePages("sheet"), false);
    assert.strictEqual(shouldHavePages("html"), false);
    assert.strictEqual(shouldHavePages("video"), false);
  });

  await t.test("null/undefined types should not have pages", () => {
    assert.strictEqual(shouldHavePages(null), false);
    assert.strictEqual(shouldHavePages(undefined), false);
    assert.strictEqual(shouldHavePages(""), false);
  });
});

test("initialHasPages: page-based uploads start with hasPages=false", async (t) => {
  await t.test("pdf starts unprocessed", () => {
    assert.strictEqual(initialHasPages("pdf"), false);
  });

  await t.test("docs/slides/cad start unprocessed", () => {
    assert.strictEqual(initialHasPages("docs"), false);
    assert.strictEqual(initialHasPages("slides"), false);
    assert.strictEqual(initialHasPages("cad"), false);
  });

  await t.test("non-page types start processed", () => {
    assert.strictEqual(initialHasPages("image"), true);
    assert.strictEqual(initialHasPages("sheet"), true);
    assert.strictEqual(initialHasPages("html"), true);
  });
});

test("buildInlineContentDisposition produces inline disposition", () => {
  const disposition = buildInlineContentDisposition(
    "My File.pdf",
    "my-file.pdf",
  );
  assert.ok(disposition.startsWith("inline; "));
  assert.ok(disposition.includes('filename="my-file.pdf"'));
  assert.ok(disposition.includes("filename*=UTF-8''My%20File.pdf"));
});

test("buildAttachmentDispositionForName produces attachment disposition", () => {
  const disposition = buildAttachmentDispositionForName("My File.pdf");
  assert.ok(disposition.startsWith("attachment; "));
  assert.ok(disposition.includes('filename="my-file.pdf"'));
});

test("buildInlineDispositionForName keeps a safe extension", () => {
  const disposition = buildInlineDispositionForName("report FINAL.pdf");
  assert.ok(disposition.startsWith("inline; "));
  assert.ok(disposition.includes(".pdf"));
  assert.ok(disposition.includes("report-final.pdf"));
});

test("buildInlineDispositionForName drops unsafe characters from the slug", () => {
  const disposition = buildInlineDispositionForName('quo"te & <file>.pdf');
  assert.ok(disposition.includes('filename="'));
  // The quoted filename must not contain the raw quote character.
  assert.ok(!/"quo"/.test(disposition));
  // The original name is still preserved via filename*.
  assert.ok(disposition.includes("filename*=UTF-8''"));
});
