import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeTrimTopology,inspectSenaTrimTopology} from
  '../../tools/kit-designer-prototype/inspect-sena-trim-topology.mjs';
const quad=(x,m)=>({name:'test '+x,material:m,
  points:[[x,0,0],[x+1,0,0],[x,1,0],[x+1,1,0]],
  indices:[0,1,2,1,3,2]});
test('KM-26 identifies author open boundaries and material seams, without painted width',()=>{
  const result=summarizeTrimTopology([quad(0,'base'),quad(1,'rib')]);
  assert.equal(result.uniqueVertices,6);
  assert.equal(result.edgeCounts.exterior,6);
  assert.equal(result.edgeCounts.material,1);
  assert.equal(result.openings.length,1);
  assert.equal(result.openings[0].closed,true);
  assert.equal(result.openings[0].perimeterM,6);
});
test('KM-26 preserves disconnected physical openings independently',()=>{
  const result=summarizeTrimTopology([quad(0,'a'),quad(3,'b')]);
  assert.equal(result.openings.length,2);
  assert.ok(result.openings.every(x=>x.closed));
  assert.equal(result.edgeCounts.material,0);
});
test('KM-26 malformed private assets fail closed, without uploading geometry',()=>{
  assert.throws(()=>inspectSenaTrimTopology(Buffer.from('bad')),/Invalid GLB/);
});
