// Generates checked-in static app pages from the shared shell (Node.js 22, no npm).
import {readFileSync, writeFileSync} from "node:fs";

const template = readFileSync(new URL("../templates/app-page.html", import.meta.url), "utf8");
const pages = {
  "dashboard": {
    "@@FA_LINE_008@@": "  <title>Dashboard — Football Architect</title>",
    "@@FA_LINE_032@@": "            <a class=\"fa-shell-link is-active\" id=\"app-nav-dashboard\" href=\"./\" data-app-view=\"dashboard\" aria-current=\"page\" aria-label=\"Dashboard\" data-app-aria=\"dashboard\">",
    "@@FA_LINE_036@@": "            <a class=\"fa-shell-link\" id=\"app-nav-calendar\" href=\"../calendar/\" data-app-view=\"calendar\" aria-label=\"Calendar\" data-app-aria=\"calendar\">",
    "@@FA_LINE_044@@": "            <a class=\"fa-shell-link\" id=\"app-nav-settings\" href=\"../settings/\" data-app-view=\"settings\" aria-label=\"Settings\" data-app-aria=\"settings\">",
    "@@FA_LINE_077@@": "        <section id=\"app-dashboard\" class=\"app-view\" aria-labelledby=\"dashboard-title\">",
    "@@FA_LINE_099@@": "        <section id=\"app-calendar\" class=\"app-view\" aria-labelledby=\"calendar-title\" hidden>",
    "@@FA_LINE_104@@": "            <a class=\"app-link app-link-secondary\" href=\"./\" data-app-i18n=\"backDashboard\">Back to Dashboard</a>",
    "@@FA_LINE_107@@": "        <section id=\"app-settings\" class=\"app-view app-settings-view\" aria-labelledby=\"settings-title\" hidden>"
  },
  "calendar": {
    "@@FA_LINE_008@@": "  <title>Calendar — Football Architect</title>",
    "@@FA_LINE_032@@": "            <a class=\"fa-shell-link\" id=\"app-nav-dashboard\" href=\"../dashboard/\" data-app-view=\"dashboard\" aria-label=\"Dashboard\" data-app-aria=\"dashboard\">",
    "@@FA_LINE_036@@": "            <a class=\"fa-shell-link is-active\" id=\"app-nav-calendar\" href=\"./\" data-app-view=\"calendar\" aria-current=\"page\" aria-label=\"Calendar\" data-app-aria=\"calendar\">",
    "@@FA_LINE_044@@": "            <a class=\"fa-shell-link\" id=\"app-nav-settings\" href=\"../settings/\" data-app-view=\"settings\" aria-label=\"Settings\" data-app-aria=\"settings\">",
    "@@FA_LINE_077@@": "        <section id=\"app-dashboard\" class=\"app-view\" aria-labelledby=\"dashboard-title\" hidden>",
    "@@FA_LINE_099@@": "        <section id=\"app-calendar\" class=\"app-view\" aria-labelledby=\"calendar-title\">",
    "@@FA_LINE_104@@": "            <a class=\"app-link app-link-secondary\" href=\"../dashboard/\" data-app-i18n=\"backDashboard\">Back to Dashboard</a>",
    "@@FA_LINE_107@@": "        <section id=\"app-settings\" class=\"app-view app-settings-view\" aria-labelledby=\"settings-title\" hidden>"
  },
  "settings": {
    "@@FA_LINE_008@@": "  <title>Settings — Football Architect</title>",
    "@@FA_LINE_032@@": "            <a class=\"fa-shell-link\" id=\"app-nav-dashboard\" href=\"../dashboard/\" data-app-view=\"dashboard\" aria-label=\"Dashboard\" data-app-aria=\"dashboard\">",
    "@@FA_LINE_036@@": "            <a class=\"fa-shell-link\" id=\"app-nav-calendar\" href=\"../calendar/\" data-app-view=\"calendar\" aria-label=\"Calendar\" data-app-aria=\"calendar\">",
    "@@FA_LINE_044@@": "            <a class=\"fa-shell-link is-active\" id=\"app-nav-settings\" href=\"./\" data-app-view=\"settings\" aria-current=\"page\" aria-label=\"Settings\" data-app-aria=\"settings\">",
    "@@FA_LINE_077@@": "        <section id=\"app-dashboard\" class=\"app-view\" aria-labelledby=\"dashboard-title\" hidden>",
    "@@FA_LINE_099@@": "        <section id=\"app-calendar\" class=\"app-view\" aria-labelledby=\"calendar-title\" hidden>",
    "@@FA_LINE_104@@": "            <a class=\"app-link app-link-secondary\" href=\"../dashboard/\" data-app-i18n=\"backDashboard\">Back to Dashboard</a>",
    "@@FA_LINE_107@@": "        <section id=\"app-settings\" class=\"app-view app-settings-view\" aria-labelledby=\"settings-title\">"
  }
};
const check = process.argv.length === 3 && process.argv[2] === "--check";
if (process.argv.length > (check ? 3 : 2)) throw new Error("Usage: node tools/generate-app-pages.mjs [--check]");
for (const [name, replacements] of Object.entries(pages)) {
  let html = template;
  for (const [token, line] of Object.entries(replacements)) {
    if (!html.includes(token)) throw new Error("Missing template token: " + token);
    html = html.replaceAll(token, line);
  }
  if (html.includes("@@FA_LINE_")) throw new Error("Unresolved template token in " + name);
  const file = new URL("../app/" + name + "/index.html", import.meta.url);
  if (check) {
    const current = readFileSync(file, "utf8");
    if (Buffer.compare(Buffer.from(html, "utf8"), Buffer.from(current, "utf8")) !== 0) {
      throw new Error("Generated HTML differs from checked-in file: " + name);
    }
  } else {
    writeFileSync(file, html, "utf8");
  }
}
if (check) console.log("Static HTML matches checked-in pages: 3/3");
