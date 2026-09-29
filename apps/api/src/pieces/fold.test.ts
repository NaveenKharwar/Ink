import assert from "node:assert/strict";
import { test } from "node:test";
import { describeMatch, evenDevanagari, loosen, openingLines, romanize, searchText, searchWords } from "./fold.js";

// A query matches stored search text the way the database does: every word, in either copy.
function finds(title: string | null, text: string, query: string): boolean {
  const stored = searchText(title, text);
  const words = searchWords(query);
  const all = (list: string[]) => list.every((w) => w && stored.includes(w));
  return all(words.even) || all(words.latin);
}

test("Hindi is spelled the way it is usually typed", () => {
  assert.equal(romanize("चाँद"), "chaand");
  assert.equal(romanize("देखता"), "dekhtaa");
  assert.equal(romanize("कमल"), "kamal");
  assert.equal(romanize("तुम्हारी"), "tumhaarii");
  assert.equal(romanize("समझना"), "samajhnaa");
  assert.equal(romanize("ज़िंदगी"), "jindagii");
  assert.equal(romanize("Monsoon again. बारिश"), "Monsoon again. baarish");
});

test("loose spelling brings common typings together", () => {
  assert.equal(loosen("chaand"), loosen("chand"));
  assert.equal(loosen("dhoop"), loosen("dhup"));
  assert.equal(loosen("yaadein"), loosen(romanize("यादें")));
  assert.equal(loosen("zindagi"), loosen(romanize("ज़िंदगी")));
  assert.equal(loosen("meetha"), loosen(romanize("मीठा")));
});

test("Devanagari spellings are evened out", () => {
  assert.equal(evenDevanagari("चाँद"), evenDevanagari("चांद"));
  assert.equal(evenDevanagari("ज़रा"), evenDevanagari("जरा"));
});

test("search finds writing by the words you remember", () => {
  const poem = "छत पर बैठा चाँद देखता रहा\nतुम्हारी यादें आती रहीं";
  for (const q of ["चाँद", "चांद", "चाँ", "याद", "chaand", "chand", "dekhta", "yaadein", "tumhari", "chand yaadein"]) {
    assert.ok(finds(null, poem, q), q);
  }
  for (const q of ["ghar", "सूरज", "chand ghar"]) assert.ok(!finds(null, poem, q), q);

  const english = "The moonlight on the terrace,\nand your letters I never sent";
  for (const q of ["moonl", "Terr", "letters sent", "MOON"]) assert.ok(finds(null, english, q), q);
  assert.ok(!finds(null, english, "moonlihgt"));
  assert.ok(finds("Platform 4", "chai-wala knows my face", "platform"));
});

test("a result shows its first line and the line the words were found in", () => {
  const text = "The kettle clicks off\nand for a second the house\nremembers you —";
  const found = describeMatch(text, "house");
  assert.deepEqual(found.firstLine, { text: "The kettle clicks off", marks: [] });
  assert.deepEqual(found.match, { text: "and for a second the house", marks: [[21, 26]] });

  const same = describeMatch(text, "kett");
  assert.deepEqual(same.firstLine.marks, [[4, 10]]);
  assert.equal(same.match, null);

  const hindi = describeMatch("पहली पंक्ति\nछत पर बैठा चाँद", "chand");
  assert.equal(hindi.match?.text, "छत पर बैठा चाँद");
  assert.deepEqual(hindi.match?.marks, [[11, 15]]);
});

test("lists show the first two lines with words in them", () => {
  assert.deepEqual(openingLines("\nOne\n\nTwo\nThree"), ["One", "Two"]);
});
