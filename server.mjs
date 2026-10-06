import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 2000);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon'};
const server = http.createServer(async(req,res)=>{
  try {
    const url = new URL(req.url, 'http://localhost');
    let relative = decodeURIComponent(url.pathname);
    if (relative === '/') relative = '/index.html';
    const pathname = path.resolve(root, '.' + relative);
    if (pathname !== root && !pathname.startsWith(root + path.sep)) {res.writeHead(403);res.end('Forbidden');return;}
    if (!(await stat(pathname)).isFile()) {res.writeHead(404);res.end('Not found');return;}
    const content = await readFile(pathname);
    res.writeHead(200,{'Content-Type':types[path.extname(pathname)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(content);
  } catch (err) {res.writeHead(404);res.end('Not found');}
});
server.listen(port, '127.0.0.1',()=>console.log(`Football Architect online su http://localhost:${port}`));
