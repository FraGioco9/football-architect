/** Football Architect — PLY-REBUILD PLYR-04: canonical 37-attribute vocabulary.
 * Numerical 1..100. Schema v2 intentionally breaks attributeProfile v1 saves.
 */
export const PLAYER_ATTRIBUTE_SCHEMA_VERSION=2;

const technical=[
 ['ballControl','Controllo palla','Ball control'],
 ['passing','Passaggi','Passing'],
 ['dribbling','Dribbling','Dribbling'],
 ['crossing','Cross','Crossing'],
 ['finishing','Finalizzazione','Finishing'],
 ['longShots','Tiri dalla distanza','Long shots'],
 ['heading','Colpi di testa','Heading'],
 ['tackling','Contrasti','Tackling'],
 ['marking','Marcatura','Marking'],
 ['corners',"Calci d'angolo",'Corners'],
 ['freeKicks','Calci di punizione','Free kicks'],
 ['penalties','Rigori','Penalties'],
];
const mental=[
 ['vision','Visione','Vision'],
 ['decisions','Decisioni','Decisions'],
 ['anticipation','Anticipazione','Anticipation'],
 ['offBall','Movimento senza palla','Off the ball'],
 ['defensivePositioning','Posizionamento difensivo','Defensive positioning'],
 ['concentration','Concentrazione','Concentration'],
 ['composure','Freddezza','Composure'],
 ['workRate','Impegno','Work rate'],
 ['teamwork','Gioco di squadra','Teamwork'],
 ['bravery','Coraggio','Bravery'],
];
const physical=[
 ['acceleration','Accelerazione','Acceleration'],
 ['pace','Velocità','Pace'],
 ['agility','Agilità','Agility'],
 ['balance','Equilibrio','Balance'],
 ['strength','Forza','Strength'],
 ['stamina','Resistenza','Stamina'],
 ['jumping','Elevazione','Jumping'],
];
const goalkeeper=[
 ['reflexes','Riflessi','Reflexes'],
 ['handling','Prese','Handling'],
 ['diving','Tuffi','Diving'],
 ['aerialReach','Presa aerea','Aerial reach'],
 ['commandArea',"Comando dell'area",'Command of area'],
 ['rushingOut','Uscite','Rushing out'],
 ['oneOnOne','Uno contro uno','One-on-ones'],
 ['keeperPositioning','Piazzamento','Goalkeeper positioning'],
];

export const ATTRIBUTE_GROUPS=Object.freeze({technical:'technical',mental:'mental',physical:'physical',goalkeeper:'goalkeeper'});
export const ATTRIBUTE_DEFINITIONS=Object.freeze(
 Object.entries({technical,mental,physical,goalkeeper})
  .flatMap(([group,entries])=>entries.map(([key,it,en])=>Object.freeze({key,group,label:Object.freeze({it,en})})))
);
export const ATTRIBUTE_KEYS=Object.freeze(ATTRIBUTE_DEFINITIONS.map(d=>d.key));
export const ATTRIBUTE_BY_KEY=Object.freeze(Object.fromEntries(ATTRIBUTE_DEFINITIONS.map(d=>[d.key,d])));
const err=code=>{throw new Error(`PLY04_${code}`);};
export const clampAttribute=n=>Math.max(1,Math.min(100,Math.round(n)));

export function validateAttributes(record){
 if(!record||typeof record!=='object'||Array.isArray(record))err('INVALID_RECORD');
 if(record.schemaVersion!==PLAYER_ATTRIBUTE_SCHEMA_VERSION)err('UNKNOWN_VERSION');
 const v=record.values;
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==ATTRIBUTE_KEYS.length)err('INCOMPLETE_VALUES');
 if(!ATTRIBUTE_KEYS.every(key=>Number.isInteger(v[key])&&v[key]>=1&&v[key]<=100))err('INVALID_VALUES');
 if(Object.keys(v).some(key=>!ATTRIBUTE_BY_KEY[key]))err('UNKNOWN_ATTRIBUTE');
 return true;
}
export function createAttributes(values,metadata={}){
 if(!values||typeof values!=='object'||Array.isArray(values))err('INVALID_VALUES');
 const record={schemaVersion:PLAYER_ATTRIBUTE_SCHEMA_VERSION,values:{...values},metadata:structuredClone(metadata)};
 validateAttributes(record);return record;
}
export function attributeLabel(key,lang='it'){
 if(!ATTRIBUTE_BY_KEY[key])err('UNKNOWN_ATTRIBUTE');
 return ATTRIBUTE_BY_KEY[key].label[String(lang).toLowerCase()==='en'?'en':'it'];
}
export function attributeGroupCounts(){
 return Object.freeze(Object.fromEntries(Object.keys(ATTRIBUTE_GROUPS).map(group=>[group,ATTRIBUTE_DEFINITIONS.filter(x=>x.group===group).length])));
}
