// DIV-ASSET-07: deterministic SVG paths; no separate logo registry.
import {readFileSync,lstatSync,readdirSync} from "node:fs";
import {createHash} from "node:crypto";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
const ROOT=fileURLToPath(new URL("../",import.meta.url));
const CANONICAL=JSON.parse(readFileSync(new URL("../data/divisions.json",import.meta.url),"utf8"));
// SHA-256 of sorted (UTF-8 relative path + NUL + original bytes), approved ZIP.
const APPROVED_SHA256="5850305468a3e61a1f5a88a2d427f3f86fdb9cd4a0e7063ab61a64ced7e80e8d";
const fail=message=>{throw Error("Division assets invalid: "+message);};
export const divisionAssetPath=(division,variant)=>{
 if(!["primary","compact"].includes(variant))fail("variant");
 const slug=division.id.toLowerCase()+"-"+division.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
 return `assets/divisions/${slug}/${variant}.svg`;
};
// Deliberately narrow XML/CSS grammar for the approved path-only artwork.
// Everything outside this grammar is rejected, including entities and references.
export function validateDivisionSvg(raw,division){
 const source=Buffer.isBuffer(raw)?raw.toString("utf8"):raw;
 const svg=source.replace(/^<\?xml version=['"]1\.0['"] encoding=['"][Uu][Tt][Ff]-8['"]\?>\s*/,"").trim();
 if(!svg.startsWith('<svg ')||!svg.endsWith('</svg>')||/[&]|<!|<\?/.test(svg))fail("XML structure");
 const stack=[],allowed={svg:new Set(["xmlns","version","viewBox","width","height"]),style:new Set(),g:new Set(["transform","data-lettering","class"]),path:new Set(["class","d","fill-rule","transform"])};
 const colors=new Set([division.primaryHex,division.secondaryHex,division.ivoryHex].map(c=>c.toLowerCase()));
 let offset=0,rootAttributes,styleCount=0,pathCount=0;
 for(const match of svg.matchAll(/<([^<>]+)>/g)){
  const between=svg.slice(offset,match.index);
  if(stack.at(-1)==="style"){
   const css=between.replace(/tspan\s*\{\s*white-space:pre\s*\}/g,"").replace(/\.s[01]\s*\{\s*fill:\s*(#[0-9a-fA-F]{6})\s*\}/g,(_,color)=>{
    if(!colors.has(color.toLowerCase()))fail("noncanonical color");return "";
   });
   if(css.trim())fail("unsafe CSS");
  }else if(between.trim())fail("text content");
  const token=match[1];
  if(token.startsWith("/")){
   if(stack.pop()!==token.slice(1))fail("XML nesting");
  }else{
   const tag=token.match(/^([a-z]+)(?=\s|\/|$)/)?.[1];
   if(!allowed[tag]||(!stack.length&&rootAttributes)|| (stack.length&&tag==="svg")||stack.at(-1)==="style")fail("element");
   let rest=token.slice(tag.length).replace(/\/$/,""),attrs={};
   while(rest.trim()){
    const a=rest.match(/^\s+([\w-]+)="([^"<>]*)"/);
    if(!a||!allowed[tag].has(a[1])||Object.hasOwn(attrs,a[1]))fail("attribute");
    attrs[a[1]]=a[2];rest=rest.slice(a[0].length);
   }
   if(tag==="svg"){
    rootAttributes=attrs;
    const box=attrs.viewBox?.split(/\s+/).map(Number);
    if(attrs.xmlns!=="http://www.w3.org/2000/svg"||!box||box.length!==4||!box.every(Number.isFinite)||box[2]<=0||box[3]<=0)fail("viewBox");
    for(const dim of ["width","height"])if(attrs[dim]!==undefined&&!/^\d+(?:\.\d+)?$/.test(attrs[dim]))fail("dimensions");
   }
   if(tag==="style")styleCount++;
   if(tag==="path"){
    pathCount++;
    if((attrs.class!==undefined&&!/^s[01]$/.test(attrs.class))||!attrs.d||!/^[MmZzLlHhVvCcSsQqTtAaEe\d\s.,+\-]+$/.test(attrs.d))fail("path");
    if(attrs["fill-rule"]!==undefined&&attrs["fill-rule"]!=="evenodd")fail("fill rule");
   }
   if(attrs.transform!==undefined&&!/^(?:(?:translate|scale|matrix)\([-\d. ,]+\)\s*)+$/.test(attrs.transform))fail("transform");
   if(!token.endsWith("/"))stack.push(tag);
  }
  offset=match.index+match[0].length;
 }
 if(stack.length||svg.slice(offset).trim()||styleCount!==1||!pathCount)fail("incomplete XML");
 return svg;
}
export function validateDivisionAssets(root=ROOT){
 const divisions=new Map(),paths=new Set(),bytes=new Map();
 for(const division of CANONICAL){
  const variants={};
  for(const variant of ["primary","compact"]){
   const path=divisionAssetPath(division,variant),full=join(root,path);
   for(const directory of ["assets","assets/divisions",path.slice(0,path.lastIndexOf("/"))])
    if(lstatSync(join(root,directory)).isSymbolicLink())fail("directory symlink");
   if(lstatSync(full).isSymbolicLink()||!lstatSync(full).isFile())fail("not ordinary file");
   const raw=readFileSync(full);
   variants[variant]=validateDivisionSvg(raw,division);
   paths.add(path);bytes.set(path,raw);
  }
  divisions.set(division.id,variants);
 }
 const hash=createHash("sha256");
 for(const path of [...paths].sort())hash.update(path+"\0").update(bytes.get(path));
 if(hash.digest("hex")!==APPROVED_SHA256)fail("approved SVG integrity");
 const actual=[];
 const walk=dir=>{for(const entry of readdirSync(join(root,dir),{withFileTypes:true})){
  const path=dir+"/"+entry.name;
  if(entry.isSymbolicLink())fail("symlink");
  if(entry.isDirectory())walk(path);else actual.push(path);
 }};
 walk("assets/divisions");
 if(actual.length!==32||actual.some(p=>!paths.has(p)))fail("unexpected division asset");
 return {divisions,paths};
}
// Sources are byte-identical. Declarative shadow roots isolate their original .s0/.s1 CSS.
export function renderDivisionLogo(id,variant,artwork,{large=false,name=null}={}){
 if(!["primary","compact"].includes(variant))fail("variant");
 const escape=s=>String(s).replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");
 const svg=artwork.get(id)?.[variant];
 const a11y=name?'role="img" aria-label="'+escape(name)+'"':'aria-hidden="true"';
 return '<div class="app-competition-logo-placeholder'+(large?' app-competition-logo-placeholder-large':'')+(svg?' app-competition-logo-approved':'')+'" data-division-variant="'+variant+'" '+a11y+'>'+
  (svg?'<template shadowrootmode="open"><style>:host{position:relative}svg{position:absolute;inset:0;display:block;width:100%;height:100%;overflow:visible}</style>'+svg+'</template><span>'+escape(id)+'</span>':escape(id))+'</div>';
}
