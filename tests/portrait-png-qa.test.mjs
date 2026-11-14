import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {inspectPortraitPng} from '../tools/portrait-png-qa.mjs';

function png(width=60,height=80,{mode='rgba',pieces=[[15,10,44,79]],halo=false}={}){
 const channels=mode==='rgba'?4:3;
 const rowBytes=width*channels,raw=Buffer.alloc((rowBytes+1)*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const position=y*(rowBytes+1)+1+x*channels;
  const inBody=pieces.some(([l,t,r,b])=>x>=l&&x<=r&&y>=t&&y<=b);
  let edge=false;
  if(!inBody)edge=pieces.some(([l,t,r,b])=>x>=l-1&&x<=r+1&&y>=t-1&&y<=b+1);
  const colour=halo&&edge?[248,10,0]:[175,140,100];
  raw[position]=colour[0];raw[position+1]=colour[1];raw[position+2]=colour[2];
  if(channels===4)raw[position+3]=inBody?255:edge?60:0;
 }
 function chunk(tag,data){const header=Buffer.alloc(8);header.writeUInt32BE(data.length);header.write(tag,4,'ascii');return Buffer.concat([header,data,Buffer.alloc(4)])}
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=channels===4?6:2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
test('clean individual RGBA cutout passes',()=>{
 const result=inspectPortraitPng(png());assert.equal(result.pass,true,JSON.stringify(result));
 assert.equal(result.metrics.subject_components,1);
});
test('painted RGB background is rejected',()=>{
 const result=inspectPortraitPng(png(60,80,{mode:'rgb'}));
 assert.equal(result.pass,false);assert.ok(result.failures.includes('not_8bit_noninterlaced_rgba_png'));
});
test('saturated red fringe around alpha edges fails',()=>{
 const r=inspectPortraitPng(png(60,80,{halo:true}));assert.ok(r.failures.includes('strong_colored_alpha_edge_fringe'));
});
test('three disconnected large subjects fail',()=>{
 const r=inspectPortraitPng(png(90,120,{pieces:[[6,10,28,119],[34,10,56,119],[62,10,84,119]]}));
 assert.ok(r.failures.includes('expected_one_connected_subject'),JSON.stringify(r));
});
test('wrong aspect and visible clipping are rejected',()=>{
 const a=inspectPortraitPng(png(90,80,{pieces:[[0,0,89,60]]}));
 assert.ok(a.failures.includes('aspect_ratio_not_3_by_4'));
 assert.ok(a.failures.includes('hair_too_close_to_top_edge'));
 assert.ok(a.failures.includes('subject_clipped_at_sides'));
});
test('truncated PNG fails closed',()=>{
 assert.throws(()=>inspectPortraitPng(png().subarray(0,44)),/truncated|incomplete/);
});
