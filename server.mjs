import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT??2000);
const routes=new Set(['/','/new-career','/new-career/team','/careers','/settings','/simulation']);
const files=new Map([
 ['/src/main.js','text/javascript; charset=utf-8'],
 ['/src/career-store.js','text/javascript; charset=utf-8'],
 ['/src/ui-pages.js','text/javascript; charset=utf-8'],
 ['/src/simulation.js','text/javascript; charset=utf-8'],
 ['/src/leagues.js','text/javascript; charset=utf-8'],
 ['/src/styles.css','text/css; charset=utf-8'],
 ['/assets/favicon.svg','image/svg+xml']
]);
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
