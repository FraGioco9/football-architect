import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectSenaGltf,inspectSenaLocalFile,SENA_SOURCE} from
  '../../tools/kit-designer-prototype/inspect-sena-kit.mjs';

function fixture(){
  const names=['Jersey','Shorts','Socks L','Socks R','Cleats L','Cleats R'];
  return {
    asset:{version:'2.0',generator:'synthetic-test'},
    meshes:names.map((name,i)=>({name,primitives:[{attributes:{POSITION:0},
      indices:1,material:i}]})),
    materials:names.map(name=>({name})),
    nodes:names.map((name,mesh)=>({name,mesh})),
    scenes:[{nodes:[0,1,2,3,4,5]}],scene:0,
    buffers:[{uri:'shirt.bin',byteLength:12}],
    images:[{uri:'textures/cloth.png'}],
    textures:[{source:0}]
  };
}
test('KM-04 Alberto Sena package inventory is explicit and never assumes a license',()=>{
  const report=inspectSenaGltf(Buffer.from(JSON.stringify(fixture())),'sena.gltf');
  assert.equal(report.source,SENA_SOURCE);
  assert.equal(report.meshCount,6);
  assert.equal(report.completeByNames,true);
  assert.deepEqual(Object.keys(report.groups),['jersey','shorts','socks','boots']);
  for(const ids of Object.values(report.groups))
    assert.ok(ids.length>0,'Every garment category is independently identifiable');
  assert.match(report.licence,/NOT VERIFIED/);
  assert.match(report.fit,/NOT VERIFIED/);
  assert.equal(report.textureCount,1);
  assert.equal(report.referencedUris.length,2);
});
test('KM-04 ambiguous kits are NOT treated as verified separate garment parts',()=>{
  const asset=fixture();
  asset.meshes.forEach((m,i)=>m.name='Object_'+i);
  asset.nodes.forEach((m,i)=>m.name='Node_'+i);
  asset.materials.forEach((m,i)=>m.name='Mat_'+i);
  const report=inspectSenaGltf(Buffer.from(JSON.stringify(asset)),'sena.gltf');
  assert.equal(report.completeByNames,false);
  assert.equal(report.unclassifiedMeshes.length,6);
  assert.ok(Object.values(report.groups).every(ids=>ids.length===0));
});
test('KM-04 GLB container is checked without any external 3D-model dependencies',()=>{
  const json=Buffer.from(JSON.stringify(fixture()));
  const padding=(4-json.length%4)%4;
  const body=Buffer.concat([json,Buffer.alloc(padding,0x20)]);
  const glb=Buffer.alloc(12+8+body.length);
  glb.writeUInt32LE(0x46546c67,0);
  glb.writeUInt32LE(2,4);
  glb.writeUInt32LE(glb.length,8);
  glb.writeUInt32LE(body.length,12);
  glb.writeUInt32LE(0x4e4f534a,16);
  body.copy(glb,20);
  assert.equal(inspectSenaGltf(glb,'Sena.glb').meshCount,6);
  glb.writeUInt32LE(999,8);
  assert.throws(()=>inspectSenaGltf(glb,'Sena.glb'),/Malformed/);
});
test('KM-04 local intake detects missing textures and refuses traversal/remote files',()=>{
  const temp=mkdtempSync(join(tmpdir(),'fa-sena-kit-'));
  try{
    mkdirSync(join(temp,'textures'));
    writeFileSync(join(temp,'shirt.bin'),Buffer.alloc(12));
    writeFileSync(join(temp,'kit.gltf'),JSON.stringify(fixture()));
    const report=inspectSenaLocalFile(join(temp,'kit.gltf'));
    assert.deepEqual(report.missingDependencies,['textures/cloth.png']);
    assert.equal(report.dependencies[0].exists,true);
    writeFileSync(join(temp,'textures','cloth.png'),'placeholder');
    assert.equal(inspectSenaLocalFile(join(temp,'kit.gltf')).missingDependencies.length,0);
    const unsafe=fixture();unsafe.images[0].uri='../secret.png';
    writeFileSync(join(temp,'kit.gltf'),JSON.stringify(unsafe));
    assert.throws(()=>inspectSenaLocalFile(join(temp,'kit.gltf')),/Unsafe|escapes/);
    unsafe.images[0].uri='https://evil.example/cloth.png';
    writeFileSync(join(temp,'kit.gltf'),JSON.stringify(unsafe));
    assert.throws(()=>inspectSenaLocalFile(join(temp,'kit.gltf')),/Unsafe|nonlocal/);
  }finally{rmSync(temp,{recursive:true,force:true});}
});
