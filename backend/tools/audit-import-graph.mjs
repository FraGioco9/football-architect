/** Read-only BE-01 import graph: TypeScript AST, source cycles and unresolved paths. */
import {readdirSync,readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,relative,dirname,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const ext=/\.(?:[cm]?[jt]s)$/;
const suffixes=['','.ts','.mts','.cts','.js','.mjs','.cjs','.json','/index.ts','/index.mts','/index.js','/index.mjs'];
const ignored=new Set(['node_modules','.wrangler','dist','coverage','.git']);
const posix=s=>s.split(sep).join('/');
function gather(dir){
 if(!existsSync(dir))return [];
 return readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  if(ignored.has(e.name))return [];
  const p=join(dir,e.name);
  return e.isDirectory()?gather(p):e.isFile()&&ext.test(e.name)?[p]:[];
 });
}
function resolveImport(file,spec){
 const target=resolve(dirname(file),spec);
 return suffixes.map(s=>target+s).find(p=>existsSync(p)&&statSync(p).isFile())??null;
}
function isString(x){return !!x&&(ts.isStringLiteral(x)||ts.isNoSubstitutionTemplateLiteral(x))}
function imports(source,file){
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,/\.([cm]?js)$/.test(file)?ts.ScriptKind.JS:ts.ScriptKind.TS);
 const result=[];
 function add(node,arg,kind){
  result.push({specifier:isString(arg)?arg.text:null,kind,line:ast.getLineAndCharacterOfPosition(node.getStart(ast)).line+1});
 }
 function visit(node){
  if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)){
   if(node.moduleSpecifier)add(node,node.moduleSpecifier,ts.isImportDeclaration(node)?'import':'export');
  }else if(ts.isImportEqualsDeclaration(node)&&ts.isExternalModuleReference(node.moduleReference)){
   add(node,node.moduleReference.expression,'import-equals');
  }else if(ts.isImportTypeNode(node)){
   if(ts.isLiteralTypeNode(node.argument)&&isString(node.argument.literal))add(node,node.argument.literal,'type-import');
  }else if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||
    ts.isIdentifier(node.expression)&&node.expression.text==='require')){
   add(node,node.arguments[0],node.expression.kind===ts.SyntaxKind.ImportKeyword?'dynamic-import':'require');
  }
  ts.forEachChild(node,visit);
 }
 visit(ast);return result;
}
function cycles(nodes,edges){
 const index=new Map(),low=new Map(),stack=[],active=new Set(),result=[];let clock=0;
 function search(v){
  index.set(v,clock);low.set(v,clock++);stack.push(v);active.add(v);
  for(const w of edges.get(v)??[]){
   if(!index.has(w)){search(w);low.set(v,Math.min(low.get(v),low.get(w)));}
   else if(active.has(w))low.set(v,Math.min(low.get(v),index.get(w)));
  }
  if(low.get(v)===index.get(v)){
   const component=[];let item;
   do{item=stack.pop();active.delete(item);component.push(item)}while(item!==v);
   if(component.length>1||(edges.get(v)??[]).includes(v))result.push(component.sort());
  }
 }
 for(const node of nodes)if(!index.has(node))search(node);
 return result.sort((a,b)=>a[0].localeCompare(b[0]));
}
export function auditImportGraph(root=resolve(dirname(fileURLToPath(import.meta.url)),'..')){
 const backend=resolve(root),repo=resolve(backend,'..');
 const files=['src','tests','tools','catalogues'].flatMap(part=>gather(join(backend,part)))
  .concat(['vitest.config.mts'].map(f=>join(backend,f)).filter(f=>existsSync(f))).sort();
 const known=new Set(files),edges=new Map(files.map(f=>[f,[]]));
 const missing=[],dynamicUnknown=[],external=new Set(),crossRootReferences=[];
 const refCounts=new Map(files.map(f=>[f,0]));
 let edgeCount=0,dynamicLiteral=0;
 for(const file of files){
  for(const imp of imports(readFileSync(file,'utf8'),file)){
   if(imp.specifier===null){dynamicUnknown.push({file:posix(relative(repo,file)),kind:imp.kind,line:imp.line});continue}
   if(!imp.specifier.startsWith('.')){external.add(imp.specifier);continue}
   const target=resolveImport(file,imp.specifier);
   if(!target){missing.push({file:posix(relative(repo,file)),specifier:imp.specifier,kind:imp.kind});continue}
   edgeCount++;if(imp.kind==='dynamic-import')dynamicLiteral++;
   if(known.has(target)){edges.get(file).push(target);refCounts.set(target,refCounts.get(target)+1)}
   else crossRootReferences.push({from:posix(relative(repo,file)),to:posix(relative(repo,target))});
  }
 }
 const src=files.filter(f=>f.startsWith(join(backend,'src')+sep)),srcSet=new Set(src);
 const srcCycles=cycles(src,new Map(src.map(f=>[f,(edges.get(f)??[]).filter(to=>srcSet.has(to))])))
  .map(c=>c.map(f=>posix(relative(repo,f))));
 const cfg=join(backend,'wrangler.toml'),content=existsSync(cfg)?readFileSync(cfg,'utf8'):'';
 const entry=content.match(/^\s*main\s*=\s*["']([^"']+)["']/m)?.[1];
 const entryPath=entry?resolve(backend,entry):null,reachable=new Set();
 function walk(v){if(reachable.has(v)||!srcSet.has(v))return;reachable.add(v);for(const w of edges.get(v)??[])walk(w)}
 if(entryPath&&srcSet.has(entryPath))walk(entryPath);
 return {
  modules:{src:src.length,tests:files.filter(f=>f.includes(sep+'tests'+sep)).length,tools:files.filter(f=>f.includes(sep+'tools'+sep)).length},
  edges:edgeCount,missing,dynamicUnknown,dynamicLiteral,external:[...external].sort(),
  crossRootReferences,cycles:srcCycles,
  entrypoint:entryPath?posix(relative(repo,entryPath)):null,reachableFromWorker:reachable.size,
  outsideWorkerReachability:src.filter(f=>!reachable.has(f)).map(f=>posix(relative(repo,f))),
  unusedByBackendModuleGraph:src.filter(f=>!refCounts.get(f)).map(f=>posix(relative(repo,f)))
 };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const rootArg=process.argv.slice(2).find(x=>!x.startsWith('--'));
 const result=auditImportGraph(rootArg?resolve(rootArg):undefined);
 if(process.argv.includes('--json'))console.log(JSON.stringify(result,null,2));
 else console.log('BE-01 graph: '+JSON.stringify(result,null,2));
 if(result.missing.length||!result.entrypoint)process.exitCode=1;
}
