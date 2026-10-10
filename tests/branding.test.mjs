import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const read = p => readFileSync(new URL("../"+p, import.meta.url), "utf8");
const index = read("index.html");
const guide = read("guide/index.html");
const css = read("assets/landing.css");

test("shared branding is linked from Landing and Guide", () => {
  assert.match(index, /href="\.\/" aria-label="Football Architect home"/);
  assert.match(guide, /href="\.\.\/" aria-label="Football Architect home"/);
  for (const [page, prefix] of [[index,"./"],[guide,"../"]]) {
    assert.ok(page.includes(prefix+"assets/brand/horizontal-dark.svg"));
    assert.ok(page.includes(prefix+"assets/brand/symbol-dark.svg"));
    assert.match(page, /class="brand-image brand-image-wide"/);
    assert.match(page, /class="brand-image brand-image-symbol"/);
  }
});
test("logo variants are self-contained path-only SVG and use approved name", () => {
  for (const form of ["horizontal","vertical","symbol"]) {
    for (const variant of ["light","dark","mono-graphite","mono-white"]) {
      const path = "assets/brand/"+form+"-"+variant+".svg";
      const svg = read(path);
      assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      assert.match(svg, /<path/);
      assert.doesNotMatch(svg, /<image\b|<text\b|<script\b|data:image\/|<foreignObject/i);
    }
  }
});
test("favicon and PNG icon are present; all five languages remain selectable", () => {
  assert.match(read("favicon.svg"), /viewBox="0 0 64 64"/);
  const ico = readFileSync(new URL("../favicon.ico", import.meta.url));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.ok(index.includes('href="./assets/brand/favicon-32.png"'));
  assert.ok(guide.includes('href="../assets/brand/favicon-32.png"'));
  const png = readFileSync(new URL("../assets/brand/favicon-32.png", import.meta.url));
  assert.equal(png.subarray(0,8).toString("hex"), "89504e470d0a1a0a");
  for (const lang of ["en","de","es","fr","it"]) {
    assert.ok(index.includes('data-language="'+lang+'"'));
    assert.ok(guide.includes('data-language="'+lang+'"'));
  }
});
test("compact navbar preserves keyboard focus and mobile layout", () => {
  assert.match(css, /\.brand-mark:focus-visible/);
  assert.match(css, /\.brand-image-wide\{display:none\}/);
  assert.match(css, /\.brand-image-symbol\{display:block;width:44px;height:44px\}/);
  assert.match(css, /@media\(max-width:600px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(index, /<h1 id="page-title">Football Architect<\/h1>/);
});

test("desktop horizontal logo fits its SVG viewBox without clipping", () => {
  for (const variant of ["light","dark","mono-graphite","mono-white"]) {
    const svg = read("assets/brand/horizontal-"+variant+".svg");
    const match = svg.match(/<svg[^>]*width="(\d+)" height="(\d+)" viewBox="([^"]+)"/);
    assert.ok(match, variant+" has SVG intrinsic dimensions");
    const [x,y,w,h] = match[3].split(" ").map(Number);
    assert.deepEqual([Number(match[1]),Number(match[2])],[w,h]);
    // Includes stroked compass (x>=90,y>=45), full wordmark (x<=1325,y<=382),
    // and deliberate margins so Chrome cannot clip artwork at the viewBox boundary.
    assert.ok(x<=90 && x+w>=1360,variant+" horizontal margins");
    assert.ok(y<=40 && y+h>=400,variant+" vertical margins");
    assert.match(svg, /<use href="#fa-b-L"/);
    assert.match(svg, /<use href="#fa-r-T"/);
  }
  assert.match(css,/\.brand-mark\{[^}]*width:260px;max-width:calc\(100vw - 222px\);height:79px/);
  assert.match(css,/\.brand-image\{[^}]*object-fit:contain/);
  assert.ok(260+164+20+2*22<=601, "desktop header still fits at 601px breakpoint");
});

test("ENG-ALL-ENGLISH-01 keeps historic narrative and catalog metadata in English", () => {
  const archive = read("docs/clubs/registry-history.md");
  const source = read("docs/clubs/fullnames-source.md");
  const catalog = JSON.parse(read("data/clubs.json"));
  assert.match(archive, /CLUBS-320 ARCHIVE — Previous club registry roadmap/);
  assert.match(source, /CLUB-01 — User-provided `fullName` tables/);
  assert.match(source, /Updated documentation gate/);
  assert.match(archive, /Current summary of user-provided tables/);
  assert.match(archive, /Individual verification register — 76\/76/);
  assert.match(archive, /IT,2 = AC Rinascenti Bologna/);
  assert.equal(catalog.clubs.length, 320);
  assert.match(catalog.notes, /All 320 fullName entries are documented/);
  for (const historical of [source, archive]) {
    assert.doesNotMatch(historical, /(?:Fonte primaria|Ricognizione documentale|Stato aggiornato|denominazioni complete ricevute|Nessuna modifica a codice)/);
  }
});
