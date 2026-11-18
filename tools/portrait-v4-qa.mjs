/**
 * Read-only V4/V4.1 portrait technical QA (Node 22).
 *
 * No image edits, uploads, identity inference, D1 writes or publication.
 * For actual derivative pixels, FFmpeg must decode the exact WebP bytes;
 * an un-decodable WebP can NEVER receive a technical PASS.
 */
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectPortraitPng} from './portrait-png-preflight.mjs';

export const V4_QA_VERSION='portrait-qa-v4-v1';
export const V4_DERIVATIVE_SIZE=Object.freeze({width:320,height:362});
export const V4_ALPHA_THRESHOLD=64;
export const V4_MIN_FOREGROUND_ROW_PIXELS=3;
export const V4_MANUAL_REVIEW=Object.freeze([
 'exactly_one_individual','frozen_facial_traits','ordinary_adult_male',
 'body_profile_consistency','natural_appearance_no_beauty_retouching',
 'plain_white_regular_fit_jersey','all_hair_and_arms_visible',
 'head_to_hips_crop','face_scale_and_centering','skin_and_edge_color_fidelity',
 'no_lookalike_players','owner_approval'
]);

function finding(code,level,action,detail){
 return {code,level,action,detail};
}
function result(status,findings,metrics,extra={}){
 return {qaVersion:V4_QA_VERSION,status,findings,metrics,
  manualReviewRequired:V4_MANUAL_REVIEW,ownerApprovalRequired:true,approved:false,...extra};
}
function determineStatus(findings){
 return findings.some(x=>x.level==='FAIL')?'FAIL':
  findings.some(x=>x.level==='NOTE')?'PASS_WITH_NOTE':'PASS';
}
function invalid(stage,code,detail){
 const issues=[finding(code,'FAIL','REGENERATE',detail)];
 return result('FAIL',issues,null,{stage});
}
function checkedPixels({width,height,pixels}){
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||
    width<=0||height<=0||width>4096||height>4096||width*height>12000000)
  throw new TypeError('invalid_image_dimensions');
 if(!(pixels instanceof Uint8Array)||pixels.length!==width*height*4)
  throw new TypeError('invalid_rgba_pixel_data');
}
function alphaOf(pixels,width,x,y){
 return pixels[(y*width+x)*4+3];
}

/**
 * Pure deterministic QA of DECODED real RGBA pixels.
 * stage='source' uses PNG geometry without derivative pixel targets.
 * stage='derivative' enforces the final 320x362 framing.
 */
export function inspectV4Rgba({width,height,pixels,stage='derivative'}){
 if(stage!=='source'&&stage!=='derivative')throw new TypeError('invalid_qa_stage');
 checkedPixels({width,height,pixels});
 const findings=[],rows=new Uint32Array(height),total=width*height;
 let zero=0,opaque=0,partial=0,foreground=0;
 let minX=width,maxX=-1,minY=height,maxY=-1;
 let tintedEdgeCount=0,edgeSamples=0;
 for(let y=0;y<height;y++){
  for(let x=0;x<width;x++){
   const p=(y*width+x)*4,a=pixels[p+3];
   if(a===0)zero++;
   else if(a===255)opaque++;
   else partial++;
   if(a>=V4_ALPHA_THRESHOLD){
    foreground++;rows[y]++;
    if(x<minX)minX=x;
    if(x>maxX)maxX=x;
    if(y<minY)minY=y;
    if(y>maxY)maxY=y;
   }
   // Edge-fringe warning, not an assertion about skin/hair identity.
   // Require a nearby transparent pixel and a highly saturated semi-alpha color.
   if(a>=16&&a<=190&&x>0&&x<width-1&&y>0&&y<height-1){
    const touchesClear=alphaOf(pixels,width,x-1,y)<=8||
     alphaOf(pixels,width,x+1,y)<=8||
     alphaOf(pixels,width,x,y-1)<=8||
     alphaOf(pixels,width,x,y+1)<=8;
    if(touchesClear){
     edgeSamples++;
     const r=pixels[p],g=pixels[p+1],b=pixels[p+2];
     const hi=Math.max(r,g,b),lo=Math.min(r,g,b);
     if(hi>=210&&lo<=75&&hi-lo>=145)tintedEdgeCount++;
    }
   }
  }
 }
 const topMargin=rows.findIndex(count=>count>=V4_MIN_FOREGROUND_ROW_PIXELS);
 const box=foreground?{left:minX,top:minY,right:maxX,bottom:maxY}:null;
 const sideLeft=box?box.left:null;
 const sideRight=box?width-1-box.right:null;
 const centerOffset=box?(box.left+box.right-(width-1))/2:null;
 const metrics={width,height,stage,topMargin,
  alphaThreshold:V4_ALPHA_THRESHOLD,minRowPixels:V4_MIN_FOREGROUND_ROW_PIXELS,
  boundingBox:box,leftClearance:sideLeft,rightClearance:sideRight,
  centerOffset,fullyTransparentPixels:zero,fullyOpaquePixels:opaque,
  partiallyTransparentPixels:partial,foregroundPixels:foreground,
  transparentFraction:Number((zero/total).toFixed(5)),
  tintedEdgeSamples:tintedEdgeCount,inspectedEdgeSamples:edgeSamples};
 if(zero/total<0.04)
  findings.push(finding('missing_genuine_transparency','FAIL','REGENERATE',
   'At least 4% of pixels must be completely transparent.'));
 if(foreground/total<0.08||topMargin<0)
  findings.push(finding('missing_visible_subject','FAIL','REGENERATE',
   'Insufficient significant alpha foreground.'));
 for(const [x,y] of [[0,0],[width-1,0],[0,height-1],[width-1,height-1]]){
  if(alphaOf(pixels,width,x,y)!==0){
   findings.push(finding('nontransparent_corner','FAIL','PIXEL_REPAIR',
    'All four corner alpha values must be exactly zero.'));
   break;
  }
 }
 if(stage==='source'){
  if(Math.abs(width/height-3/4)>0.002)
   findings.push(finding('source_not_3_4','FAIL','REGENERATE','Source PNG must be 3:4.'));
 }else{
  if(width!==V4_DERIVATIVE_SIZE.width||height!==V4_DERIVATIVE_SIZE.height)
   findings.push(finding('wrong_derivative_dimensions','FAIL','PIXEL_REPAIR',
    'Final WebP derivative must be exactly 320 x 362.'));
  if(topMargin>=0){
   if(topMargin>12)
    findings.push(finding('top_margin_exceeds_tolerance','FAIL','PIXEL_REPAIR',
     'Significant top margin exceeds 12 px; adjust crop/placement and recheck hair.'));
   else if(topMargin<3||topMargin>8)
    findings.push(finding('top_margin_outside_target','NOTE','VISUAL_REVIEW',
     'Target 3-8 px; inspect all hair before allowing 0-2 or 9-12 px.'));
  }
  if(box){
   if(sideLeft===0||sideRight===0)
    findings.push(finding('subject_touches_side','FAIL','REGENERATE',
     'A side touches the frame; review missing hair/arm anatomy.'));
   else if(sideLeft<16||sideRight<16)
    findings.push(finding('insufficient_side_clearance','FAIL','PIXEL_REPAIR',
     'Less than 16 px side space; inspect and recenter without removing anatomy.'));
   else if(sideLeft<20||sideRight<20)
    findings.push(finding('side_clearance_below_target','NOTE','VISUAL_REVIEW',
     'Prefer at least 20 px on each side.'));
   if(Math.abs(centerOffset)>10)
    findings.push(finding('subject_off_center','FAIL','PIXEL_REPAIR',
     'Bounding-box horizontal center deviates more than 10 px.'));
   else if(Math.abs(centerOffset)>8)
    findings.push(finding('centering_needs_review','NOTE','VISUAL_REVIEW',
     'Bounding-box horizontal center is outside the +/-8 px target.'));
  }
 }
 if(tintedEdgeCount>=12&&edgeSamples>0&&tintedEdgeCount/edgeSamples>=0.08)
  findings.push(finding('possible_chromatic_fringe','NOTE','VISUAL_REVIEW',
   'Strongly saturated semi-transparent edge pixels detected; verify hair/skin on contrasting backgrounds.'));
 return result(determineStatus(findings),findings,metrics,{stage});
}

/** Parse RIFF/WebP container and declared dimensions; pixels still require decode. */
export function inspectWebPHeader(bytes){
 const b=Buffer.from(bytes);
 if(b.length<20||b.toString('ascii',0,4)!=='RIFF'||
    b.toString('ascii',8,12)!=='WEBP'||b.readUInt32LE(4)+8!==b.length)
  throw new TypeError('invalid_webp_container');
 let offset=12,declared=null,coded=null,extended=false,hasAlphaSignal=false,animated=false;
 while(offset<b.length){
  if(offset+8>b.length)throw new TypeError('truncated_webp_chunk');
  const fourcc=b.toString('ascii',offset,offset+4),size=b.readUInt32LE(offset+4);
  const start=offset+8,end=start+size;
  if(end>b.length||end+(size%2)>b.length)throw new TypeError('truncated_webp_chunk');
  if(fourcc==='VP8X'){
   if(size<10||extended)throw new TypeError('invalid_webp_header');
   extended=true;
   const flags=b[start];
   declared={width:1+b[start+4]+(b[start+5]<<8)+(b[start+6]<<16),
    height:1+b[start+7]+(b[start+8]<<8)+(b[start+9]<<16)};
   hasAlphaSignal=(flags&0x10)!==0;
   animated=(flags&0x02)!==0;
  }else if(fourcc==='VP8L'){
   if(size<5||b[start]!==0x2f||coded)throw new TypeError('invalid_webp_image_chunk');
   coded={width:1+b[start+1]+((b[start+2]&63)<<8),
    height:1+(b[start+2]>>6)+(b[start+3]<<2)+((b[start+4]&15)<<10)};
   if(!extended)hasAlphaSignal=(b[start+4]&0x10)!==0;
  }else if(fourcc==='VP8 '){
   if(size<10||coded||b[start+3]!==0x9d||b[start+4]!==0x01||b[start+5]!==0x2a)
    throw new TypeError('invalid_webp_image_chunk');
   coded={width:b.readUInt16LE(start+6)&0x3fff,height:b.readUInt16LE(start+8)&0x3fff};
  }else if(fourcc==='ANIM'||fourcc==='ANMF')animated=true;
  offset=end+(size%2);
 }
 if(!coded||animated)throw new TypeError(animated?'animated_webp_not_allowed':'missing_webp_image_data');
 const dims=declared||coded;
 if(declared&&(declared.width!==coded.width||declared.height!==coded.height))
  throw new TypeError('mismatched_webp_dimensions');
 if(!dims.width||!dims.height||dims.width>4096||dims.height>4096)
  throw new TypeError('invalid_webp_dimensions');
 return {format:'WebP',width:dims.width,height:dims.height,extended,hasAlphaSignal,animated:false};
}

/**
 * Uses a REAL WebP decoder, not RIFF header guesses, to recover alpha pixels.
 * FFmpeg must be installed locally and on PATH; errors fail closed.
 */
export function decodeWebPWithFfmpeg(bytes){
 const b=Buffer.from(bytes),header=inspectWebPHeader(b);
 const size=header.width*header.height*4;
 const child=spawnSync('ffmpeg',[
  '-hide_banner','-loglevel','error','-nostdin','-i','pipe:0',
  '-frames:v','1','-f','rawvideo','-pix_fmt','rgba','pipe:1'
 ],{input:b,encoding:'buffer',maxBuffer:Math.max(size+1024,128*1024),
  timeout:15000,windowsHide:true});
 if(child.error){
  if(child.error.code==='ENOENT')throw new TypeError('ffmpeg_decoder_unavailable');
  throw new TypeError('ffmpeg_decode_error: '+child.error.message);
 }
 if(child.status!==0||!child.stdout||child.stdout.length!==size)
  throw new TypeError('webp_decode_failed');
 return {width:header.width,height:header.height,pixels:child.stdout,header};
}

export function auditV4Png(bytes){
 try{
  const inspected=inspectPortraitPng(bytes,{includePixels:true});
  const report=inspectV4Rgba({width:inspected.width,height:inspected.height,
   pixels:inspected.pixels,stage:'source'});
  const findings=[...report.findings];
  for(const code of inspected.issues){
   if(!findings.some(f=>f.code===code))
    findings.push(finding(code,'FAIL','REGENERATE','Legacy PNG structural preflight rejected this input.'));
  }
  return {...report,format:'PNG RGBA 8-bit',findings,status:determineStatus(findings)};
 }catch(error){return invalid('source','invalid_source_png',error.message)}
}

export function auditV4WebP(bytes,{decoder=decodeWebPWithFfmpeg}={}){
 try{
  const header=inspectWebPHeader(bytes);
  const decoded=decoder(bytes);
  if(!decoded||decoded.width!==header.width||decoded.height!==header.height)
   throw new TypeError('webp_decoder_dimension_mismatch');
  const report=inspectV4Rgba({...decoded,stage:'derivative'});
  const findings=[...report.findings];
  if(!header.hasAlphaSignal)
   findings.push(finding('webp_alpha_not_declared','FAIL','REGENERATE',
    'WebP bitstream does not advertise an alpha channel.'));
  return {...report,format:'WebP',header,findings,status:determineStatus(findings)};
 }catch(error){return invalid('derivative','invalid_or_undecodable_webp',error.message)}
}

export function auditV4PortraitPair({sourcePng,derivativeWebP,decoder}={}){
 if(!sourcePng&&!derivativeWebP)throw new TypeError('missing_portrait_files');
 const source=sourcePng?auditV4Png(sourcePng):null;
 const derivative=derivativeWebP?auditV4WebP(derivativeWebP,{decoder}):null;
 const stages=[source,derivative].filter(Boolean);
 const status=stages.some(x=>x.status==='FAIL')?'FAIL':
  !source||!derivative?'INCOMPLETE':
  stages.some(x=>x.status==='PASS_WITH_NOTE')?'PASS_WITH_NOTE':'PASS';
 const sha256=bytes=>bytes?createHash('sha256').update(bytes).digest('hex'):null;
 return {qaVersion:V4_QA_VERSION,status,
  source,derivative,
  sha256:{sourcePng:sha256(sourcePng),derivativeWebP:sha256(derivativeWebP)},
  manualReviewRequired:V4_MANUAL_REVIEW,ownerApprovalRequired:true,approved:false,
  notes:!source||!derivative?['Both the source PNG and final WebP are required for complete technical QA.']:[]
 };
}

function usage(){
 return 'Usage: node tools/portrait-v4-qa.mjs --png candidate.png --webp final.webp';
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.length<2||args.length%2!==0||args.some((x,i)=>i%2===0&&!['--png','--webp'].includes(x))){
  console.error(usage());process.exitCode=2;
 }else{
  const options={};
  let malformed=false;
  for(let i=0;i<args.length;i+=2){
   const key=args[i];
   if(options[key]||!args[i+1]||args[i+1].startsWith('--'))malformed=true;
   options[key]=args[i+1];
  }
  if(malformed){console.error(usage());process.exitCode=2;}
  else{
   try{
    const sourcePng=options['--png']?await readFile(options['--png']):null;
    const derivativeWebP=options['--webp']?await readFile(options['--webp']):null;
    const report=auditV4PortraitPair({sourcePng,derivativeWebP});
    console.log(JSON.stringify(report,null,2));
    if(report.status==='FAIL'||report.status==='INCOMPLETE')process.exitCode=1;
   }catch(error){
    console.error(JSON.stringify({status:'FAIL',error:error.message}));
    process.exitCode=1;
   }
  }
 }
}
