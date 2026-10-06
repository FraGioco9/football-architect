/** SIM02.04: deterministic user preset catalog, independent of browser storage. */
import {createTactics,validateTactics,BUILT_IN_STYLES} from './team-tactics.mjs';
export const TACTIC_PRESET_SCHEMA=1;
const fail=(cond,code)=>{if(!cond)throw new Error(`TACTIC_PRESETS_${code}`);};
const id=v=>typeof v==='string'&&v.length>0&&v.length<=80&&/^[\w-]+$/.test(v);
const validName=v=>typeof v==='string'&&v.trim().length>=1&&v.trim().length<=70;
const clone=v=>structuredClone(v);
function check(book){
  fail(book&&book.schemaVersion===1&&Number.isSafeInteger(book.nextId)&&book.nextId>=1&&Number.isSafeInteger(book.revision)&&book.revision>=0&&Array.isArray(book.presets),'BOOK');
  fail(book.presets.length<=40,'LIMIT');
  const seen=new Set();
  for(const p of book.presets){
    fail(p&&id(p.id)&&validName(p.name)&&!seen.has(p.id)&&Number.isSafeInteger(p.revision)&&p.revision>=1,'ENTRY');
    validateTactics(p.tactics);seen.add(p.id);
  }
  return true;
}
export function createTacticBook(){return {schemaVersion:1,nextId:1,revision:0,presets:[]};}
export function addTacticPreset(book,{name,tactics},expectedRevision=book.revision){
  check(book);fail(book.revision===expectedRevision,'CONFLICT');fail(name&&typeof name==='string'&&name.trim().length<=70,'NAME');
  validateTactics(tactics);fail(book.presets.length<40,'LIMIT');
  const result=clone(book),id=`custom-${result.nextId++}`;
  fail(!result.presets.some(p=>p.id===id),'ID_COLLISION');
  result.presets.push({id,name:name.trim(),revision:1,tactics:clone(tactics)});
  result.revision++;return result;
}
export function duplicateTacticPreset(book,id,newName,expectedRevision=book.revision){
  check(book);fail(id&&typeof id==='string','ID');
  const preset=book.presets.find(p=>p.id===id);
  const tactics=preset?.tactics??BUILT_IN_STYLES[id];
  fail(tactics,'NOT_FOUND');return addTacticPreset(book,{name:newName,tactics},expectedRevision);
}
export function updateTacticPreset(book,id,{name,tactics},expectedRevision=book.revision){
  check(book);fail(book.revision===expectedRevision,'CONFLICT');
  const result=clone(book),p=result.presets.find(p=>p.id===id);fail(p,'NOT_FOUND');
  if(name!==undefined){fail(typeof name==='string'&&validName(name),'NAME');p.name=name.trim();}
  if(tactics!==undefined){validateTactics(tactics);p.tactics=clone(tactics);}
  p.revision++;result.revision++;return result;
}
export function removeTacticPreset(book,id,expectedRevision=book.revision){
  check(book);fail(book.revision===expectedRevision,'CONFLICT');
  const result=clone(book);result.presets=result.presets.filter(p=>p.id!==id);
  fail(result.presets.length<book.presets.length,'NOT_FOUND');result.revision++;return result;
}
export function presetTactics(book,id){
  check(book);const value=book.presets.find(p=>p.id===id)?.tactics??BUILT_IN_STYLES[id];
  fail(value,'NOT_FOUND');return clone(value);
}
export function restoreTacticBook(raw){
  const r=typeof raw==='string'?JSON.parse(raw):clone(raw);check(r);return r;
}
