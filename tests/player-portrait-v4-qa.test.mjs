import assert from 'node:assert/strict';
import test from 'node:test';
import {deflateSync} from 'node:zlib';
import {inspectPortraitPng} from '../tools/portrait-png-preflight.mjs';
import {
 V4_QA_VERSION,V4_ALPHA_THRESHOLD,V4_MANUAL_REVIEW,
 inspectV4Rgba,inspectWebPHeader,decodeWebPWithFfmpeg,
 auditV4Png,auditV4WebP,auditV4PortraitPair
} from '../tools/portrait-v4-qa.mjs';

function pixels({width=320,height=362,top=5,left=36,right=283,bottom=361,halo=false}={}){
 const data=Buffer.alloc(width*height*4);
 for(let y=top;y<=Math.min(bottom,height-1);y++)
  for(let x=left;x<=Math.min(right,width-1);x++){
   const p=(y*width+x)*4;
   data[p]=175;data[p+1]=136;data[p+2]=101;data[p+3]=255;
  }
 if(halo){
  for(let y=25;y<120;y++){
   const p=(y*width+(left-1))*4;
   data[p]=255;data[p+1]=0;data[p+2]=255;data[p+3]=100;
  }
 }
 return data;
}
function crc32(input){
 let v=0xffffffff;
 for(const n of input){v^=n;for(let k=0;k<8;k++)v=(v>>>1)^((v&1)?0xedb88320:0)}
 return (v^0xffffffff)>>>0;
}
function chunk(tag,payload){
 const name=Buffer.from(tag,'ascii'),size=Buffer.alloc(4),crc=Buffer.alloc(4);
 size.writeUInt32BE(payload.length,0);
 crc.writeUInt32BE(crc32(Buffer.concat([name,payload])),0);
 return Buffer.concat([size,name,payload,crc]);
}
function png(width=300,height=400,alpha=pixels({width:300,height:400,top:10,left:35,right:264,bottom:399})){
 const magic=Buffer.from([137,80,78,71,13,10,26,10]);
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
 const rows=[];
 for(let y=0;y<height;y++){
  const row=Buffer.alloc(1+width*4);alpha.copy(row,1,y*width*4,(y+1)*width*4);rows.push(row);
 }
 return Buffer.concat([magic,chunk('IHDR',ihdr),chunk('IDAT',deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]);
}
// Container-valid (but deliberately not a compressed image); tests inject a pixel
// decoder so the QA routines can be tested without FFmpeg or network access.
function testWebP({width=320,height=362,alpha=true}={}){
 const vp8x=Buffer.alloc(10);vp8x[0]=alpha?0x10:0;
 const w=width-1,h=height-1;
 vp8x[4]=w&255;vp8x[5]=(w>>8)&255;vp8x[6]=(w>>16)&255;
 vp8x[7]=h&255;vp8x[8]=(h>>8)&255;vp8x[9]=(h>>16)&255;
 const vp8l=Buffer.alloc(5);vp8l[0]=0x2f;
 vp8l[1]=w&255;vp8l[2]=((w>>8)&63)|((h&3)<<6);
 vp8l[3]=(h>>2)&255;vp8l[4]=((h>>10)&15)|0x10;
 const make=(tag,data)=>{const s=Buffer.alloc(8);s.write(tag,0,4,'ascii');s.writeUInt32LE(data.length,4);return Buffer.concat([s,data,Buffer.alloc(data.length%2)])};
 const payload=Buffer.concat([make('VP8X',vp8x),make('VP8L',vp8l)]);
 const hdr=Buffer.alloc(12);hdr.write('RIFF',0);hdr.writeUInt32LE(payload.length+4,4);hdr.write('WEBP',8);
 return Buffer.concat([hdr,payload]);
}
const codes=r=>r.findings.map(f=>f.code);
const raw=(settings={})=>inspectV4Rgba({width:settings.width??320,height:settings.height??362,
 pixels:pixels(settings),stage:settings.stage??'derivative'});

test('calibrated final derivative returns PASS, transparent alpha bounds and separate visual approval',()=>{
 const r=raw();
 assert.equal(r.qaVersion,V4_QA_VERSION);
 assert.equal(r.status,'PASS');
 assert.equal(r.approved,false);
 assert.equal(r.ownerApprovalRequired,true);
 assert.ok(V4_MANUAL_REVIEW.includes('frozen_facial_traits'));
 assert.equal(r.metrics.alphaThreshold,V4_ALPHA_THRESHOLD);
 assert.equal(r.metrics.minRowPixels,3);
 assert.equal(r.metrics.topMargin,5);
 assert.deepEqual(r.metrics.boundingBox,{left:36,top:5,right:283,bottom:361});
 assert.equal(r.metrics.leftClearance,36);
 assert.equal(r.metrics.rightClearance,36);
 assert.equal(r.metrics.centerOffset,0);
 assert.equal(r.metrics.fullyTransparentPixels>0,true);
});

test('top margin: 3–8 PASS; 0–2 and 9–12 NOTE; >12 FAIL; source does not use derivative bounds',()=>{
 for(const top of [3,4,7,8])assert.equal(raw({top}).status,'PASS');
 for(const top of [0,1,2,9,11,12]){
  const r=raw({top});
  assert.equal(r.status,'PASS_WITH_NOTE','top='+top);
  assert.ok(codes(r).includes('top_margin_outside_target'));
 }
 for(const top of [13,24,60]){
  const r=raw({top});
  assert.equal(r.status,'FAIL');
  assert.ok(codes(r).includes('top_margin_exceeds_tolerance'));
  assert.equal(r.findings.find(f=>f.code==='top_margin_exceeds_tolerance').action,'PIXEL_REPAIR');
 }
 const source=inspectV4Rgba({width:300,height:400,
  pixels:pixels({width:300,height:400,top:36,left:35,right:264,bottom:399}),stage:'source'});
 assert.equal(source.status,'PASS');
 assert.equal(source.metrics.topMargin,36);
});

test('side clearance, severe miscentering, dimensions and visible side cutoffs fail',()=>{
 const low=raw({left:8,right:311});
 assert.equal(low.status,'FAIL');
 assert.ok(codes(low).includes('insufficient_side_clearance'));
 const note=raw({left:18,right:301});
 assert.equal(note.status,'PASS_WITH_NOTE');
 assert.ok(codes(note).includes('side_clearance_below_target'));
 const uncentered=raw({left:22,right:238});
 assert.equal(uncentered.status,'FAIL');
 assert.ok(codes(uncentered).includes('subject_off_center'));
 const clipped=raw({left:0,right:290});
 assert.equal(clipped.status,'FAIL');
 assert.ok(codes(clipped).includes('subject_touches_side'));
 const size=raw({width:300,height:400,left:35,right:264,bottom:399});
 assert.equal(size.status,'FAIL');
 assert.ok(codes(size).includes('wrong_derivative_dimensions'));
});

test('opaque checkerboards, empty pixels, nontransparent corners and corrupted alpha are blocking',()=>{
 const empty=inspectV4Rgba({width:320,height:362,pixels:Buffer.alloc(320*362*4)});
 assert.equal(empty.status,'FAIL');
 assert.ok(codes(empty).includes('missing_visible_subject'));
 const allOpaque=Buffer.alloc(320*362*4,255);
 const r=inspectV4Rgba({width:320,height:362,pixels:allOpaque});
 assert.equal(r.status,'FAIL');
 assert.ok(codes(r).includes('missing_genuine_transparency'));
 assert.ok(codes(r).includes('nontransparent_corner'));
 assert.equal(r.findings.find(f=>f.code==='missing_genuine_transparency').action,'REGENERATE');
 assert.throws(()=>inspectV4Rgba({width:1,height:1,pixels:new Uint8Array(2)}),/invalid_rgba_pixel_data/);
 assert.throws(()=>inspectV4Rgba({width:10000,height:1,pixels:new Uint8Array(40000)}),/invalid_image_dimensions/);
});

test('saturated semi-alpha border is advisory, not an automatic false rejection',()=>{
 const r=raw({halo:true});
 assert.equal(r.status,'PASS_WITH_NOTE');
 assert.ok(codes(r).includes('possible_chromatic_fringe'));
 assert.equal(r.findings.find(f=>f.code==='possible_chromatic_fringe').action,'VISUAL_REVIEW');
});

test('original PNG V3 preflight stays unchanged; V4 audits genuine unfiltered RGBA pixels',()=>{
 const sourcePng=png();
 const legacy=inspectPortraitPng(sourcePng);
 const extended=inspectPortraitPng(sourcePng,{includePixels:true});
 assert.deepEqual(Object.keys(legacy),Object.keys(extended).filter(k=>k!=='pixels'));
 assert.equal('pixels' in legacy,false);
 assert.equal(extended.pixels.length,300*400*4);
 assert.deepEqual(extended.pixels.subarray(0,4),Buffer.alloc(4));
 assert.equal(legacy.ok,true);
 const r=auditV4Png(sourcePng);
 assert.equal(r.status,'PASS');
 assert.equal(r.metrics.width,300);
 assert.equal(r.metrics.height,400);
 assert.equal(r.metrics.topMargin,10);
 assert.equal(r.approved,false);
 const wrong=auditV4Png(png(320,362,pixels({width:320,height:362})));
 assert.equal(wrong.status,'FAIL');
 assert.ok(codes(wrong).includes('source_not_3_4'));
 assert.equal(auditV4Png(Buffer.from('garbage')).status,'FAIL');
});

test('WebP container validates dimensions, alpha flag, one image and truncation',()=>{
 const bytes=testWebP();
 const h=inspectWebPHeader(bytes);
 assert.deepEqual([h.width,h.height,h.extended,h.hasAlphaSignal,h.animated],[320,362,true,true,false]);
 assert.throws(()=>inspectWebPHeader(Buffer.from('nope')),/invalid_webp_container/);
 assert.throws(()=>inspectWebPHeader(bytes.subarray(0,bytes.length-2)),/invalid_webp_container/);
 const corrupted=Buffer.from(bytes);corrupted.writeUInt32LE(50000,16);
 assert.throws(()=>inspectWebPHeader(corrupted),/truncated_webp_chunk/);
 const animated=Buffer.from(bytes);animated[20]|=0x02;
 assert.throws(()=>inspectWebPHeader(animated),/animated_webp_not_allowed/);
 const noAlpha=inspectWebPHeader(testWebP({alpha:false}));
 assert.equal(noAlpha.hasAlphaSignal,false);
});

test('decoded WebP pixels are required: a plausible header alone can never pass',()=>{
 const fake=testWebP();
 const failed=auditV4WebP(fake);
 assert.equal(failed.status,'FAIL');
 assert.ok(codes(failed).includes('invalid_or_undecodable_webp'));
 const r=auditV4WebP(fake,{decoder:()=>({width:320,height:362,pixels:pixels()})});
 assert.equal(r.status,'PASS');
 assert.equal(r.metrics.topMargin,5);
 assert.equal(r.approved,false);
 const noAlpha=auditV4WebP(testWebP({alpha:false}),{decoder:()=>({width:320,height:362,pixels:pixels()})});
 assert.equal(noAlpha.status,'FAIL');
 assert.ok(codes(noAlpha).includes('webp_alpha_not_declared'));
 const mismatch=auditV4WebP(fake,{decoder:()=>({width:100,height:100,pixels:Buffer.alloc(40000)})});
 assert.equal(mismatch.status,'FAIL');
 assert.ok(codes(mismatch).includes('invalid_or_undecodable_webp'));
});

test('pair report is immutable evidence only; pending until both inputs and manual review',()=>{
 const sourcePng=png(),derivativeWebP=testWebP();
 const report=auditV4PortraitPair({sourcePng,derivativeWebP,
  decoder:()=>({width:320,height:362,pixels:pixels()})});
 assert.equal(report.status,'PASS');
 assert.equal(report.source.status,'PASS');
 assert.equal(report.derivative.status,'PASS');
 assert.match(report.sha256.sourcePng,/^[a-f0-9]{64}$/);
 assert.match(report.sha256.derivativeWebP,/^[a-f0-9]{64}$/);
 assert.notEqual(report.sha256.sourcePng,report.sha256.derivativeWebP);
 assert.equal(report.approved,false);
 assert.equal(report.ownerApprovalRequired,true);
 assert.ok(report.manualReviewRequired.includes('owner_approval'));
 const partial=auditV4PortraitPair({sourcePng});
 assert.equal(partial.status,'INCOMPLETE');
 assert.ok(partial.notes.length);
 const fail=auditV4PortraitPair({sourcePng,derivativeWebP,
  decoder:()=>({width:320,height:362,pixels:pixels({top:24})})});
 assert.equal(fail.status,'FAIL');
 assert.throws(()=>auditV4PortraitPair({}),/missing_portrait_files/);
});

test('read-only decoder is explicit external FFmpeg, not an imaginary WebP pass',()=>{
 const source=decodeWebPWithFfmpeg.toString();
 assert.ok(source.includes('ffmpeg'));
 assert.ok(source.includes('webp_decode_failed'));
 assert.ok(source.includes('pipe:0'));
 assert.ok(source.includes('pipe:1'));
 assert.ok(!source.includes('writeFile'));
});
