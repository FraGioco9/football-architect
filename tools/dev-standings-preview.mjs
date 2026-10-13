// Loopback-only static DEV server. Never stage this module in a public artifact.
import { createServer } from "node:http";
import { readFile, realpath, lstat } from "node:fs/promises";
import { resolve, dirname, relative, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { isAllowlistedPublicPath } from "./publication-guard.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = "127.0.0.1";
const PORT = 2000;
const VIRTUAL = Object.freeze({
  "/__fa_dev__/standings-data.mjs": "dev-standings-preview-data.mjs",
  "/__fa_dev__/standings-client.mjs": "dev-standings-preview-client.mjs"
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
const DETAIL = /^\/app\/competitions\/(it|eng|es|de|fr|pt|nl|br)-[12]\/(?:index\.html)?$/;
const INJECT = '<script type="module" src="/__fa_dev__/standings-client.mjs"></script>';

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
export function createPreviewServer({ root = ROOT } = {}) {
  return createServer(async (req, res) => {
    try {
      if (req.socket.remoteAddress !== HOST &&
          req.socket.remoteAddress !== "::ffff:" + HOST) return reject(res, 403);
      if (req.headers.host !== HOST + ":" + PORT) return reject(res, 403);
      if (req.method !== "GET" && req.method !== "HEAD") return reject(res, 405);
      const raw = req.url?.split("?")[0] ?? "";
      if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("%") ||
          raw.includes("\\") || raw.includes("\0") || /\/\.{1,2}(?:\/|$)/.test(raw)) {
        return reject(res, 403);
      }
      const virtual = VIRTUAL[raw];
      let body, type;
      if (virtual) {
        body = await safeFile(HERE, virtual);
        type = TYPES[".mjs"];
      } else {
        const file = (raw.endsWith("/") ? raw + "index.html" : raw).slice(1);
        if (!isAllowlistedPublicPath(file)) return reject(res, 404);
        body = await safeFile(root, file);
        type = TYPES[extname(file)];
        if (!type) return reject(res, 404);
        if (DETAIL.test(raw)) {
          const html = body.toString("utf8");
          if (html.split("</head>").length !== 2) return reject(res, 500);
          body = Buffer.from(html.replace("</head>", INJECT + "\n</head>"), "utf8");
        }
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
  createPreviewServer().listen(PORT, HOST, () => {
    process.stdout.write("Standings DEV preview: http://" + HOST + ":" + PORT +
      "/app/competitions/it-1/?standingsPreview=on\n");
  });
}
