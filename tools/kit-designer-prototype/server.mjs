// Standalone loopback-only MANNEQUIN-180 studio. Not a published app route.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const files=new Map([
  ["/",["./index.html","text/html; charset=utf-8"]],
  ["/index.html",["./index.html","text/html; charset=utf-8"]],
  ["/viewer.mjs",["./viewer.mjs","text/javascript; charset=utf-8"]],
  ["/reference-import.mjs",["./reference-import.mjs","text/javascript; charset=utf-8"]],
  ["/rigged-arms.mjs",["./rigged-arms.mjs","text/javascript; charset=utf-8"]],
  ["/mannequin-180.obj",["./mannequin-180.obj","text/plain; charset=utf-8"]],
  ["/mannequin-180.glb",["./mannequin-180.glb","model/gltf-binary"]]
]);

export function createMannequinStudioServer(){
  return createServer(async(request,response)=>{
    const method=request.method||"";
    if(method!=="GET"&&method!=="HEAD"){
      response.writeHead(405,{"Allow":"GET, HEAD"});response.end();return;
    }
    const host=String(request.headers.host||"");
    // Only reachable on local loopback. The random-port exception exists for
    // Node integration tests; incoming remote Host headers are rejected.
    if(!/^127\.0\.0\.1:\d{1,5}$/.test(host)&&!/^localhost:\d{1,5}$/.test(host)){
      response.writeHead(403);response.end();return;
    }
    const path=(request.url||"").split("?")[0];
    const entry=files.get(path);
    if(!entry){response.writeHead(404);response.end();return;}
    try{
      const data=await readFile(fileURLToPath(new URL(entry[0],import.meta.url)));
      response.writeHead(200,{
        "Content-Type":entry[1],
        "Cache-Control":"no-store",
        "X-Content-Type-Options":"nosniff",
        "X-Frame-Options":"DENY",
        "Content-Security-Policy":"default-src 'none'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'unsafe-inline'; connect-src 'self' https://cdn.jsdelivr.net blob:; img-src 'self' data: blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
      });
      response.end(method==="HEAD"?undefined:data);
    }catch{
      response.writeHead(500);response.end("Local mannequin asset unavailable");
    }
  });
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  createMannequinStudioServer().listen(2100,"127.0.0.1",()=>{
    process.stdout.write("Football Architect Mannequin Studio: http://127.0.0.1:2100/\n");
  });
}
