// Loopback-only static DEV server. Never stage this module in a public artifact.
import {resolveSubpage,clubViews} from "../assets/subpage-routes.mjs";
import { createServer } from "node:http";
import { readFile, realpath, lstat } from "node:fs/promises";
import { resolve, dirname, relative, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { isAllowlistedPublicPath, publicRequestFile } from "./publication-guard.mjs";
import { DEBUG_FIRST_PAINT, DEBUG_SEASONS, DEBUG_SEASON_BOOTSTRAP, CLUB_SUMMARY_INJECTION } from "./dev-preview-artifact.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const HERE = dirname(fileURLToPath(import.meta.url));
const LOOPBACK = "127.0.0.1";
const LAN_ENABLED = process.env.FA_DEV_LAN === "1";
const HOST = LAN_ENABLED ? "0.0.0.0" : LOOPBACK;
const PORT = 2000;
const VIRTUAL = Object.freeze({
  "/__fa_dev__/debug-settings.mjs": "dev-debug-settings.mjs",
  "/__fa_dev__/debug-widget.mjs": "dev-debug-widget.mjs",
  "/__fa_dev__/standings-data.mjs": "dev-standings-preview-data.mjs",
  "/__fa_dev__/dev-standings-preview-data.mjs": "dev-standings-preview-data.mjs",
  "/__fa_dev__/standings-client.mjs": "dev-standings-preview-client.mjs",
  "/__fa_dev__/stats-data.mjs": "dev-competition-stats-data.mjs",
  "/__fa_dev__/stats-client.mjs": "dev-competition-stats-client.mjs"
});
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".webp": "image/webp"
};
const DETAIL = /^\/competitions\/(it|eng|es|de|fr|pt|nl|br)-[12](?:\/(?:overview|standings|postseason|fixtures|stats|history|rules|awards|teams|index\.html)?)?$/;
const DEV_SEASONS = DEBUG_SEASONS; // Shared fictional DEV/Debug catalogue; never official history.
const defaultDevSeason = "1";
const INJECT = [
  DEBUG_SEASON_BOOTSTRAP,
  '<script>document.documentElement.dataset.faDevStandingsPending="true"</script>',
  '<style>html:not([data-fa-tabs-restored="true"]) .app-competition-tabs{visibility:hidden}</style>',
  '<style>html[data-fa-dev-standings-pending="true"] .app-world-standing-table,html[data-fa-dev-standings-pending="true"] #app-standings-compact-list,html[data-fa-dev-standings-pending="true"] #competition-panel-fixtures{visibility:hidden}</style>',
  // Only DEV navigation uses this; never suppress the public competition views.
  '<style>html[data-fa-dev-season-transition="true"] #competition-panel-standings,html[data-fa-dev-season-transition="true"] #competition-panel-fixtures{visibility:hidden!important}</style>',
  '<script type="module" data-fa-dev-preview src="/__fa_dev__/standings-client.mjs"></script>',
  '<script type="module" data-fa-dev-stats src="/__fa_dev__/stats-client.mjs"></script>'
].join("\n");

function ipv4(value) {
  if (typeof value !== "string") return null;
  const normalized = value.startsWith("::ffff:") ? value.slice(7) : value;
  const parts = normalized.split(".");
  if (parts.length !== 4 || parts.some(part => part.length === 0 || part.length > 3 || ![...part].every(char => char >= "0" && char <= "9") || Number(part) > 255)) return null;
  return parts.map(Number).join(".");
}
function isPrivateIPv4(value) {
  const address = ipv4(value);
  if (!address) return false;
  const [a,b] = address.split(".").map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
function isLoopback(value) {
  return ipv4(value) === LOOPBACK || value === "::1";
}
function allowedHost(value, subdomains) {
  if (subdomains && (value === "localhost:2000" || value === "app.localhost:2000")) return true;
  if (typeof value !== "string" || !value.endsWith(":" + PORT)) return false;
  const address = value.slice(0, -(String(PORT).length + 1));
  return isLoopback(address) || (!subdomains && LAN_ENABLED && isPrivateIPv4(address));
}
function reject(res, status = 404) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end("DEV resource unavailable");
}

async function safeFile(root, relativePath) {
  const rootReal = await realpath(root);
  const segments = relativePath.split("/");
  if (!relativePath || segments.some(x => !x || x === "." || x === "..")) {
    throw Error("Bad local path");
  }
  let current = rootReal;
  for (const part of segments) {
    current = resolve(current, part);
    if ((await lstat(current)).isSymbolicLink()) throw Error("No symlink access");
  }
  const fileReal = await realpath(current);
  if (!fileReal.startsWith(rootReal + sep) || relative(rootReal, fileReal).startsWith("..")) {
    throw Error("Path outside DEV root");
  }
  if (!(await lstat(fileReal)).isFile()) throw Error("Not a regular file");
  return readFile(fileReal);
}

// Exported solely to test the server without opening a production or LAN socket.
export function createPreviewServer({ root = ROOT, subdomains = false } = {}) {
  return createServer(async (req, res) => {
    try {
      const remote = req.socket.remoteAddress;
      if (!isLoopback(remote) && !(!subdomains && LAN_ENABLED && isPrivateIPv4(remote))) return reject(res, 403);
      if (!allowedHost(req.headers.host, subdomains)) return reject(res, 403);
      if (req.method !== "GET" && req.method !== "HEAD") return reject(res, 405);
      const raw = req.url?.split("?")[0] ?? "";
      if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("%") ||
          raw.includes("\\") || raw.includes("\0") || /\/\.{1,2}(?:\/|$)/.test(raw)) {
        return reject(res, 403);
      }
      // Club aliases share ROUTE-02 validation; temporal parameters belong only to Fixtures/Stats.
      const clubPath=raw.replace(/\/index\.html$/,"");
      const clubRoute=resolveSubpage(clubPath);
      if(clubRoute?.kind==="club"){
        const params=new URL(req.url,"http://localhost").searchParams;
        const base=clubPath===clubRoute.base||clubPath===clubRoute.base+"/";
        const view=base&&clubViews.includes(params.get("view"))?params.get("view"):clubRoute.view;
        params.delete("view");
        if(view==="overview"||view==="history"){params.delete("season");params.delete("matchday");}
        const target=clubRoute.base+"/"+view+(params.size?"?"+params:"");
        if(req.url!==target){
          res.writeHead(308,{"Location":target,"Cache-Control":"no-store"});res.end();return;
        }
      }
      const rootDivision = raw.match(/^\/competitions\/((?:it|eng|es|de|fr|pt|nl|br)-[12])\/?$/);
      if(rootDivision){
        const query=req.url.includes("?")?req.url.slice(req.url.indexOf("?")):"";
        const legacy=new URLSearchParams(query);
        const allowed=new Set(["standings","postseason","fixtures","stats","history","rules","awards"]);
        const next=allowed.has(legacy.get("view"))?legacy.get("view"):"overview";
        legacy.delete("view");
        if(next==="history"||next==="rules"){legacy.delete("season");legacy.delete("matchday");}
        const suffix=legacy.toString();
        res.writeHead(308,{"Location":"/competitions/"+rootDivision[1]+"/"+next+(suffix?"?"+suffix:""),"Cache-Control":"no-store"});res.end();return;
      }
      const viewSlash=raw.match(/^\/competitions\/((?:it|eng|es|de|fr|pt|nl|br)-[12])\/(standings|postseason|fixtures|stats|history|rules|awards|overview|teams)\/$/);
      if(viewSlash){
        const query=req.url.includes("?")?req.url.slice(req.url.indexOf("?")):"";
        res.writeHead(308,{"Location":"/competitions/"+viewSlash[1]+"/"+viewSlash[2]+query,"Cache-Control":"no-store"});
        res.end();return;
      }
      const virtual = VIRTUAL[raw];
      let body, type;
      if (virtual) {
        body = await safeFile(HERE, virtual);
        type = TYPES[".mjs"];
      } else {
        const appHost = subdomains && req.headers.host === "app.localhost:2000";
        const file = publicRequestFile(appHost && (raw === "/" || raw === "/index.html") ? "/dashboard" : raw);
        if (!isAllowlistedPublicPath(file)) return reject(res, 404);
        body = await safeFile(root, file);
        type = TYPES[extname(file)];
        if (!type) return reject(res, 404);
        if(file==="clubs/_shared/index.html")body=Buffer.from(body.toString('utf8').replace('</head>',CLUB_SUMMARY_INJECTION+'\n</head>'),'utf8');
        if(file==="calendar/index.html"){
          // Inject only on the DEV server; never present these fictional days as official time.
          const bootstrap='<script>window.faDevCalendarClockSnapshot={source:{kind:"dev",reference:"fictional local DEV calendar"},current:{season:1,day:1}};</script>';
          body=Buffer.from(body.toString("utf8").replace('<script data-calendar-bootstrap>',bootstrap+'<script data-calendar-bootstrap>'),"utf8");
        }
        if (DETAIL.test(raw) || file === "competitions/index.html" || file === "calendar/index.html") {
          const html = body.toString("utf8");
          if (html.split("</head>").length !== 2) return reject(res, 500);
          // Resolve the requested DEV season before the browser paints the selector.
          const params = new URL(req.url, "http://localhost").searchParams;
          const requested = params.get("season");
          const season = requested && DEV_SEASONS.includes(Number(requested)) ? requested : defaultDevSeason;
          const seasonHtml = season !== "1"
            ? html.replace('id="app-competition-season-value">1</span>',
                `id="app-competition-season-value">${season}</span>`)
              .replace('id="app-competition-season-option-1" class="language-option" role="option" data-menu-value="1" aria-selected="true"',
                'id="app-competition-season-option-1" class="language-option" role="option" data-menu-value="1" aria-selected="false"')
            : html;
          body = Buffer.from(seasonHtml.replace("</head>", DEBUG_FIRST_PAINT + (file === "calendar/index.html" ? DEBUG_SEASON_BOOTSTRAP : "") + INJECT + "\n</head>"), "utf8");
        }
      }
      if (subdomains && type === TYPES[".html"]) {
        const appOrigin = "http://app.localhost:2000", siteOrigin = "http://localhost:2000";
        const config = '<script>document.documentElement.dataset.faDevAppOrigin="' + appOrigin +
          '";document.documentElement.dataset.faDevSiteOrigin="' + siteOrigin + '"</script>';
        body = Buffer.from(body.toString("utf8").replace("</head>", config + "\n</head>")
          .replace(/(\bhref=")([^"#]+)(")/g, (all, prefix, href, quote) => {
            if (/^\/(?:dashboard|calendar|settings|competitions|clubs)(?:[/?#]|$)/.test(href))
              return prefix + appOrigin + href + quote;
            if (href === "/" || /^\/guide(?:[/?#]|$)/.test(href))
              return prefix + siteOrigin + (href === "/" ? "" : href) + quote;
            return all;
          }), "utf8");
      }
      res.writeHead(200, {
        "Content-Type": type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY"
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      reject(res); // Fail closed: never serve a partial or unchecked artifact.
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw Error("DEV preview server accepts no CLI flags");
  createPreviewServer({ subdomains: !LAN_ENABLED }).listen(PORT, HOST, () => {
    const addresses = LAN_ENABLED
      ? Object.values(networkInterfaces()).flatMap(items => items || [])
        .filter(item => item.family === "IPv4" && !item.internal && isPrivateIPv4(item.address))
        .map(item => "http://" + item.address + ":" + PORT + "/competitions/it-1")
      : ["http://app.localhost:" + PORT + "/competitions/it-1"];
    process.stdout.write("Standings DEV preview (" + (LAN_ENABLED ? "LAN opt-in" : "local subdomains") + "):" + String.fromCharCode(10) +
      addresses.join(String.fromCharCode(10)) + String.fromCharCode(10));
  });
}
