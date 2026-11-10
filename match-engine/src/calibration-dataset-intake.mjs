// ME-PHYS-13 — scientifically cautious, offline-only data intake.
// Format checks NEVER authenticate a source, grant a commercial license,
// validate a universal match ball, or enable any force in official gameplay.
// No raw third-party datasets are bundled or fetched by this module.
export const CALIBRATION_DATASET_CANDIDATES=Object.freeze([
  Object.freeze({
    id:'trionda-2026',label:'Trionda 2026 fixed-orientation wind-tunnel study',
    source:'https://www.mdpi.com/2311-5521/11/5/128',
    evidence:'non-spinning Cd / Cl / Cs by fixed orientation',
    specimen:'Trionda single tested specimen',
    access:'Article tables and figures; no authenticated downloadable raw speed × spin matrix',
    use:'Research reference only; raw-file provenance and licensing review required',
    calibrationRole:'partial',holdoutRole:'none'
  }),
  Object.freeze({
    id:'ball3d-2026',label:'Soccer Ball 3D (CVPR Workshops 2026)',
    source:'https://github.com/lukaszgrad/ball3d/blob/main/DATA.md',
    evidence:'Triangulated match ball 3D coordinates, velocities and segment IDs',
    specimen:'Unknown physical specimen / spin and aerodynamic map not supplied',
    access:'Google Drive link in project DATA.md; data not imported into Football Architect',
    use:'CC BY-NC-SA 4.0 and non-commercial academic research; separate permission review required for game use',
    calibrationRole:'none',holdoutRole:'candidate-only'
  }),
  Object.freeze({
    id:'ward2023-geometry',label:'Ward et al. 2023 — same-specimen drag/spin',
    source:'https://doi.org/10.1007/s12283-023-00409-5',
    evidence:'Same-test-specimen non-spinning Cd and spinning side-force Cy in wind tunnel, 100–400 rpm',
    specimen:'3D-printed experimental football specimens; Brazuca and Telstar18 comparisons; not selected universal match ball',
    access:'Open-access CC BY 4.0 article, no verified downloadable raw speed × spin matrix or independent observed 3D flight holdout',
    use:'CC BY 4.0 covers the article with attribution; verify separately raw measurements, specimen records and downstream game-model reuse rights',
    calibrationRole:'partial',holdoutRole:'none'
  }),
  Object.freeze({
    id:'curve-kick-2020',label:'2020 spinning curve-kick flight study',
    source:'https://www.mdpi.com/2504-3900/49/1/88',
    evidence:'Published time-averaged Cs / spin parameter and plotted flight observations',
    specimen:'Different/uncorroborated specimen relative to Trionda and Euro 2024',
    access:'Publication aggregate values; no verified matched raw coefficient / trajectory bundle',
    use:'Scientific citation only until raw-source and rights review',
    calibrationRole:'insufficient',holdoutRole:'none'
  })
]);
export const CALIBRATION_INTAKE_FIELDS=Object.freeze({
  identity:Object.freeze(['datasetId','specimenId','sourceUrl','sourceGroup','measurementKind','usageRights']),
  coefficient:Object.freeze(['sampleId','speedMps','spinRadS','coefficient','uncertainty','spinAxis']),
  trajectory:Object.freeze(['sampleId','timeS','xM','yM','zM'])
});
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const finite=(x)=>typeof x==='number'&&Number.isFinite(x);
const nonempty=s=>typeof s==='string'&&s.trim().length>0&&s.length<=512;
const safeUrl=s=>{
  if(!nonempty(s))return false;
  try{return new URL(s).protocol==='https:';}catch{return false;}
};
const fail=(code,reason)=>Object.freeze({code,reason});
const record=(id,kind,accepted,issues)=>Object.freeze({
  id,kind,formatValid:accepted,issues:Object.freeze(issues)
});
const axes=new Set(['x','y','z']);

// A parsed input bundle can be *syntactically* valid without being authentic.
// In particular, handwritten source IDs, rights strings or measured flags are
// user-supplied assertions and do not establish observation provenance.
export function inspectCalibrationDataset(bundle){
  if(!bundle||typeof bundle!=='object'||Array.isArray(bundle))
    return record(null,null,false,[fail('MANIFEST','Expected a dataset object')]);
  const {datasetId,specimenId,sourceUrl,sourceGroup,measurementKind,usageRights,rows}=bundle;
  const problems=[];
  for(const key of ['datasetId','specimenId','sourceGroup','usageRights'])
    if(!nonempty(bundle[key]))problems.push(fail('IDENTITY',key+' missing/invalid'));
  if(!safeUrl(sourceUrl))problems.push(fail('SOURCE','HTTPS source URL required'));
  if(!['drag','spin','trajectory'].includes(measurementKind))
    problems.push(fail('KIND','Expected drag, spin or trajectory'));
  if(!Array.isArray(rows)||!rows.length||rows.length>100000){
    problems.push(fail('ROWS','Non-empty bounded rows required'));
    return record(datasetId??null,measurementKind??null,false,problems);
  }
  const seen=new Set(),firstFrame=new Map();
  for(let index=0;index<rows.length;index++){
    const point=rows[index];
    if(!point||typeof point!=='object'||Array.isArray(point)){
      problems.push(fail('ROW','Invalid row '+index));continue;
    }
    if(!nonempty(point.sampleId)||seen.has(point.sampleId))
      problems.push(fail('SAMPLE_ID','Missing/duplicate sample ID at row '+index));
    else seen.add(point.sampleId);
    if(measurementKind==='drag'||measurementKind==='spin'){
      if(!finite(point.speedMps)||point.speedMps<=0||point.speedMps>100||
         !finite(point.spinRadS)||point.spinRadS<0||point.spinRadS>200||
         !finite(point.coefficient)||point.coefficient< -1||point.coefficient>2||
         !finite(point.uncertainty)||point.uncertainty<=0||point.uncertainty>1||
         !axes.has(point.spinAxis))
        problems.push(fail('COEFFICIENT','Invalid speed/spin/coefficient/uncertainty/axis at '+index));
      if(measurementKind==='drag'&&point.coefficient<0)
        problems.push(fail('DRAG_SIGN','Negative Cd at row '+index));
    }else if(measurementKind==='trajectory'){
      if(!nonempty(point.trackId)||!finite(point.timeS)||point.timeS<0||
         ![point.xM,point.yM,point.zM].every(finite)||
         point.zM< -1||point.zM>100)
        problems.push(fail('TRAJECTORY','Invalid 3D frame at '+index));
      if(nonempty(point.trackId)&&finite(point.timeS)){
        const old=firstFrame.get(point.trackId);
        if(old!==undefined&&point.timeS<=old)
          problems.push(fail('TIME','Frames must increase strictly per track '+point.trackId));
        firstFrame.set(point.trackId,point.timeS);
      }
    }
    if(problems.length>=30)break;
  }
  if(measurementKind==='trajectory'){
    const groups=new Map();
    for(const row of rows)if(row&&nonempty(row.trackId))
      groups.set(row.trackId,(groups.get(row.trackId)||0)+1);
    if([...groups.values()].some(count=>count<2))
      problems.push(fail('SHORT_TRACK','Each 3D track requires >=2 timestamped points'));
  }
  return record(datasetId??null,measurementKind??null,problems.length===0,problems);
}

// This is a **schema** check only. Even a fully well-formed user-supplied
// triple may be forged, from another specimen, rights-restricted or overlapping.
// Scientific review AND independent source/permission verification are external
// requirements, not a boolean that arbitrary JSON can grant itself.
export function inspectCalibrationBundle({drag,spin,holdout}={}){
  const parts=[drag,spin,holdout].map(inspectCalibrationDataset);
  const issues=parts.flatMap((p,i)=>p.issues.map(q=>fail(q.code,
    ['drag','spin','holdout'][i]+': '+q.reason)));
  if(drag?.measurementKind!=='drag'||spin?.measurementKind!=='spin'||
    holdout?.measurementKind!=='trajectory')
    issues.push(fail('ROLE','Required drag, spin and 3D holdout data roles'));
  if(!nonempty(drag?.specimenId)||drag?.specimenId!==spin?.specimenId||
     spin?.specimenId!==holdout?.specimenId)
    issues.push(fail('SPECIMEN','All three groups must claim the same specimen identity; claim must still be independently authenticated'));
  if(!nonempty(drag?.sourceGroup)||drag?.sourceGroup===holdout?.sourceGroup||
     spin?.sourceGroup===holdout?.sourceGroup)
    issues.push(fail('LEAKAGE','Independent holdout must have a different original acquisition group'));
  const structuralCandidate=parts.every(p=>p.formatValid)&&issues.length===0;
  return Object.freeze({
    stage:structuralCandidate?'STRUCTURAL CANDIDATE — EXTERNAL REVIEW REQUIRED':'DATA INTAKE HOLD',
    structuralCandidate,scientificVerificationComplete:false,
    approvedForGameplay:false,licensePermissionVerified:false,
    parts:Object.freeze(parts),issues:Object.freeze(issues),
    note:'Passing the schema does not verify specimen provenance, actual measured signals, licensing, independence, uncertainty calibration or held-out predictive error.'
  });
}

export function describeCalibrationIntake(){
  return Object.freeze({
    stage:'ME-PHYS-13 — NO VERIFIED MATCHED DATASET',
    sources:CALIBRATION_DATASET_CANDIDATES,
    requiredFields:CALIBRATION_INTAKE_FIELDS,
    sourceCount:CALIBRATION_DATASET_CANDIDATES.length,
    verifiedMatchedBundles:0,
    eligibleForGameplay:false,
    rightsBlocker:'Soccer Ball 3D data are non-commercial academic / CC BY-NC-SA-4.0; do not redistribute or import into commercial game assets without permission review.',
    scope:'No third-party raw files downloaded, committed or redistributed. No aerodynamic coefficients changed. One universal football and grass model remain.'
  });
}
