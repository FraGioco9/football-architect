// Domain logic: no DOM, browser storage or UI dependencies.

export const POSITIONS = ['POR','TD','DC','TS','MED','CC','COC','AD','AS','ATT'];

export const POSITION_LABELS = {POR:'Portiere',TD:'Terzino destro',DC:'Difensore centrale',TS:'Terzino sinistro',MED:'Mediano',CC:'Centrocampista',COC:'Trequartista',AD:'Ala destra',AS:'Ala sinistra',ATT:'Attaccante'};

export const ROLE_GROUPS = {POR:'Portieri',TD:'Difensori',DC:'Difensori',TS:'Difensori',MED:'Centrocampisti',CC:'Centrocampisti',COC:'Centrocampisti',AD:'Attaccanti',AS:'Attaccanti',ATT:'Attaccanti'};

export const FORMATIONS = {
  '4-3-3':[{p:'POR',x:50,y:89},{p:'TD',x:82,y:70},{p:'DC',x:61,y:74},{p:'DC',x:39,y:74},{p:'TS',x:18,y:70},{p:'MED',x:50,y:57},{p:'CC',x:75,y:45},{p:'CC',x:25,y:45},{p:'AD',x:82,y:23},{p:'ATT',x:50,y:17},{p:'AS',x:18,y:23}],
  '4-2-3-1':[{p:'POR',x:50,y:89},{p:'TD',x:82,y:71},{p:'DC',x:61,y:74},{p:'DC',x:39,y:74},{p:'TS',x:18,y:71},{p:'MED',x:62,y:56},{p:'MED',x:38,y:56},{p:'AD',x:82,y:37},{p:'COC',x:50,y:35},{p:'AS',x:18,y:37},{p:'ATT',x:50,y:16}],
  '4-4-2':[{p:'POR',x:50,y:89},{p:'TD',x:82,y:71},{p:'DC',x:61,y:74},{p:'DC',x:39,y:74},{p:'TS',x:18,y:71},{p:'AD',x:83,y:46},{p:'CC',x:61,y:50},{p:'CC',x:39,y:50},{p:'AS',x:17,y:46},{p:'ATT',x:64,y:22},{p:'ATT',x:36,y:22}],
  '3-5-2':[{p:'POR',x:50,y:89},{p:'DC',x:72,y:73},{p:'DC',x:50,y:77},{p:'DC',x:28,y:73},{p:'TD',x:86,y:50},{p:'TS',x:14,y:50},{p:'MED',x:50,y:60},{p:'CC',x:68,y:42},{p:'CC',x:32,y:42},{p:'ATT',x:63,y:19},{p:'ATT',x:37,y:19}],
  '4-1-4-1':[{p:'POR',x:50,y:89},{p:'TD',x:82,y:71},{p:'DC',x:61,y:74},{p:'DC',x:39,y:74},{p:'TS',x:18,y:71},{p:'MED',x:50,y:60},{p:'AD',x:84,y:43},{p:'CC',x:62,y:45},{p:'CC',x:38,y:45},{p:'AS',x:16,y:43},{p:'ATT',x:50,y:18}]
};

export function clamp(n,min,max){return Math.max(min,Math.min(max,n));}

export const toInt = (v)=>Math.round(v);
