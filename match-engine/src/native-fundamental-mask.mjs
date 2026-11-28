// Common action capability vocabulary. Configuration can deny a
// fundamental, never establish a contact, decision or result.
export const NATIVE_FUNDAMENTALS=Object.freeze(['carry','pass','cross','shot','save','tackle','interception','clearance','reception','aerial-control','header','volley','standing-tackle','sliding-tackle','shoulder-challenge','block','header-shot','header-pass','header-clearance']);
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
 if(id==='header-pair')return createNativeFundamentalMask(['cross','header','header-shot','header-pass','header-clearance']);
 if(id==='chest-control')return createNativeFundamentalMask(['cross','aerial-control']);
 if(id==='aerial-foot-control')return createNativeFundamentalMask(['aerial-control']);
 if(id==='aerial-duel')return createNativeFundamentalMask(['header','header-shot','header-pass','header-clearance']);
 if(id==='volley-solo')return createNativeFundamentalMask(['cross','volley']);
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
 if(surface==='foot')return nativeFundamentalAllowed(mask,'aerial-control')||nativeFundamentalAllowed(mask,'volley');
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

// An emitted aerial redirect uses shot/pass/clearance as its result kind,
// not the ground capability of that name. Permission does not prove contact.
export function nativeObservedActionAllowed(mask,action){
 if(!action)return false;
 if(action.nativeExclusiveHeadStart===true){
  return action.nativeExclusiveAerialControlStart!==true&&action.nativeVolley!==true&&
   ['shot','pass','clearance'].includes(action.action)&&nativeFundamentalAllowed(mask,'header')&&nativeFundamentalAllowed(mask,'header-'+action.action);
 }
 if(action.nativeVolley===true)return action.nativeExclusiveAerialControlStart===true&&action.action==='shot'&&action.surface==='foot'&&nativeFundamentalAllowed(mask,'volley');
 if(action.nativeExclusiveAerialControlStart===true)return action.action==='aerial-control'&&['chest','foot'].includes(action.surface)&&nativeFundamentalAllowed(mask,'aerial-control');
 if(action.action==='aerial-control'||action.action==='volley'||action.action==='header'||typeof action.action==='string'&&action.action.startsWith('header-'))return false;
 return nativePhysicalActionAllowed(mask,action);
}

// Generic bounded delivery exercise configuration; only the boundary
// translates a scenario into actor, recipient, profile and surface.
export function nativeLabAerialSequence({id,side}={}){
 const surfaces={'header-pair':'head','chest-control':'chest','volley-solo':'foot','lofted-pass':'foot','lofted-short':'foot','lofted-switch':'foot','keeper-high-cross':'glove','keeper-high-intercept':'glove'};
 if(!Object.hasOwn(surfaces,id))return null;
 if(!['home','away'].includes(side))throw new TypeError('Known delivery team required');
 const profiles={'lofted-pass':'long','lofted-short':'short','lofted-switch':'switch'};
 return Object.freeze({actorId:side+'-10',recipientId:side+'-9',team:side,kind:profiles[id]?'pass':'cross',profile:profiles[id]??null,surface:surfaces[id],...(surfaces[id]==='glove'?{keeperId:(side==='home'?'away':'home')+'-1'}:{})});
}
export function nativeSequenceDeliveryAllowed(sequence,choice){
 if(sequence===null)return true;
 if(!choice||choice.playerId!==sequence.actorId||choice.team!==sequence.team||choice.action!==sequence.kind)return false;
 const target=choice.action==='cross'?choice.crossTarget:choice.passTarget;
 return target?.recipientId===sequence.recipientId&&(sequence.profile===null||target.deliveryProfile==='lofted'&&target.loftedProfile===sequence.profile);
}
export function nativeSequenceAerialAllowed(sequence,delivery,contact,tick){
 if(sequence===null)return true;
 return !!delivery&&delivery.actualPhysicsImpulseApplied===true&&delivery.kind===sequence.kind&&delivery.actorId===sequence.actorId&&
  delivery.recipientId===sequence.recipientId&&delivery.team===sequence.team&&
  (sequence.profile===null||delivery.profile===sequence.profile)&&
  Number.isSafeInteger(tick)&&Number.isSafeInteger(delivery.tick)&&tick>delivery.tick&&tick-delivery.tick<=180&&
  delivery.airborne===true&&contact?.actorId===sequence.recipientId&&contact.team===sequence.team&&
  contact.surface===sequence.surface&&contact.contactStarted===true&&contact.actualNativeSolverContact===true&&
  contact.sameOriginalRapierWorld===true&&contact.incomingVelocity?.z<0;
}
export function nativeSequenceGroundMask(mask,sequence,actorId,deliveryApplied){
 if(sequence===null)return mask;
 return !deliveryApplied&&actorId===sequence.actorId?createNativeFundamentalMask(mask.filter(k=>k===sequence.kind)):createNativeFundamentalMask([]);
}

// A keeper exercise consumes a witnessed delivery, not the LAB's identity.
export function nativeKeeperSequenceDeliveryAllowed(sequence,action,tick){
 return sequence?.surface==='glove'&&Number.isSafeInteger(tick)&&tick>=2&&action?.tick===tick-1&&
  action.appliedByRapier===true&&action.actualPhysicsImpulseApplied===true&&nativeSequenceDeliveryAllowed(sequence,action);
}
export function nativeKeeperSequenceClaimAllowed(sequence,keeperId,delivery,tick,{conflict=false}={}){
 if(sequence===null)return true;
 return sequence.surface==='glove'&&keeperId===sequence.keeperId&&!!delivery&&delivery.airborne===true&&
  Number.isSafeInteger(tick)&&Number.isSafeInteger(delivery.tick)&&tick>delivery.tick&&tick-delivery.tick<=180&&conflict===false;
}
export function nativeKeeperSequenceInterrupted(sequence,shoeStarts,shoeActive,bodyActive){
 if(sequence===null)return false;
 // A still-active launch shoe is not another START. Any later START
 // or another actor's active shoe/body contact interrupts the delivery.
 return shoeStarts.length>0||shoeActive.some(id=>id!==sequence.actorId)||bodyActive.length>0;
}

// One capability-to-surface mapping used for physical allocation and movement.
export const NATIVE_AERIAL_APPROACH_HEIGHTS=Object.freeze({head:1.95,chest:1.35,foot:0.85});
export function nativePermittedAerialSurfaces(mask,restriction='all',enabled=true){
 if(!['all','head','chest','foot'].includes(restriction)||typeof enabled!=='boolean')throw new TypeError('Known aerial surface configuration required');
 return Object.freeze(Object.keys(NATIVE_AERIAL_APPROACH_HEIGHTS).filter(surface=>enabled&&(restriction==='all'||surface===restriction)&&nativeAerialSurfaceAllowed(mask,surface)));
}

 // A cross profile expresses its intended receiving height; it does not
 // change the physics or guarantee the receiver's subsequent contact.
export const NATIVE_CROSS_PROFILES=Object.freeze(['landing','head','chest','foot']);
export function selectNativeCrossProfile(mask,requiredSurface=null){
 if(requiredSurface==='glove')return 'head';
 if(requiredSurface!==null){
  if(!NATIVE_CROSS_PROFILES.includes(requiredSurface)||requiredSurface!=='landing'&&!nativeAerialSurfaceAllowed(mask,requiredSurface))return null;
  return requiredSurface;
 }
 return nativePermittedAerialSurfaces(mask)[0]??'landing';
}
export function nativeCrossTargetHeight(profile,originZ){
 if(!NATIVE_CROSS_PROFILES.includes(profile)||!Number.isFinite(originZ))throw new TypeError('Known cross profile and finite origin required');
 return profile==='landing'?originZ:NATIVE_AERIAL_APPROACH_HEIGHTS[profile];
}

// A pending delivery can survive the launch shoe's continued contact,
// never a new intervening contact or an unbounded time window.
export function nativePendingDeliveryValid(delivery,tick,{shoeStarts=[],shoeActive=[],conflict=false}={}){
 if(!delivery||!Number.isSafeInteger(tick)||!Number.isSafeInteger(delivery.tick)||
    tick<=delivery.tick||tick-delivery.tick>180||conflict)return false;
 // A new shoe START consumes the delivery in the receiving branch below.
 // Without a START, only the original launch actor may remain in contact.
 return shoeStarts.length>0||shoeActive.every(id=>id===delivery.actorId);
}
