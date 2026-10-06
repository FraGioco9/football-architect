/** SIM02.01-02: versioned, pure collective team tactics.
 * Independent of v1.4 save format: adapt explicitly; never mutate legacy settings.
 */
export const TACTICS_SCHEMA_VERSION = 1;
export const PHASES = Object.freeze(['inPossession','outOfPossession','transition']);
export const TACTIC_FIELDS = Object.freeze({
  inPossession: Object.freeze(['mentality','width','passingDirectness','tempo']),
  outOfPossession: Object.freeze(['defensiveLine','pressing','intensity']),
  transition: Object.freeze(['transitionSpeed','counterPress','counterAttack']),
});
export const DEFAULT_TACTICS = Object.freeze({
  schemaVersion:TACTICS_SCHEMA_VERSION,
  inPossession:Object.freeze({mentality:50,width:50,passingDirectness:50,tempo:50}),
  outOfPossession:Object.freeze({defensiveLine:50,pressing:50,intensity:50}),
  transition:Object.freeze({transitionSpeed:50,counterPress:false,counterAttack:true}),
});
export const STYLE_NAMES = Object.freeze(['balanced','possession','highPress','lowBlock','direct','counter']);
const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
const clone=v=>structuredClone(v);
const requireT=(ok,name)=>{if(!ok) throw new Error(`TACTICS_${name}`);};
const object=v=>v!==null && typeof v==='object' && !Array.isArray(v);
const scalar=v=>Number.isInteger(v)&&v>=0&&v<=100;
export function validateTactics(tactics){
  requireT(object(tactics),'INVALID');
  requireT(tactics.schemaVersion===1,'VERSION');
  requireT(Object.keys(tactics).length===4 && ['schemaVersion',...PHASES].every(k=>own(tactics,k)),'UNKNOWN_FIELD');
  for(const phase of PHASES){
    const value=tactics[phase],fields=TACTIC_FIELDS[phase];
    requireT(object(value)&&Object.keys(value).length===fields.length && fields.every(k=>own(value,k)),`PHASE_${phase}`);
    for(const field of fields){
      const item=value[field];
      requireT(typeof DEFAULT_TACTICS[phase][field]==='boolean'?typeof item==='boolean':scalar(item),`FIELD_${field}`);
    }
  }
  return true;
}
export function createTactics(overrides={}){
  requireT(object(overrides) && Object.keys(overrides).every(k=>PHASES.includes(k)),'OVERRIDES');
  const result=clone(DEFAULT_TACTICS);
  for(const phase of PHASES){
    if(!own(overrides,phase))continue;
    requireT(object(overrides[phase]) && Object.keys(overrides[phase]).every(k=>TACTIC_FIELDS[phase].includes(k)),`OVERRIDE_${phase}`);
    Object.assign(result[phase],overrides[phase]);
  }
  validateTactics(result);
  return result;
}
export function replaceTacticalPhase(tactics,phase,patch){
  validateTactics(tactics);
  requireT(PHASES.includes(phase),'PHASE');
  return createTactics(Object.fromEntries(PHASES.map(p=>[p,p===phase?{...tactics[p],...patch}:tactics[p]])));
}
export const BUILT_IN_STYLES = Object.freeze({
  balanced:DEFAULT_TACTICS,
  possession:createTactics({inPossession:{mentality:53,width:64,passingDirectness:25,tempo:40},outOfPossession:{defensiveLine:59,pressing:52,intensity:45},transition:{transitionSpeed:35,counterPress:true,counterAttack:false}}),
  highPress:createTactics({inPossession:{mentality:62,width:65,passingDirectness:42,tempo:65},outOfPossession:{defensiveLine:78,pressing:86,intensity:83},transition:{transitionSpeed:73,counterPress:true,counterAttack:true}}),
  lowBlock:createTactics({inPossession:{mentality:37,width:46,passingDirectness:63,tempo:45},outOfPossession:{defensiveLine:21,pressing:18,intensity:31},transition:{transitionSpeed:62,counterPress:false,counterAttack:true}}),
  direct:createTactics({inPossession:{mentality:67,width:62,passingDirectness:87,tempo:75},outOfPossession:{defensiveLine:45,pressing:43,intensity:57},transition:{transitionSpeed:84,counterPress:false,counterAttack:true}}),
  counter:createTactics({inPossession:{mentality:43,width:50,passingDirectness:72,tempo:62},outOfPossession:{defensiveLine:31,pressing:37,intensity:46},transition:{transitionSpeed:90,counterPress:false,counterAttack:true}}),
});
/** Narrow backward-compatible adapter; avoids writing to original world. */
export function tacticsFromLegacy(legacy={}){
  requireT(object(legacy),'LEGACY');
  const normalized=v=>String(v??'').trim().toLowerCase();
  const map={mentalita:{defensive:30,defend:30,balanced:50,normal:50,attacking:70,attack:70},
    pressing:{low:22,normal:50,medium:50,high:78},tempo:{slow:27,normal:50,medium:50,fast:75}};
  const rawMental=legacy.mentality??legacy.mentalita;
  const rawPress=legacy.pressing;
  const rawTempo=legacy.tempo??legacy.pace;
  const convert=(v,table)=>Number.isInteger(v)&&v>=0&&v<=100?v:(table[normalized(v)]??50);
  return createTactics({inPossession:{mentality:convert(rawMental,map.mentalita),tempo:convert(rawTempo,map.tempo)},outOfPossession:{pressing:convert(rawPress,map.pressing)}});
}
/** Display-only expectations: not a claim of empirically calibrated match rates. */
export function describeTacticalEffects(tactics){
  validateTactics(tactics);
  const a=tactics.inPossession,d=tactics.outOfPossession,x=tactics.transition;
  const shift=v=>(v-50)/50;
  const effects={
    territory:Number((shift(d.defensiveLine)*0.25+shift(d.pressing)*0.18+shift(a.mentality)*0.14).toFixed(3)),
    shotVolume:Number((shift(a.mentality)*0.27+shift(a.tempo)*0.19+shift(x.transitionSpeed)*0.09).toFixed(3)),
    chanceQuality:Number((-Math.abs(a.passingDirectness-35)/100*0.12+shift(a.width)*0.10+shift(x.transitionSpeed)*0.04).toFixed(3)),
    counterExposure:Number((shift(d.defensiveLine)*0.27+shift(d.pressing)*0.08+shift(a.mentality)*0.12-(x.counterPress?0.08:0)).toFixed(3)),
    energyCost:Number((shift(d.intensity)*0.26+shift(d.pressing)*0.28+shift(a.tempo)*0.10+(x.counterPress?0.10:0)).toFixed(3)),
  };
  return effects;
}
export function tacticalConflicts(tactics){
  validateTactics(tactics);
  const a=tactics.inPossession,d=tactics.outOfPossession,x=tactics.transition;
  const flags=[];
  if(d.defensiveLine>=75&&d.pressing<=30)flags.push('highLineLowPress');
  if(d.pressing>=80&&d.intensity>=80)flags.push('fatigueRisk');
  if(a.passingDirectness>=80&&a.tempo<=25)flags.push('directButSlow');
  if(x.counterPress&&d.intensity<=20)flags.push('counterPressLowIntensity');
  if(x.counterAttack&&x.transitionSpeed<=20)flags.push('counterSlow');
  if(a.mentality>=80&&d.defensiveLine>=80)flags.push('transitionExposure');
  return flags;
}
