// Read-only competition overview and participant presentation model.
// Uses only the approved division manifest; no fictional results are generated.
const validId=/^(IT|ENG|ES|DE|FR|PT|NL|BR)-[12]$/;
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
export function competitionSummary(division){
 if(!division||!validId.test(division.id)||!Array.isArray(division.clubs)||
    division.clubs.length!==16||new Set(division.clubs.map(club=>club.clubId)).size!==16)
  throw Error("Invalid division participants");
 const clubs=division.clubs.map(club=>{
  if(!Number.isInteger(club.clubId)||club.clubId<1||club.clubId>40||
     typeof club.primaryName!=="string"||!club.primaryName.trim()||
     typeof club.stadiumName!=="string")throw Error("Invalid club identity");
  return Object.freeze({id:club.clubId,name:club.primaryName,stadium:club.stadiumName,
   href:"/clubs/"+division.countryId.toLowerCase()+"/"+String(club.clubId).padStart(2,"0")+"/overview"});
 });
 return Object.freeze({name:division.name,tier:division.tier,country:division.countryName,
  participants:16,matchdays:30,matches:240,clubs:Object.freeze(clubs)});
}
export function renderCompetitionOverview(division){
 const summary=competitionSummary(division);
 return '<div class="app-competition-summary"><h2>Overview</h2><dl>'+
  '<div><dt>Competition</dt><dd>'+escapeHtml(summary.name)+'</dd></div>'+
  '<div><dt>Country</dt><dd>'+escapeHtml(summary.country)+'</dd></div>'+
  '<div><dt>Division</dt><dd>'+escapeHtml(summary.tier)+'</dd></div>'+
  '<div><dt>Clubs</dt><dd>16</dd></div><div><dt>Matchdays</dt><dd>30</dd></div>'+
  '<div><dt>League matches</dt><dd>240</dd></div></dl></div>';
}
export function renderCompetitionTeams(division){
 const summary=competitionSummary(division);
 return '<div class="app-competition-participants"><h2>Teams</h2><ul>'+
  summary.clubs.map(club=>'<li><a href="'+club.href+'">'+escapeHtml(club.name)+
   '</a><span>'+escapeHtml(club.stadium)+'</span></li>').join("")+'</ul></div>';
}
