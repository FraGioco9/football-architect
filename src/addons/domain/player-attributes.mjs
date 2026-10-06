/** Football Architect PLY01.01 — versioned, pure, 40-attribute vocabulary.
 * Numerical 1..100, no save-format changes or implicit migration.
 */
export const PLAYER_ATTRIBUTE_SCHEMA_VERSION = 1;
const technical = [
 ['ballControl','Controllo palla','Ball control'],
 ['firstTouch','Primo tocco','First touch'],
 ['shortPassing','Passaggi corti','Short passing'],
 ['longPassing','Passaggi lunghi','Long passing'],
 ['dribbling','Dribbling','Dribbling'],
 ['crossing','Cross','Crossing'],
 ['finishing','Finalizzazione','Finishing'],
 ['longShots','Tiri dalla distanza','Long shots'],
 ['heading','Colpi di testa','Heading'],
 ['tackling','Contrasti','Tackling'],
 ['marking','Marcatura','Marking'],
 ['technique','Tecnica','Technique'],
 ['setPieces','Calci piazzati','Set pieces'],
 ['penalties','Rigori','Penalties'],
];
const mental = [
 ['vision','Visione di gioco','Vision'],
 ['decisions','Decisioni','Decisions'],
 ['offBall','Movimento senza palla','Off the ball'],
 ['defensivePositioning','Posizionamento difensivo','Defensive positioning'],
 ['anticipation','Anticipazione','Anticipation'],
 ['concentration','Concentrazione','Concentration'],
 ['composure','Freddezza','Composure'],
 ['aggression','Aggressività','Aggression'],
 ['workRate','Impegno','Work rate'],
 ['teamwork','Gioco di squadra','Teamwork'],
 ['leadership','Leadership','Leadership'],
];
const physical = [
 ['acceleration','Accelerazione','Acceleration'],
 ['pace','Velocità','Pace'],
 ['agility','Agilità','Agility'],
 ['balance','Equilibrio','Balance'],
 ['strength','Forza','Strength'],
 ['stamina','Resistenza','Stamina'],
 ['jumping','Elevazione','Jumping'],
 ['recovery','Recupero fisico','Physical recovery'],
];
const goalkeeper = [
 ['reflexes','Riflessi','Reflexes'],
 ['handling','Prese','Handling'],
 ['diving','Tuffi','Diving'],
 ['rushingOut','Uscite','Rushing out'],
 ['oneOnOne','Uno contro uno','One-on-ones'],
 ['keeperPositioning','Piazzamento','Goalkeeper positioning'],
 ['distribution','Gioco con i piedi','Distribution'],
];
export const ATTRIBUTE_GROUPS = Object.freeze({technical:'technical',mental:'mental',physical:'physical',goalkeeper:'goalkeeper'});
export const ATTRIBUTE_DEFINITIONS = Object.freeze(
 Object.entries({technical,mental,physical,goalkeeper}).flatMap(([group,entries])=>entries.map(([key,it,en])=>Object.freeze({key,group,label:Object.freeze({it,en})})))
);
export const ATTRIBUTE_KEYS = Object.freeze(ATTRIBUTE_DEFINITIONS.map(d=>d.key));
export const ATTRIBUTE_BY_KEY = Object.freeze(Object.fromEntries(ATTRIBUTE_DEFINITIONS.map(d=>[d.key,d])));
const err = code=>{throw new Error(`PLY01_${code}`)};
export const clampAttribute = n => Math.max(1,Math.min(100,Math.round(n)));
export function validateAttributes(record) {
 if (!record || typeof record!=='object' || Array.isArray(record)) err('INVALID_RECORD');
 if(record.schemaVersion!==PLAYER_ATTRIBUTE_SCHEMA_VERSION) err('UNKNOWN_VERSION');
 const v=record.values;
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==40) err('INCOMPLETE_VALUES');
 if(!ATTRIBUTE_KEYS.every(key=>Number.isInteger(v[key])&&v[key]>=1&&v[key]<=100)) err('INVALID_VALUES');
 if(Object.keys(v).some(key=>!ATTRIBUTE_BY_KEY[key])) err('UNKNOWN_ATTRIBUTE');
 return true;
}
export function createAttributes(values,metadata={}) {
 if (!values||typeof values!=='object'||Array.isArray(values)) err('INVALID_VALUES');
 const record={schemaVersion:PLAYER_ATTRIBUTE_SCHEMA_VERSION,values:{...values},metadata:structuredClone(metadata)};
 validateAttributes(record);
 return record;
}
export function attributeLabel(key,lang='it') { if(!ATTRIBUTE_BY_KEY[key]) err('UNKNOWN_ATTRIBUTE');return ATTRIBUTE_BY_KEY[key].label[String(lang).toLowerCase()==='en'?'en':'it'];}
export function attributeGroupCounts(){return Object.freeze(Object.fromEntries(Object.keys(ATTRIBUTE_GROUPS).map(group=>[group,ATTRIBUTE_DEFINITIONS.filter(x=>x.group===group).length])));}
