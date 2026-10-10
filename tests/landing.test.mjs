import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../assets/landing.css", import.meta.url), "utf8");
const js = readFileSync(new URL("../assets/landing.js", import.meta.url), "utf8");
const languages = ["en", "de", "es", "fr", "it"];
const optionMatches = [...html.matchAll(/<div class="language-option" role="option" id="([^"]+)" data-language="([^"]+)" aria-selected="(?:true|false)">([^<]+)<\/div>/g)];

function element(properties = {}) {
  return {
    id: properties.id ?? "",
    dataset: properties.dataset ?? {},
    textContent: properties.textContent ?? "",
    hidden: properties.hidden ?? false,
    listeners: {},
    attributes: {},
    focusCount: 0,
    addEventListener(name, callback) { this.listeners[name] = callback; },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    getAttribute(name) { return this.attributes[name]; },
    focus() { this.focusCount++; },
    fire(name, props = {}) {
      const event = { key: "", target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...props };
      this.listeners[name]?.(event);
      return event;
    }
  };
}

function render(saved = null, deny = false) {
  const stored = new Map();
  if (saved !== null) stored.set("football-architect:language", saved);
  const options = optionMatches.map(match => element({ id: match[1], dataset: { language: match[2] }, textContent: match[3] }));
  const labels = [...html.matchAll(/data-i18n="([^"]+)"/g)].map(match => element({ dataset: { i18n: match[1] } }));
  const trigger = element({ id: "site-language" });
  const menu = element({ id: "language-options", hidden: true });
  const languageValue = element({ id: "language-value" });
  const status = element({ hidden: true });
  const statusMessage = element();
  const close = element();
  const app = element({ dataset: { destination: "app" } });
  const guide = element({ dataset: { destination: "guide" } });
  const control = element();
  control.contains = target => [control, trigger, menu, ...options].includes(target);
  const byId = {
    "language-control": control, "site-language": trigger, "language-value": languageValue,
    "language-options": menu, "action-status": status, "action-status-message": statusMessage,
    "status-close": close
  };
  const document = {
    documentElement: { lang: "en" },
    listeners: {},
    getElementById(id) { return byId[id] ?? null; },
    querySelectorAll(query) {
      if (query === "[data-language]") return options;
      if (query === "[data-i18n]") return labels;
      if (query === "[data-destination]") return [app, guide];
      return [];
    },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    fire(name, payload) { this.listeners[name]?.(payload); }
  };
  const localStorage = {
    getItem(key) { if (deny) throw Error("storage denied"); return stored.get(key) ?? null; },
    setItem(key, value) { if (deny) throw Error("storage denied"); stored.set(key, value); }
  };
  runInNewContext(js, { document, window: { localStorage } }, { timeout: 2000 });
  return { stored, document, trigger, menu, languageValue, options, labels, status, statusMessage, close, app, guide, control };
}

test("semantic full-page landing and custom five-language listbox", () => {
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /<html lang="en">/);
  assert.deepEqual(optionMatches.map(match => match[2]), languages);
  assert.match(html, /id="site-language" role="combobox"/);
  assert.match(html, /aria-haspopup="listbox"/);
  assert.match(html, /aria-expanded="false" aria-controls="language-options"/);
  assert.match(html, /role="listbox" aria-labelledby="language-label" hidden/);
  assert.doesNotMatch(html, /<select\b/);
  for (const n of ["8", "16", "320"]) assert.match(html, new RegExp('class="number">' + n + '<'));
});

test("first visit defaults to English; saved, invalid and denied preferences behave", () => {
  assert.equal(render().document.documentElement.lang, "en");
  assert.equal(render().languageValue.textContent, "English");
  assert.equal(render("de").languageValue.textContent, "Deutsch");
  assert.equal(render("unsupported").document.documentElement.lang, "en");
  assert.equal(render(null, true).document.documentElement.lang, "en");
});

test("pointer choice updates five languages, selection and persisted preference", () => {
  const r = render();
  for (const [index, language] of languages.entries()) {
    r.trigger.fire("click");
    assert.equal(r.menu.hidden, false);
    assert.equal(r.trigger.getAttribute("aria-expanded"), "true");
    r.options[index].fire("click");
    assert.equal(r.document.documentElement.lang, language);
    assert.equal(r.stored.get("football-architect:language"), language);
    assert.equal(r.languageValue.textContent, r.options[index].textContent);
    assert.equal(r.menu.hidden, true);
    assert.equal(r.trigger.getAttribute("aria-expanded"), "false");
    assert.ok(r.trigger.focusCount > 0);
    for (const [optionIndex, option] of r.options.entries()) {
      assert.equal(option.getAttribute("aria-selected"), String(optionIndex === index));
    }
    for (const label of r.labels) assert.ok(label.textContent.length > 0);
  }
  const denied = render(null, true);
  denied.trigger.fire("click");
  denied.options[3].fire("click");
  assert.equal(denied.document.documentElement.lang, "fr");
});

test("keyboard arrows, Home, End, Enter, Space and Escape are supported", () => {
  const r = render();
  const down = r.trigger.fire("keydown", { key: "ArrowDown" });
  assert.equal(down.defaultPrevented, true);
  assert.equal(r.menu.hidden, false);
  assert.equal(r.trigger.getAttribute("aria-activedescendant"), "language-de");
  r.trigger.fire("keydown", { key: "End" });
  assert.equal(r.trigger.getAttribute("aria-activedescendant"), "language-it");
  r.trigger.fire("keydown", { key: "Home" });
  assert.equal(r.trigger.getAttribute("aria-activedescendant"), "language-en");
  r.trigger.fire("keydown", { key: "ArrowUp" });
  assert.equal(r.trigger.getAttribute("aria-activedescendant"), "language-it");
  r.trigger.fire("keydown", { key: "Enter" });
  assert.equal(r.document.documentElement.lang, "it");
  assert.equal(r.menu.hidden, true);
  r.trigger.fire("keydown", { key: " " });
  assert.equal(r.menu.hidden, false);
  r.trigger.fire("keydown", { key: "Escape" });
  assert.equal(r.menu.hidden, true);
  assert.equal(r.trigger.getAttribute("aria-activedescendant"), undefined);
});

test("outside pointer press, Tab and Escape dismiss without changing the language", () => {
  const r = render("fr");
  r.trigger.fire("click");
  r.document.fire("pointerdown", { target: element() });
  assert.equal(r.menu.hidden, true);
  assert.equal(r.document.documentElement.lang, "fr");
  r.trigger.fire("click");
  r.trigger.fire("keydown", { key: "Tab" });
  assert.equal(r.menu.hidden, true);
  r.trigger.fire("click");
  r.document.fire("keydown", { key: "Escape" });
  assert.equal(r.menu.hidden, true);
});

test("dismissible multilingual notice does not change menu or page flow", () => {
  const r = render();
  r.app.fire("click");
  assert.equal(r.status.hidden, false);
  assert.match(r.statusMessage.textContent, /not available yet/);
  r.trigger.fire("click");
  r.options[4].fire("click");
  assert.match(r.statusMessage.textContent, /non è ancora disponibile/);
  r.guide.fire("click");
  assert.match(r.statusMessage.textContent, /^La guida/);
  r.close.fire("click");
  assert.equal(r.status.hidden, true);
  assert.equal(r.close.getAttribute("aria-label"), "Chiudi avviso");
  assert.match(css, /\.action-status\{position:fixed/);
  assert.match(css, /\.status-close svg\{display:block;width:16px;height:16px;margin:auto\}/);
  assert.match(html, /class="status-close" id="status-close"[^>]*><svg/);
});

test("full-width layout, discreet highlights, transparent scrollbar and responsive controls", () => {
  for (const pattern of [
    /scrollbar-gutter:stable/, /scrollbar-color:var\(--scroll-thumb\) transparent/,
    /-webkit-scrollbar-track\{background:transparent\}/,
    /\.wrapper\{width:100%;max-width:none/,
    /\.statistics\{display:grid;width:100%/,
    /\.language-menu\{position:absolute/, /\.language-menu\[hidden\]\{display:none\}/,
    /\.language-option\[aria-selected="true"\]/,
    /focus-visible/, /min-height:44px/, /max-width:600px/,
    /prefers-reduced-motion:reduce/
  ]) assert.match(css, pattern);
  assert.doesNotMatch(css, /overflow-x:\s*hidden/);
});

test("both favicon formats remain valid and explicitly linked", () => {
  assert.match(html, /href="\.\/favicon\.ico"/);
  assert.match(html, /href="\.\/favicon\.svg"/);
  const ico = readFileSync(new URL("../favicon.ico", import.meta.url));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.ok(ico.length > 100);
  assert.match(readFileSync(new URL("../favicon.svg", import.meta.url), "utf8"), /<svg[^>]*viewBox="0 0 64 64"/);
});
