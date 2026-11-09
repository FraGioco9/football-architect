import {proxyAdminApi} from './dev-admin-api-proxy.mjs';
import {addDevelopmentToAppHtml,renderMatchEngineLab,labFirstPaintBootstrap} from '../match-engine/src/sidebar-shell.mjs';
import {readSharedPublicWorld} from './shared-nonproduction-proxy.mjs';
import {request as httpRequest} from 'node:http';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {validPublicWorld}=require('../assets/world-clock-adapter.js');
// Loopback-only static DEV server. Never stage this module in a public artifact.
import {resolveSubpage,clubViews} from "../assets/subpage-routes.mjs";
import {parseRoute,buildRoute} from "../assets/routes-registry.mjs";
import { createServer } from "node:http";
import { readFile, realpath, lstat } from "node:fs/promises";
import { resolve, dirname, relative, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { isAllowlistedPublicPath, publicRequestFile } from "./publication-guard.mjs";
import { DEBUG_MODE_BOOTSTRAP, DEBUG_FIRST_PAINT, DEBUG_SEASONS, DEBUG_SEASON_BOOTSTRAP, CLUB_SUMMARY_INJECTION } from "./dev-preview-artifact.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const HERE = dirname(fileURLToPath(import.meta.url));
const LOOPBACK = "127.0.0.1";
const LAN_ENABLED = process.env.FA_DEV_LAN === "1";
const HOST = LAN_ENABLED ? "0.0.0.0" : LOOPBACK;
const PORT = 2000;
const VIRTUAL = Object.freeze({
  "/__fa_dev__/debug-settings.mjs": "dev-debug-settings.mjs",
  "/__fa_dev__/debug-widget.mjs": "dev-debug-widget.mjs",
  "/__fa_dev__/dev-debug-config.mjs": "dev-debug-config.mjs",
  "/__fa_dev__/dev-world-clock.mjs": "dev-world-clock.mjs",
  "/__fa_dev__/standings-data.mjs": "dev-standings-preview-data.mjs",
  "/__fa_dev__/dev-standings-preview-data.mjs": "dev-standings-preview-data.mjs",
  "/__fa_dev__/standings-client.mjs": "dev-standings-preview-client.mjs",
  "/__fa_dev__/stats-data.mjs": "dev-competition-stats-data.mjs",
  "/__fa_dev__/stats-client.mjs": "dev-competition-stats-client.mjs"
});
// ME-01: explicit loopback + app-host only. Never listed in public artifacts.
const MATCH_ENGINE_LAB = Object.freeze({
  '/dev/match-engine': 'match-engine/lab/index.html',
  '/__fa_match_engine__/core.mjs': 'match-engine/src/core.mjs',
  '/__fa_match_engine__/aerodynamics.mjs': 'match-engine/src/aerodynamics.mjs',
  '/__fa_match_engine__/magnus.mjs': 'match-engine/src/magnus.mjs',
  '/__fa_match_engine__/calibration-evidence.mjs': 'match-engine/src/calibration-evidence.mjs',
  '/__fa_match_engine__/universal-ball-readiness.mjs': 'match-engine/src/universal-ball-readiness.mjs',
  '/__fa_match_engine__/calibration-dataset-intake.mjs': 'match-engine/src/calibration-dataset-intake.mjs',
  '/__fa_match_engine__/ball3d-trajectory-adapter.mjs': 'match-engine/src/ball3d-trajectory-adapter.mjs',
  '/__fa_match_engine__/literature-aero-candidate.mjs': 'match-engine/src/literature-aero-candidate.mjs',
  '/__fa_match_engine__/flight-playback.mjs': 'match-engine/src/flight-playback.mjs',
  '/__fa_match_engine__/lab.mjs': 'match-engine/src/lab.mjs',
  '/__fa_match_engine__/pitch-markings.mjs': 'match-engine/src/pitch-markings.mjs',
  '/__fa_match_engine__/numeric-controls.mjs': 'match-engine/src/numeric-controls.mjs',
  '/__fa_match_engine__/rebound-metrics.mjs': 'match-engine/src/rebound-metrics.mjs',
  '/__fa_match_engine__/physics-diagnostics.mjs': 'match-engine/src/physics-diagnostics.mjs',
  '/__fa_match_engine__/lab.css': 'match-engine/lab/lab.css',
  '/__fa_match_engine__/sidebar-first-paint.js': 'assets/sidebar-first-paint.js',
  '/__fa_match_engine__/rapier.es.js': 'match-engine/node_modules/@dimforge/rapier3d-deterministic-compat/dist/rapier.mjs'
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
const CUP_DETAIL = /^\/competitions\/(int-1|int-2)(?:\/(?:standings|postseason|fixtures|stats|history|rules|awards|index\.html)?)?$/;
const DEV_SEASONS = DEBUG_SEASONS; // Shared fictional DEV/Debug catalogue; never official history.
const defaultDevSeason = "1";
const INJECT = [
  DEBUG_SEASON_BOOTSTRAP,
  '<script>document.documentElement.dataset.faDevStandingsPending="true"</script>',
  // Static view tabs stay visible while dynamic data and scroll restoration load.
  '<style>html[data-fa-dev-standings-pending="true"] .app-world-standing-table,html[data-fa-dev-standings-pending="true"] #app-standings-compact-list{visibility:hidden}</style>',
  // Only DEV navigation uses this; never suppress the public competition views.
  '<style>html[data-fa-dev-season-transition="true"] #competition-panel-standings{visibility:hidden!important}</style>',
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

// Read the same canonical public endpoint used by the client before serving
// the local HTML. This is read-only; no sessionStorage or wall-clock inference.
async function readPublicWorldForFirstPaint(){
 const target=process.env.FA_ADMIN_API_TARGET;
 if(!target)return null;
 try{
  if(process.env.FA_ADMIN_API_POOL==='dev-preview')return await readSharedPublicWorld(target);
  if(!/^http:\/\/(?:127\.0\.0\.1|\[::1\]):[1-9][0-9]{0,4}\/?$/.test(target))return null;
  const upstream=new URL(target);
  return await new Promise(resolve=>{
   const req=httpRequest({hostname:upstream.hostname.replace(/^\[|\]$/g,''),port:upstream.port,
     path:'/api/world',method:'GET',timeout:2500,
     // Reuse the existing local app origin for the same anonymous world
     // endpoint; do not expose the upstream Worker port as browser Host.
     headers:{host:'app.localhost:2000'}},res=>{
    let size=0;const chunks=[];
    res.on('data',part=>{size+=part.length;if(size>4096)req.destroy();else chunks.push(part)});
    res.on('end',()=>{try{resolve(res.statusCode===200?JSON.parse(Buffer.concat(chunks).toString('utf8'))?.world??null:null)}catch{resolve(null)}});
    res.on('error',()=>resolve(null));
   });
   req.on('timeout',()=>req.destroy());req.on('error',()=>resolve(null));req.end();
  });
 }catch{return null}
}
// Exported solely to test the server without opening a production or LAN socket.
export function createPreviewServer({ root = ROOT, subdomains = false, devPreview = true,
  readInitialWorld = readPublicWorldForFirstPaint } = {}) {
  const sharedBackend=process.env.FA_ADMIN_API_POOL==='dev-preview';
  devPreview=devPreview&&!sharedBackend;
  return createServer(async (req, res) => {
    try {
      const remote = req.socket.remoteAddress;
      if (!isLoopback(remote) && !(!subdomains && LAN_ENABLED && isPrivateIPv4(remote))) return reject(res, 403);
      if (!allowedHost(req.headers.host, subdomains)) return reject(res, 403);
      if (await proxyAdminApi(req,res)) return;
      if (req.method !== "GET" && req.method !== "HEAD") return reject(res, 405);
      const raw = req.url?.split("?")[0] ?? "";
      if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("%") ||
          raw.includes("\\") || raw.includes("\0") || /\/\.{1,2}(?:\/|$)/.test(raw)) {
        return reject(res, 403);
      }
      const labFile = MATCH_ENGINE_LAB[raw];
      if (labFile) {
        // Deny the laboratory in LAN, shared Dev/Preview, non-app hosts and public mode.
        if (!devPreview || !subdomains || !isLoopback(remote) ||
            req.headers.host !== 'app.localhost:2000') return reject(res, 404);
        let bytes = await safeFile(root, labFile);
        if (raw === '/dev/match-engine') {
          const canonicalDashboard = await safeFile(root, 'dashboard/index.html');
          bytes = Buffer.from(renderMatchEngineLab(bytes.toString('utf8'), canonicalDashboard.toString('utf8')), 'utf8');
        }
        if (raw === '/__fa_match_engine__/sidebar-first-paint.js')
          bytes = Buffer.from(labFirstPaintBootstrap(bytes.toString('utf8')), 'utf8');
        const type = TYPES[extname(labFile)];
        if (!type) return reject(res, 404);
        res.writeHead(200, {
          'Content-Type': type,
          'Cache-Control': 'private, no-store',
          'X-Robots-Tag': 'noindex, nofollow',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Content-Security-Policy': "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'"
        });
        res.end(req.method === 'HEAD' ? undefined : bytes);
        return;
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
      const parsedDivision=parseRoute(raw);
      const rootDivision=parsedDivision?.kind==="competition"&&raw.replace(/\/$/,"")===parsedDivision.base
        ? [raw,parsedDivision.base.slice("/competitions/".length)] : null;
      if(rootDivision){
        const query=req.url.includes("?")?req.url.slice(req.url.indexOf("?")):"";
        const legacy=new URLSearchParams(query);
        const allowed=new Set(["standings","postseason","fixtures","stats","history","rules","awards"]);
        const next=allowed.has(legacy.get("view"))?legacy.get("view"):"overview";
        legacy.delete("view");
        if(next==="history"||next==="rules")legacy.delete("matchday");
        const suffix=legacy.toString();
        res.writeHead(308,{"Location":buildRoute({kind:"competition",id:rootDivision[1],view:next})+(suffix?"?"+suffix:""),"Cache-Control":"no-store"});res.end();return;
      }
      const parsedView=parseRoute(raw);
      const viewSlash=parsedView?.kind==="competition"&&parsedView.redirect&&raw.endsWith("/")&&raw!==parsedView.base+"/"
        ? parsedView : null;
      if(viewSlash){
        const query=req.url.includes("?")?req.url.slice(req.url.indexOf("?")):"";
        res.writeHead(308,{"Location":viewSlash.canonical+query,"Cache-Control":"no-store"});
        res.end();return;
      }
      const virtual = VIRTUAL[raw];
      let body, type;
      if (virtual) {
        if(!devPreview)return reject(res,404);
        body = await safeFile(HERE, virtual);
        type = TYPES[".mjs"];
      } else {
        const appHost = subdomains && req.headers.host === "app.localhost:2000";
        const file = publicRequestFile(appHost && (raw === "/" || raw === "/index.html") ? "/dashboard" : raw);
        if (!isAllowlistedPublicPath(file)) return reject(res, 404);
        body = await safeFile(root, file);
        type = TYPES[extname(file)];
        if (!type) return reject(res, 404);
        if(devPreview&&file==="clubs/_shared/index.html")body=Buffer.from(body.toString('utf8').replace('</head>',CLUB_SUMMARY_INJECTION+'\n</head>'),'utf8');
        if(devPreview&&file==="calendar/index.html"){
          // Inject only on the DEV server; never present these fictional days as official time.
          const bootstrap=DEBUG_MODE_BOOTSTRAP+'<script>if(window.faDebugEnabled!==false)window.faDevCalendarClockSnapshot={source:{kind:"dev",reference:"fictional local DEV calendar"},current:{season:1,day:1}};</script>';
          body=Buffer.from(body.toString("utf8").replace('<script data-calendar-bootstrap>',bootstrap+'<script data-calendar-bootstrap>'),"utf8");
        }
        if (devPreview && (DETAIL.test(raw) || CUP_DETAIL.test(raw) || file === "competitions/index.html" || file === "calendar/index.html")) {
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
      if ((devPreview || sharedBackend) && subdomains && type === TYPES[".html"]) {
        const appOrigin = "http://app.localhost:2000", siteOrigin = "http://localhost:2000";
        const config = '<script>document.documentElement.dataset.faDevAppOrigin="' + appOrigin +
          '";document.documentElement.dataset.faDevSiteOrigin="' + siteOrigin + '"</script>';
        body = Buffer.from(body.toString("utf8").replace("</head>", config + "\n</head>")
          .replace(/(\bhref=")([^"#]+)(")/g, (all, prefix, href, quote) => {
            if (/^\/(?:account|dashboard|calendar|settings|competitions|clubs)(?:[/?#]|$)/.test(href))
              return prefix + appOrigin + href + quote;
            if (href === "/" || /^\/guide(?:[/?#]|$)/.test(href))
              return prefix + siteOrigin + (href === "/" ? "" : href) + quote;
            return all;
          }), "utf8");
      }
      // Server-render only a *verified* canonical season into the first HTML
      // paint. Links retain their own valid earlier season, future URLs are
      // clamped, and plain /standings starts directly at the public latest.
      if((DETAIL.test(raw)||CUP_DETAIL.test(raw))&&type===TYPES[".html"]&&req.method==='GET'){
        const candidate=await readInitialWorld();
        const world=validPublicWorld(candidate)&&candidate.seasonNumber<=2?candidate:null;
        const param=new URL(req.url,'http://localhost').searchParams.get('season');
        const requested=/^[1-9]\d{0,8}$/.test(param||'')?Number(param):null;
        const current=world?Math.max(1,world.seasonNumber):null;
        const chosen=current===null?(requested===1?1:null):
          requested===null?current:Math.min(requested,current);
        let html=body.toString('utf8');
        if(chosen!==null)html=html.replace(/id="app-competition-season-value">\d+<\/span>/,
          'id="app-competition-season-value">'+chosen+'</span>');
        const head='<style>html:not([data-fa-competition-season-verified="true"]) #app-competition-season-value{visibility:hidden}</style>'+
          (chosen!==null?'<script>window.faCompetitionInitialSeason='+(current===null?'null':current)+
           ';document.documentElement.dataset.faCompetitionSeasonVerified="true";</script>':'');
        html=html.replace('</head>',head+'\n</head>');
        // Debug's isolated season comes from its own client-side session. The
        // parser-time script runs directly after the value and before paint.
        if(devPreview){
          const script='<script data-fa-competition-season-first-paint>(function(){'+
            'if(window.faDebugEnabled===false||!document.documentElement.dataset.faDevSeasons)return;'+
            'const v=document.getElementById("app-competition-season-value");if(!v)return;'+
            'const s=new URLSearchParams(location.search).get("season"),'+
            'current=Math.max(1,Number(document.documentElement.dataset.faDevCurrentSeason)||1),'+
            'requested=/^[1-9]\\d{0,8}$/.test(s||"")?Number(s):null;'+
            'v.textContent=String(requested!==null&&requested<=current?requested:current);'+
            'document.documentElement.dataset.faCompetitionSeasonVerified="true";'+
            '})();</script>';
          html=html.replace(/(<span id="app-competition-season-value">\d+<\/span>)/,'$1'+script);
        }
        body=Buffer.from(html,'utf8');
      }
      if(devPreview&&['dashboard/index.html','settings/index.html','clubs/index.html'].includes(publicRequestFile(raw)))body=Buffer.from(body.toString('utf8').replace('</head>',DEBUG_MODE_BOOTSTRAP+'<script type="module" src="/__fa_dev__/debug-settings.mjs"></script>\n</head>'),'utf8');
      // Mark all preview HTML routes, including dashboard and settings, before their scripts execute.
      if(devPreview && type === TYPES[".html"]) body=Buffer.from(body.toString("utf8").replace("</head>",DEBUG_MODE_BOOTSTRAP+'\n</head>'),"utf8");
      // Add the DEV-only entry to the existing generated navigation, without changing
      // any other sidebar group or the underlying public/generated HTML.
      if (devPreview && subdomains && isLoopback(remote) &&
          req.headers.host === 'app.localhost:2000' && type === TYPES[".html"] &&
          body.includes('<nav class="fa-shell-nav"'))
        body = Buffer.from(addDevelopmentToAppHtml(body.toString('utf8')), 'utf8');
      res.writeHead(200, {
        "Content-Type": type,
        "Cache-Control": raw === "/favicon.ico" || raw === "/favicon.svg" ? "public, max-age=86400" : "no-store",
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
