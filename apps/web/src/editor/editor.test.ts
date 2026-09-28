/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { docToPlainText } from "@ink/schemas";
import { countCharacters, countWords } from "./counts.ts";
import { plainTextToDoc } from "./paste.ts";

test("words are counted in English, Hindi and Hinglish", () => {
  assert.equal(countWords("The kettle clicks off"), 4);
  assert.equal(countWords("पिता के हाथों में लोहे की गंध थी,"), 8);
  assert.equal(countWords("Yaar, aaj phir chai thandi ho gayi."), 7);
  assert.equal(countWords(""), 0);
});

test("a Devanagari conjunct counts as one visible character", () => {
  assert.equal(countCharacters("क्ष"), 1);
  assert.equal(countCharacters("हाथों"), 2);
  assert.equal(countCharacters("a b"), 2);
});

test("pasted plain text keeps stanzas, lines and indentation", () => {
  const text = "The kettle clicks off\n    and for a second the house\n\n\nA little bit of steam,\n\ta little bit of silence";
  const doc = plainTextToDoc(text);
  assert.equal(doc.content?.length, 2);
  assert.equal(docToPlainText(doc), "The kettle clicks off\n    and for a second the house\n\nA little bit of steam,\n\ta little bit of silence");
});

test("Windows line endings and a *** line become stanzas and a scene break", () => {
  const doc = plainTextToDoc("one\r\n\r\n***\r\n\r\ntwo");
  assert.deepEqual(
    doc.content?.map((n) => n.type),
    ["paragraph", "horizontalRule", "paragraph"]
  );
});

test("a line with only spaces between stanzas still separates them", () => {
  assert.equal(plainTextToDoc("a\n   \nb").content?.length, 2);
});
