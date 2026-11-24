// Compare archived research without changing its historical JSON.
// Only the known cross-engine representation differences are normalized.
import assert from 'node:assert/strict';
function normalize(value,key='',parent=''){
 if(typeof value==='number'){
  if(key==='expectedSurplusArc'&&Object.is(value,-0))return 0;
  if((key==='exponent'&&parent==='license')||key==='licenseExponent')return Number(value.toFixed(12));
  return value;
 }
 if(Array.isArray(value))return value.map(v=>normalize(v,'',key));
 if(value!==null&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,normalize(v,k,key)]));
 return value;
}
export function assertArchivedCalibration(actual,expected){
 assert.deepStrictEqual(normalize(actual),normalize(expected));
}
