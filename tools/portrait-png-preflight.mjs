/**
 * #635 — Read-only PNG preflight for ChatGPT portrait candidates (Node 22).
 * Checks structural 3:4 RGBA and genuine outer transparency; NOT a substitute
 * for visual/identity/one-person/crop/edge-fringe QA or owner approval.
 *
 * Usage: node tools/portrait-png-preflight.mjs path/to/candidate.png
 */
import {inflateSync} from 'node:zlib';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);

function fail(reason){throw new Error(reason)}
function paeth(a,b,c){
 const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);
 return da<=db&&da<=dc?a:db<=dc?b:c;
}

/** Throws on invalid/unsupported PNG. Deliberately fail closed. */
export function inspectPortraitPng(bytes,{includePixels=false}={}){
 const data=Buffer.from(bytes);
 if(!data.subarray(0,8).equals(SIGNATURE))fail('not_png');
 let offset=8,width,height,bitDepth,colorType,interlace;
 const compressed=[];
 let seenIHDR=false,seenIEND=false;
 while(offset+12<=data.length){
  const length=data.readUInt32BE(offset),end=offset+12+length;
  if(end>data.length)fail('truncated_png_chunk');
  const kind=data.toString('ascii',offset+4,offset+8),chunk=data.subarray(offset+8,offset+8+length);
  if(kind==='IHDR'){
   if(seenIHDR||length!==13||offset!==8)fail('invalid_png_header');
   seenIHDR=true;
   width=chunk.readUInt32BE(0);height=chunk.readUInt32BE(4);
   bitDepth=chunk[8];colorType=chunk[9];interlace=chunk[12];
   if(!width||!height||width>4096||height>4096||width*height>12000000)fail('invalid_png_dimensions');
   if(chunk[10]!==0||chunk[11]!==0)fail('unsupported_png_compression');
  }else if(kind==='IDAT'){
   if(!seenIHDR)fail('missing_png_header');
   compressed.push(chunk);
  }else if(kind==='IEND'){
   if(length!==0)fail('invalid_png_end');
   seenIEND=true;offset=end;break;
  }
  offset=end;
 }
 if(!seenIHDR||!seenIEND||!compressed.length||offset!==data.length)fail('incomplete_png');
 // PNG with RGB pixels or palette can DISPLAY a checkerboard while having no alpha.
 if(colorType!==6||bitDepth!==8||interlace!==0)fail('requires_8bit_noninterlaced_rgba');
 const rowSize=width*4,stride=rowSize+1,expected=stride*height;
 let inflated;
 try{inflated=inflateSync(Buffer.concat(compressed),{maxOutputLength:expected+1})}
 catch{fail('invalid_png_image_data')}
 if(inflated.length!==expected)fail('invalid_png_scanlines');
 let prior=Buffer.alloc(rowSize);
 const decoded=includePixels?Buffer.alloc(width*height*4):null;
 const corners=[],total=width*height;
 let zeroAlpha=0,partialAlpha=0,opaqueAlpha=0;
 for(let y=0;y<height;y++){
  const position=y*stride,filter=inflated[position],current=Buffer.allocUnsafe(rowSize);
  if(filter>4)fail('invalid_png_filter');
  for(let x=0;x<rowSize;x++){
   const left=x>=4?current[x-4]:0,up=prior[x],upperLeft=x>=4?prior[x-4]:0;
   const predictor=filter===0?0:filter===1?left:filter===2?up:
    filter===3?Math.floor((left+up)/2):paeth(left,up,upperLeft);
   current[x]=(inflated[position+1+x]+predictor)&255;
  }
  for(let x=0;x<width;x++){
   const alpha=current[x*4+3];
   if(alpha===0)zeroAlpha++;
   else if(alpha===255)opaqueAlpha++;
   else partialAlpha++;
   if((y===0||y===height-1)&&(x===0||x===width-1))corners.push(alpha);
  }
  if(decoded)current.copy(decoded,y*rowSize);
  prior=current;
 }
 const issues=[];
 if(Math.abs(width/height-3/4)>0.002)issues.push('aspect_ratio_not_3_4');
 if(zeroAlpha/total<0.04)issues.push('missing_genuine_transparent_background');
 if((opaqueAlpha+partialAlpha)/total<0.08)issues.push('missing_visible_subject');
 if(corners.length!==4||corners.some(a=>a!==0))issues.push('corners_not_transparent');
 return {ok:issues.length===0,width,height,format:'PNG RGBA 8-bit',transparentPixels:zeroAlpha,
  partialAlphaPixels:partialAlpha,opaquePixels:opaqueAlpha,issues,
  manualReviewRequired:['exactly_one_subject','frozen_facial_traits','plain_white_kit',
   'head_to_hips_crop','natural_edges_no_color_fringe','owner_approval'],
  ...(decoded?{pixels:decoded}:{})};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const target=process.argv[2];
 if(!target){console.error('Usage: node tools/portrait-png-preflight.mjs <candidate.png>');process.exitCode=2}
 else {
  try{const result=inspectPortraitPng(await readFile(target));
   console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;
  }catch(error){console.error(JSON.stringify({ok:false,error:error.message}));process.exitCode=1}
 }
}
