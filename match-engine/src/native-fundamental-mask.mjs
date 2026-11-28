// Common action capability vocabulary. Configuration can deny a
// fundamental, never establish a contact, decision or result.
export const NATIVE_FUNDAMENTALS=Object.freeze(['carry','pass','cross','shot','save','tackle','interception','clearance','reception','aerial-control','header','volley']);
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
export function nativeLabFundamentalMask({id=null,collective=false,interceptionStart=false,blockStart=false,keeperSingleShot=false,directedDribble=false}={}){
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
 if(blockStart)return createNativeFundamentalMask(['shot','save']);
 if(id==='pass-pair')return createNativeFundamentalMask(['pass','reception']);
 if(id==='cross-pair')return createNativeFundamentalMask(['cross','reception']);
 if(id==='shot-solo')return createNativeFundamentalMask(['shot']);
 if(id==='carry-solo')return createNativeFundamentalMask(['carry']);
 if(id==='dribble-1v1')return createNativeFundamentalMask(directedDribble?['carry','tackle','interception','clearance']:['carry']);
 if(keeperSingleShot)return createNativeFundamentalMask(['carry','shot','save']);
 return createNativeFundamentalMask();
}

export function nativeAerialSurfaceAllowed(mask,surface){
 if(surface==='head')return nativeFundamentalAllowed(mask,'header');
 if(surface==='chest')return nativeFundamentalAllowed(mask,'aerial-control');
 if(surface==='foot')return nativeFundamentalAllowed(mask,'aerial-control')||nativeFundamentalAllowed(mask,'volley')&&nativeFundamentalAllowed(mask,'shot');
 return false;
}
