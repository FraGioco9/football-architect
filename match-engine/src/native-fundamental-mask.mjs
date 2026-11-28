// Common action capability vocabulary. Configuration can deny a
// fundamental, never establish a contact, decision or result.
export const NATIVE_FUNDAMENTALS=Object.freeze(['carry','pass','cross','shot','save','tackle','interception','clearance','reception','aerial-control','header','volley','standing-tackle','sliding-tackle','shoulder-challenge','block']);
export function createNativeFundamentalMask(actions=null){
 if(actions===null)return NATIVE_FUNDAMENTALS;
 if(!Array.isArray(actions)||new Set(actions).size!==actions.length||actions.some(a=>!NATIVE_FUNDAMENTALS.includes(a)))throw new TypeError('Unique known native fundamentals required');
 return Object.freeze(NATIVE_FUNDAMENTALS.filter(a=>actions.includes(a)));
}
export function nativeFundamentalAllowed(mask,action){
 return NATIVE_FUNDAMENTALS.includes(action)&&Array.isArray(mask)&&mask.includes(action);
}
// Translate exercise setup into capabilities at the configuration boundary.
// Open play and remaining unconstrained legacy exercises retain the full
// vocabulary. Per-actor, count, trajectory and contact gates still apply.
export function nativeLabFundamentalMask({id=null,collective=false,interceptionStart=false,blockStart=false,keeperSingleShot=false,directedDribble=false,duelTackleProfile='mixed'}={}){
 // Aerial exercises share collective decision/movement, not unrestricted
 // actions. Delivery and receiving/redirect permissions are separate.
 if(id==='header-pair')return createNativeFundamentalMask(['cross','header','shot','pass','clearance']);
 if(id==='chest-control')return createNativeFundamentalMask(['cross','aerial-control']);
 if(id==='aerial-foot-control')return createNativeFundamentalMask(['aerial-control']);
 if(id==='aerial-duel')return createNativeFundamentalMask(['header','shot','pass','clearance']);
 if(id==='volley-solo')return createNativeFundamentalMask(['cross','volley','shot']);
 if(['lofted-pass','lofted-short','lofted-switch'].includes(id))return createNativeFundamentalMask(['pass','reception','aerial-control']);
 if(['keeper-high-cross','keeper-high-intercept'].includes(id))return createNativeFundamentalMask(['cross','save','pass','clearance']);
 if(collective)return createNativeFundamentalMask();
 if(interceptionStart)return createNativeFundamentalMask(['pass','interception','carry','reception']);
 if(blockStart)return createNativeFundamentalMask(['shot','save','block']);
 if(id==='pass-pair')return createNativeFundamentalMask(['pass','reception']);
 if(id==='cross-pair')return createNativeFundamentalMask(['cross','reception']);
 if(id==='shot-solo')return createNativeFundamentalMask(['shot']);
 if(id==='carry-solo')return createNativeFundamentalMask(['carry']);
 if(id==='dribble-1v1'){
  if(!directedDribble)return createNativeFundamentalMask(['carry']);
  return createNativeDuelFundamentalMask(duelTackleProfile);
 }
 if(keeperSingleShot)return createNativeFundamentalMask(['carry','shot','save']);
 return createNativeFundamentalMask();
}

export function nativeAerialSurfaceAllowed(mask,surface){
 if(surface==='head')return nativeFundamentalAllowed(mask,'header');
 if(surface==='chest')return nativeFundamentalAllowed(mask,'aerial-control');
 if(surface==='foot')return nativeFundamentalAllowed(mask,'aerial-control')||nativeFundamentalAllowed(mask,'volley')&&nativeFundamentalAllowed(mask,'shot');
 return false;
}

export function createNativeDuelFundamentalMask(profile='mixed'){
 const types={mixed:['standing-tackle','sliding-tackle','shoulder-challenge','interception'],standing:['standing-tackle'],sliding:['sliding-tackle'],shoulder:['shoulder-challenge'],interception:['interception']};
 if(!Object.hasOwn(types,profile))throw new TypeError('Known defensive profile required');
 const kinds=types[profile];
 return createNativeFundamentalMask(['carry','clearance',...(kinds.some(k=>k.endsWith('-tackle'))?['tackle']:[]),...kinds]);
}
export function nativeDefensiveInterventionAllowed(mask,kind){
 if(kind==='standing-tackle'||kind==='sliding-tackle')return nativeFundamentalAllowed(mask,'tackle')&&nativeFundamentalAllowed(mask,kind);
 return ['shoulder-challenge','interception','block'].includes(kind)&&nativeFundamentalAllowed(mask,kind);
}
export function nativePhysicalActionAllowed(mask,choice){
 if(!choice||!nativeFundamentalAllowed(mask,choice.action))return false;
 if(choice.action==='tackle')return nativeDefensiveInterventionAllowed(mask,choice.defensiveTarget?.intervention??'standing-tackle');
 return true;
}
