/** Offline PNG cutout preflight. Pure Node 22, no image API or remote reads.
 * Detects technical failures, not subject identity/face similarity or realism.
 */
import {readFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';

const PNG_SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
const MAX_PIXELS=12_000_000;

function pngImage(input){
 const buf=Buffer.from(input);
 if(buf.length<33||!buf.subarray(0,8).equals(PNG_SIGNATURE))throw new Error('invalid_png_signature');
 let offset=8,header=null,parts=[],hasEnd=false;
 while(offset+12<=buf.length){
  const len=buf.readUInt32BE(offset);const type=buf.toString('ascii',offset+4,offset+8);offset+=8;
  if(len>buf.length-offset-4)throw new Error('truncated_png_chunk');
  const body=buf.subarray(offset,offset+len);offset+=len+4;// CRC bytes, size bounded
  if(type==='IHDR'){
   if(header||len!==13)throw new Error('invalid_png_ihdr');
   const width=body.readUInt32BE(0),height=body.readUInt32BE(4);
   if(!width||!height||width*height>MAX_PIXELS)throw new Error('unsupported_png_dimensions');
   header={width,height,bitDepth:body[8],colorType:body[9],compression:body[10],filter:body[11],interlace:body[12]};
  }else if(type==='IDAT'){parts.push(body)}
  else if(type==='IEND'){hasEnd=true;break}
 }
 if(!header||!hasEnd||!parts.length)throw new Error('incomplete_png');
 if(header.bitDepth!==8||header.colorType!==6||header.compression!==0||header.filter!==0||header.interlace!==0)
  return {...header,unsupported:true};
 const {width,height}=header,stride=width*4;
 const inflated=inflateSync(Buffer.concat(parts),{maxOutputLength:(stride+1)*height});
 if(inflated.length!==(stride+1)*height)throw new Error('invalid_png_scanline_count');
 const pixels=Buffer.allocUnsafe(stride*height);let scan=0;
 for(let y=0;y<height;y++){
  const filter=inflated[scan++],row=y*stride,prior=(y-1)*stride;
  if(filter>4)throw new Error('invalid_png_filter');
  for(let x=0;x<stride;x++){
   const value=inflated[scan++],left=x>=4?pixels[row+x-4]:0,above=y?pixels[prior+x]:0,upperLeft=y&&x>=4?pixels[prior+x-4]:0;
   let prediction=0;
   if(filter===1)prediction=left;
   if(filter===2)prediction=above;
   if(filter===3)prediction=(left+above)>>1;
   if(filter===4){const p=left+above-upperLeft,pa=Math.abs(p-left),pb=Math.abs(p-above),pc=Math.abs(p-upperLeft);prediction=pa<=pb&&pa<=pc?left:pb<=pc?above:upperLeft}
   pixels[row+x]=(value+prediction)&255;
  }
 }
 return {...header,pixels};
}

function countLargeComponents(mask,width,height,minSize){
 const visited=new Uint8Array(mask.length),queue=new Int32Array(mask.length);
 let large=0;
 for(let i=0;i<mask.length;i++){
  if(!mask[i]||visited[i])continue;
  let start=0,end=1,count=0;queue[0]=i;visited[i]=1;
  while(start<end){
   const p=queue[start++],x=p%width,y=(p-x)/width;count++;
   for(const n of [x? p-1:-1,x<width-1?p+1:-1,y?p-width:-1,y<height-1?p+width:-1]){
    if(n>=0&&mask[n]&&!visited[n]){visited[n]=1;queue[end++]=n}
   }
  }
  if(count>=minSize)large++;
 }
 return large;
}

export function inspectPortraitPng(input){
 const img=pngImage(input),{width,height}=img;
 const failures=[];
 if(width/height<0.735||width/height>0.765)failures.push('aspect_ratio_not_3_by_4');
 if(img.unsupported){failures.push('not_8bit_noninterlaced_rgba_png');return {width,height,pass:false,failures,alpha:false};}
 const pix=img.pixels,total=width*height,mask=new Uint8Array(total);
 let empty=0,subject=0,edges=0,saturatedFringe=0,minX=width,minY=height,maxX=-1,maxY=-1;
 for(let p=0;p<total;p++){
  const z=p*4,r=pix[z],g=pix[z+1],b=pix[z+2],a=pix[z+3];
  if(a<=3)empty++;
  if(a>=128){mask[p]=1;subject++;const x=p%width,y=(p-x)/width;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
  if(a>=5&&a<=160){
   edges++;
   if((r>=100&&r>g*1.45&&r>b*1.45&&r-g>35)||
      (r>=100&&g>=70&&b<Math.min(r,g)*.55)||
      (r>=100&&b>=70&&g<Math.min(r,b)*.55))saturatedFringe++;
  }
 }
 const transparencyFraction=empty/total,fringeRate=edges?saturatedFringe/edges:0;
 if(transparencyFraction<.15)failures.push('insufficient_transparent_background');
 if(subject<total*.05)failures.push('subject_missing_or_too_small');
 if(fringeRate>.035&&saturatedFringe>=30)failures.push('strong_colored_alpha_edge_fringe');
 if(maxX>=0){
  if(minY<height*.005)failures.push('hair_too_close_to_top_edge');
  if(minX<width*.01||maxX>width*.99)failures.push('subject_clipped_at_sides');
  if(maxY<height*.87)failures.push('subject_ends_above_hip_crop');
 }
 const componentCount=subject?countLargeComponents(mask,width,height,Math.max(50,Math.floor(subject*.02))):0;
 if(componentCount!==1)failures.push('expected_one_connected_subject');
 return {width,height,pass:!failures.length,failures,alpha:true,
  metrics:{transparency_fraction:+transparencyFraction.toFixed(4),fringe_fraction:+fringeRate.toFixed(4),
    subject_components:componentCount,subject_bbox:maxX<0?null:[minX,minY,maxX,maxY]}};
}

async function main(){
 const files=process.argv.slice(2);
 if(!files.length)throw new Error('usage: node tools/portrait-png-qa.mjs image1.png [image2.png ...]');
 let failed=0;
 for(const path of files){
  const result=inspectPortraitPng(await readFile(path));
  console.log(JSON.stringify({file:path,...result}));
  if(!result.pass)failed++;
 }
 if(failed)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 main().catch(e=>{console.error(e.message);process.exitCode=1});
