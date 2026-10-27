// CLEAN-UI-03: read-only, context-aware CSS candidate inventory. Node 22; no dependencies.
// Does not change CSS or claim browser equivalence.
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";

export function inventoryCss(source) {
  const blocks=[];
  const stack=[];
  let start=0,quote="",comment=false,paren=0,bracket=0;
  for(let i=0;i<source.length;i++){
    const c=source[i],next=source[i+1];
    if(comment){if(c==="*"&&next==="/"){comment=false;i++;}continue;}
    if(quote){if(c==="\\"){i++;continue;}if(c===quote)quote="";continue;}
    if(c==="/"&&next==="*"){comment=true;i++;continue;}
    if(c==='"'||c==="'"){quote=c;continue;}
    if(c==="("){paren++;continue;}if(c===")"){paren--;continue;}
    if(c==="["){bracket++;continue;}if(c==="]"){bracket--;continue;}
    if(paren||bracket)continue;
    if(c==="{"){
      const header=source.slice(start,i).replace(/\/\*[\s\S]*?\*\//g," ").trim().replace(/\s+/g," ");
      stack.push({header,begin:i+1,line:source.slice(0,i).split("\n").length,children:false});
      start=i+1;
    }else if(c==="}"){
      const block=stack.pop();
      if(!block)throw Error("Unmatched closing brace");
      const body=source.slice(block.begin,i).trim().replace(/\s+/g," ");
      if(!block.children&&!block.header.startsWith("@")){
        const parents=stack.map(x=>x.header);
        blocks.push({selector:block.header,body,context:parents,line:block.line});
      }
      if(stack.length)stack[stack.length-1].children=true;
      start=i+1;
    }else if(c===";"&&stack.length===0)start=i+1;
  }
  if(stack.length||quote||comment||paren||bracket)throw Error("Unbalanced CSS input");
  const groups=new Map();
  for(const block of blocks){
    // Context includes media/supports/container and keyframes; names are never discarded.
    const key=JSON.stringify([block.context,block.selector,block.body]);
    groups.set(key,[...(groups.get(key)||[]),block]);
  }
  return {leafRules:blocks.length,identicalContextGroups:[...groups.values()]
    .filter(group=>group.length>1)
    .map(group=>({selector:group[0].selector,context:group[0].context,lines:group.map(x=>x.line)}))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const path=process.argv[2]||"assets/app.css";
  console.log(JSON.stringify({file:path,...inventoryCss(readFileSync(path,"utf8"))},null,2));
}
