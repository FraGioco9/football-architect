import assert from 'node:assert/strict';
import test from 'node:test';
import {deflateSync} from 'node:zlib';
import {inspectPortraitPng} from '../tools/portrait-png-preflight.mjs';

const MAGIC=Buffer.from([137,80,78,71,13,10,26,10]);
function crc32(data){
 let crc=0xffffffff;
 for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^(crc&1?0xedb88320:0)}
 return (crc^0xffffffff)>>>0;
}
function chunk(name,data){
 const tag=Buffer.from(name,'ascii'),size=Buffer.alloc(4),check=Buffer.alloc(4);
 size.writeUInt32BE(data.length);check.writeUInt32BE(crc32(Buffer.concat([tag,data])));
 return Buffer.concat([size,tag,data,check]);
}
function png({width=12,height=16,rgba=true,opaqueBackground=false,paintCorner=false,empty=false}={}){
 const channels=rgba?4:3,header=Buffer.alloc(13);
 header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);
 header[8]=8;header[9]=rgba?6:2;
 const rows=[];
 for(let y=0;y<height;y++){
  const row=Buffer.alloc(1+width*channels);
  for(let x=0;x<width;x++){
   const subject=!empty&&x>=3&&x<=8&&y>=2&&y<=height-3;
   const idx=1+x*channels;
   const checker=((x+y)%2)*100+110;
   row[idx]=subject?180:checker;row[idx+1]=subject?130:checker;row[idx+2]=subject?90:checker;
   if(rgba)row[idx+3]=subject||opaqueBackground||(paintCorner&&x===0&&y===0)?255:0;
  }
  rows.push(row);
 }
 return Buffer.concat([
  MAGIC,chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))
 ]);
}
test('accepts a 3:4 RGBA portrait with truly transparent outside pixels',()=>{
 const r=inspectPortraitPng(png());
 assert.equal(r.ok,true);assert.equal(r.width,12);assert.equal(r.height,16);
 assert.ok(r.transparentPixels>0);assert.ok(r.opaquePixels>0);
 assert.ok(r.manualReviewRequired.includes('owner_approval'));
});
test('rejects a painted checkerboard on an opaque alpha channel',()=>{
 const r=inspectPortraitPng(png({opaqueBackground:true}));
 assert.equal(r.ok,false);assert.ok(r.issues.includes('missing_genuine_transparent_background'));
});
test('rejects RGB output even when checkerboard pixels are drawn',()=>{
 assert.throws(()=>inspectPortraitPng(png({rgba:false})),/requires_8bit_noninterlaced_rgba/);
});
test('rejects wrong aspect, empty subject and nontransparent corner',()=>{
 assert.ok(inspectPortraitPng(png({width:16,height:12})).issues.includes('aspect_ratio_not_3_4'));
 assert.ok(inspectPortraitPng(png({empty:true})).issues.includes('missing_visible_subject'));
 assert.ok(inspectPortraitPng(png({paintCorner:true})).issues.includes('corners_not_transparent'));
});
test('rejects damaged and non-PNG bytes',()=>{
 assert.throws(()=>inspectPortraitPng(Buffer.from('not a PNG')),/not_png/);
 assert.throws(()=>inspectPortraitPng(png().subarray(0,35)),/truncated_png_chunk|incomplete_png/);
});
