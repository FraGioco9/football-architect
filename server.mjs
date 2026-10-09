import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT??2000);
const routes=new Set(['/','/new-career','/new-career/country','/new-career/league','/new-career/team','/careers','/settings','/simulation','/dashboard','/calendar']);
const files=new Map([
 ['/src/main.js','text/javascript; charset=utf-8'],
 ['/src/global-search.js','text/javascript; charset=utf-8'],
 ['/src/icons.js','text/javascript; charset=utf-8'],
 ['/src/language-picker.js','text/javascript; charset=utf-8'],
 ['/src/career-store.js','text/javascript; charset=utf-8'],
 ['/src/feedback.js','text/javascript; charset=utf-8'],
 ['/src/manager-profile.js','text/javascript; charset=utf-8'],
 ['/src/site-pickers.js','text/javascript; charset=utf-8'],
 ['/src/site-picker-ui.js','text/javascript; charset=utf-8'],
 ['/src/ui-pages.js','text/javascript; charset=utf-8'],
 ['/src/simulation.js','text/javascript; charset=utf-8'],
 ['/src/season-calendar.js','text/javascript; charset=utf-8'],
 ['/src/fixture-calendar.js','text/javascript; charset=utf-8'],
 ['/src/leagues.js','text/javascript; charset=utf-8'],
 ['/src/styles.css','text/css; charset=utf-8'],
 ['/assets/favicon.svg','image/svg+xml']
]);
// Serve only regular SVG files from the vendored 4:3 flag catalog. The route
// map is a strict allowlist: no traversal, nested paths, or square flag assets.
for(const entry of readdirSync(path.join(root,'assets','flags'),{withFileTypes:true})){
 if(entry.isFile()&&/^[a-z0-9]+(?:-[a-z0-9]+)*\.svg$/.test(entry.name))
  files.set('/assets/flags/'+entry.name,'image/svg+xml');
}
const server=http.createServer(async(req,res)=>{
 const method=req.method??'GET';
 if(method!=='GET'&&method!=='HEAD'){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
 let pathname;
 try{pathname=new URL(req.url,'http://localhost').pathname;}catch{res.writeHead(400);res.end();return;}
 const page=routes.has(pathname);
 if(!page&&!files.has(pathname)){res.writeHead(404,{'Cache-Control':'no-store'});res.end('Not found');return;}
 const file=page?'/index.html':pathname;
 try{
  const data=await readFile(path.join(root,file.slice(1)));
  res.writeHead(200,{'Content-Type':page?'text/html; charset=utf-8':files.get(pathname),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(method==='HEAD'?undefined:data);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log('Football Architect: http://127.0.0.1:'+port));
