import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const countries = ["SCO", "CAN", "POL"];
const latinSurname = /^(?:\p{Script=Latin}\p{M}*)+(?:[ '\u2019-](?:\p{Script=Latin}\p{M}*)+)*$/u;
const latinMark = /\p{Script_Extensions=Latin}/u;
const marks = /\p{M}/gu;

function validSurname(value) {
  return typeof value === "string" && value.length > 0
    && value === value.normalize("NFC")
    && latinSurname.test(value)
    && [...value.matchAll(marks)].every(([mark]) => latinMark.test(mark));
}
function noWeightKeys(value) {
  if (Array.isArray(value)) {
    for (const item of value) noWeightKeys(item);
  } else if (value !== null && typeof value === "object") {
    assert.ok(!Object.hasOwn(value, "weight"), "No weight property is permitted anywhere");
    for (const nested of Object.values(value)) noWeightKeys(nested);
  }
}
function readBank(country) {
  return JSON.parse(readFileSync(
    path.join(root, "data", "players", "surnames", "countries", country + ".json"),
    "utf8",
  ));
}

for (const country of countries) {
  test(country + ": schema, 500 unique NFC Latin surnames, uniformity and provenance", () => {
    const bank = readBank(country);
    assert.deepEqual(Object.keys(bank).sort(), [
      "schema_version", "code", "kind", "selection_policy",
      "sources", "surnames", "production_ready",
    ].sort());
    assert.equal(bank.schema_version, 1);
    assert.equal(bank.code, country);
    assert.equal(bank.kind, "surnames");
    assert.equal(bank.selection_policy, "uniform");
    assert.equal(bank.production_ready, false);

    assert.ok(Array.isArray(bank.sources) && bank.sources.length >= 1);
    assert.ok(bank.sources[0].url.includes(
      country === "SCO" ? "/scotland/" : country === "CAN" ? "/canada/" : "/poland/"
    ), "Primary source must be country-specific");
    for (const source of bank.sources) {
      assert.equal(typeof source.id, "string");
      assert.ok(source.id.length > 0);
      assert.match(source.url, /^https:\/\/\S+$/);
      assert.equal(typeof source.notes, "string");
      assert.ok(source.notes.length >= 25);
    }

    assert.ok(Array.isArray(bank.surnames));
    assert.equal(bank.surnames.length, 500);
    const seen = new Set();
    for (const surname of bank.surnames) {
      assert.deepEqual(Object.keys(surname), ["value"], "Only a value key is allowed");
      assert.ok(validSurname(surname.value), "Invalid NFC Latin surname: " + surname.value);
      const key = surname.value.toLocaleLowerCase("und");
      assert.ok(!seen.has(key), "Duplicate surname: " + surname.value);
      seen.add(key);
    }
    assert.equal(seen.size, 500);
    noWeightKeys(bank);
    assert.ok(!JSON.stringify(bank).includes('"weight"'), "No weight is allowed in serialized JSON");
  });
}

test("strict Latin-only parser: authentic particles, apostrophes, hyphens, Polish accents", () => {
  for (const valid of ["O'Neill", "O’Neill", "MacDonald", "van der Meer",
    "Saint-Pierre", "Kowalczyk", "Dąbrowski", "Łoś", "Żółć", "Évrard"]) {
    assert.ok(validSurname(valid), "Expected accepted form: " + valid);
  }
});

test("strict Latin-only parser: reject mixed scripts, compound errors and non-NFC", () => {
  for (const invalid of [
    "", "Сmith", "Smith李", "Αdams", "عبدالله", "Kowalski1",
    "Smith  Jones", " O'Neill", "O''Brien", "Smith--Jones", "Jean/Paul",
    "Müller\u200D", "Cafe\u0301", "A\u0483",
  ]) {
    assert.equal(validSurname(invalid), false, "Incorrectly accepted: " + invalid);
  }
});

test("source-specific safeguards", () => {
  const sco = readBank("SCO").surnames.map(({ value }) => value);
  const can = readBank("CAN").surnames.map(({ value }) => value);
  const pol = readBank("POL").surnames.map(({ value }) => value);
  assert.ok(sco.includes("MacDonald") && sco.includes("O'Neill"));
  assert.ok(can.includes("Tremblay") && can.includes("Singh"));
  assert.ok(pol.includes("Kruk") && pol.includes("Zagórski"));
  assert.ok(pol.some(v => /[ąćęłńóśźż]/u.test(v)), "Polish diacritics must be preserved");
});
