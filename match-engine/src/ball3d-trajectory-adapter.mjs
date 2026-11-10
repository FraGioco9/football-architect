// ME-PHYS-14: local-only conversion of an external Soccer Ball 3D ground-truth
// excerpt into the project intake schema. This module DOES NOT download data,
// verify licenses/specimen identities, or promote any calibration to gameplay.
// Input convention is documented in https://github.com/lukaszgrad/ball3d/blob/main/DATA.md
// file_name: zero-based frame; track_id: segment; x,y,z: dm; FPS in sequence_metadata.json.
import {inspectCalibrationDataset} from './calibration-dataset-intake.mjs';

const REQUIRED=Object.freeze(['file_name','track_id','x','y','z']);
const MAX_BYTES=2*1024*1024;
const MAX_ROWS=30000;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const trim=x=>typeof x==='string'?x.trim():'';
const safeId=x=>/^[a-zA-Z0-9_.:-]{1,100}$/.test(x);
const deny=reason=>{throw new RangeError('ME-PHYS-14 invalid external excerpt: '+reason);};

// Small, deliberately strict CSV reader: quoted cells and escaped quotes
// are supported; embedded newlines inside quoted cells are not accepted.
export function parseBall3dCsvExcerpt(csv){
  if(typeof csv!=='string'||!csv.length||csv.length>MAX_BYTES)
    deny('CSV must be bounded non-empty UTF-8 text');
  if(csv.includes('\0'))deny('NUL bytes');
  const lines=csv.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').split('\n').filter((line,i,a)=>!(i===a.length-1&&!line));
  if(lines.length<3||lines.length-1>MAX_ROWS)deny('at least two bounded data rows');
  const parseLine=(line)=>{
    const out=[];let field='',quoted=false,finishedQuote=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(quoted){
        if(ch==='"'&&line[i+1]==='"'){field+='"';i++;}
        else if(ch==='"'){quoted=false;finishedQuote=true;}
        else field+=ch;
      }else if(ch===','){out.push(field);field='';finishedQuote=false;}
      else if(ch==='"'&&field===''&&!finishedQuote){quoted=true;}
      else if(ch==='"'||finishedQuote)deny('invalid CSV quote position');
      else field+=ch;
    }
    if(quoted)deny('unclosed CSV quote');
    out.push(field);
    return out;
  };
  const headers=parseLine(lines[0]).map(h=>h.trim());
  if(new Set(headers).size!==headers.length||REQUIRED.some(h=>!headers.includes(h)))
    deny('missing or duplicated required CSV headers');
  const parsed=lines.slice(1).map((line,index)=>{
    if(line.includes('\r')||line.includes('\n'))deny('embedded newline in CSV row');
    const cells=parseLine(line);
    if(cells.length!==headers.length)deny('column count at line '+(index+2));
    return Object.fromEntries(headers.map((h,i)=>[h,cells[i].trim()]));
  });
  return Object.freeze({headers:Object.freeze(headers),rows:Object.freeze(parsed)});
}

function fpsValue(metadata){
  const raw=metadata?.fps;
  let fps=raw;
  if(typeof raw==='string'&&/^\d{1,6}\/\d{1,6}$/.test(raw)){
    const [num,den]=raw.split('/').map(Number);
    fps=den===0?NaN:num/den;
  }else if(typeof raw==='string'&&/^\d+(?:\.\d+)?$/.test(raw))fps=Number(raw);
  if(!finite(fps)||fps<1||fps>240)deny('valid measured sequence_metadata fps is required');
  return fps;
}
function numberValue(raw,field){
  const value=Number(raw);
  if(raw===''||!finite(value))deny('non-finite or missing '+field);
  return value;
}

// Coordinates are *positions of a tracked ball* and NOT guaranteed to be
// center-of-ball clearance or official game world coordinates. Keep raw
// source axes, no inferred gravity/spin, and no implicit world orientation.
export function adaptBall3dGroundTruthExcerpt({
  csv,metadata,clipId,sourceGroup,specimenId='UNVERIFIED-BALL',
  sourceUrl='https://github.com/lukaszgrad/ball3d/blob/main/DATA.md',
  usageRights='NON-COMMERCIAL RESEARCH; NOT APPROVED FOR GAME'
}={}){
  if(!safeId(clipId)||!safeId(sourceGroup)||!safeId(specimenId))
    deny('explicit clip, acquisition group and specimen label required');
  const fps=fpsValue(metadata),parsed=parseBall3dCsvExcerpt(csv);
  const rows=[];const frameByTrack=new Map();
  for(const source of parsed.rows){
    const frame=numberValue(source.file_name,'file_name');
    if(!Number.isSafeInteger(frame)||frame<0)deny('zero-based integer file_name');
    if(!safeId(source.track_id))deny('bounded track_id');
    const last=frameByTrack.get(source.track_id);
    if(last!==undefined&&frame<=last)deny('repeated/out-of-order frame within track');
    frameByTrack.set(source.track_id,frame);
    const xyz=['x','y','z'].map(key=>numberValue(source[key],key)/10);
    const row={
      sampleId:clipId+':'+source.track_id+':'+frame,
      trackId:clipId+':'+source.track_id,
      timeS:frame/fps,xM:xyz[0],yM:xyz[1],zM:xyz[2]
    };
    rows.push(Object.freeze(row));
  }
  const candidate=Object.freeze({
    datasetId:'ball3d:'+clipId,specimenId,sourceUrl,sourceGroup,
    measurementKind:'trajectory',usageRights,rows:Object.freeze(rows)
  });
  const check=inspectCalibrationDataset(candidate);
  return Object.freeze({
    stage:'UNLICENSED RESEARCH CONVERSION — NO GAME USE',
    candidate,format:check,frames:rows.length,tracks:frameByTrack.size,fps,
    units:Object.freeze({originalPosition:'dm',convertedPosition:'m',
      frameIndex:'0-based',time:'seconds',spin:'not measured'}),
    sourceAuthenticityVerified:false,licensePermissionVerified:false,
    sameSpecimenAerodynamicsVerified:false,approvedForGameplay:false,
    note:'CSV rows are external candidate observations; do not infer angular velocity, ball orientation, source commercial rights or a valid aerodynamic coefficient from fitted trajectory data.'
  });
}
