/* #502: Club-style player profile Overview, with reserved first-paint geometry. */
const groupFields={"technical":["passing","technique","dribbling","shooting","crossing","tackling","marking","heading"],"mental":["vision","positioning","decisions","composure"],"physical":["speed","strength","stamina","agility"],"goalkeeping":["gk_reflexes","gk_handling","gk_positioning","gk_aerial"]};
const infoFields=["nationality","secondary_nationality","age","height_cm","preferred_foot"];
const titleMap={"technical":"Technical","mental":"Mental","physical":"Physical","goalkeeping":"Goalkeeper"};
const attrNames={"passing":"Passing","technique":"Technique","dribbling":"Dribbling","shooting":"Shooting","crossing":"Crossing","tackling":"Tackling","marking":"Marking","heading":"Heading","vision":"Vision","positioning":"Positioning","decisions":"Decisions","composure":"Composure","speed":"Speed","strength":"Strength","stamina":"Stamina","agility":"Agility","gk_reflexes":"Reflexes","gk_handling":"Handling","gk_positioning":"Positioning","gk_aerial":"Aerial"};
const infoNames={"nationality":"Nationality","secondary_nationality":"Second nationality","age":"Age","height_cm":"Height","preferred_foot":"Preferred foot"};
function detailPanel(preview){
 const skeleton=()=>'<span class="app-skeleton-bar" aria-hidden="true"></span>';
 const infoRows=infoFields.map(key=>'<div class="app-player-detail-info-line"><dt data-detail-label="'+key+'">'+infoNames[key]+'</dt><dd data-detail-value="'+key+'">'+skeleton()+'</dd></div>').join('\n');
 const columns=Object.entries(groupFields).map(([group,keys])=>'<section class="app-player-detail-attribute-group" data-detail-attribute-group="'+group+'"><h3 data-detail-group-title="'+group+'">'+titleMap[group]+'</h3><dl>'+keys.map(key=>'<div class="app-player-detail-attribute-line"><dt data-detail-attr-label="'+key+'">'+attrNames[key]+'</dt><dd data-detail-attr-value="'+key+'">'+skeleton()+'</dd></div>').join('')+'</dl></section>').join('\n');
 const legend="<div class=\"app-player-detail-legend\" data-detail-legend><p id=\"player-detail-attribute-legend-title\" data-detail-legend-title>Legend</p><ul aria-labelledby=\"player-detail-attribute-legend-title\"><li data-detail-tier=\"core\"><span class=\"app-standings-legend-swatch\" aria-hidden=\"true\"></span><span data-detail-legend-label=\"core\">Key attributes</span></li><li data-detail-tier=\"support\"><span class=\"app-standings-legend-swatch\" aria-hidden=\"true\"></span><span data-detail-legend-label=\"support\">Supporting attributes</span></li></ul></div>";
 const viewTabs=['overview','info','stats','history','progression'].map((view,i)=>'<button type="button" id="player-detail-'+view+'-tab" class="app-competition-tab'+(i===0?' is-active':'')+'" role="tab" data-detail-view="'+view+'" aria-selected="'+(i===0)+'" tabindex="'+(i===0?'0':'-1')+'"'+(i>1?' disabled aria-disabled="true"':' aria-controls="player-detail-'+view+'-panel"')+'>'+view.charAt(0).toUpperCase()+view.slice(1)+'</button>').join('');
 const pitch='<svg data-detail-pitch class="app-player-detail-pitch" viewBox="0 0 240 330" role="img" aria-label="Playable positions" xmlns="http://www.w3.org/2000/svg">'
  +'<rect width="240" height="330" rx="5" fill="#246A4C"/>'
  +Array.from({length:11},(_,i)=>'<rect x="0" y="'+(i*30)+'" width="240" height="15" fill="#FFFFFF" opacity=".035"/>').join('')
  +'<g fill="none" stroke="#FFFFFF" stroke-width="1.4" opacity=".72"><rect x="9" y="9" width="222" height="312"/><path d="M9 165H231M66 9V55H174V9M96 9V26H144V9M66 321V275H174V321M96 321V304H144V321"/><circle cx="120" cy="165" r="34"/><path d="M97 55 A24 24 0 0 0 143 55M97 275 A24 24 0 0 1 143 275"/></g>'
  +'<g fill="#fff" opacity=".9"><circle cx="120" cy="36" r="2.5"/><circle cx="120" cy="294" r="2.5"/><circle cx="120" cy="165" r="2"/></g><g data-detail-pitch-markers></g></svg>';
 const silhouette='<svg class="app-player-detail-silhouette" data-detail-portrait-placeholder viewBox="0 0 160 181" width="160" height="181" fill="none" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path d="M21 181v-35c0-23 12-39 33-46l16-5h20l16 5c21 7 33 23 33 46v35H21Z" fill="currentColor" opacity=".28"/><path d="M59 96c8 9 34 9 42 0l-3-17H62l-3 17Z" fill="currentColor" opacity=".46"/><path d="M55 53c0-20 10-34 25-34s25 14 25 34v15c0 23-11 37-25 37S55 91 55 68V53Z" fill="currentColor" opacity=".64"/><path d="M54 54c0-25 12-37 27-37 18 0 28 14 27 37-7-7-11-17-15-17-8 5-22 5-39 17Z" fill="currentColor" opacity=".82"/><path d="M54 65c-8-3-8 14 1 17M106 65c8-3 8 14-1 17" stroke="currentColor" stroke-width="5" opacity=".5"/><path d="M55 100l12 12c7 8 19 8 26 0l12-12" stroke="currentColor" stroke-width="3" opacity=".48"/><path d="M57 100c-8 7-19 9-27 20m73-20c8 7 19 9 27 20" stroke="currentColor" stroke-width="2" opacity=".26"/></svg>';
 const portraitPhoto='<img class="app-player-detail-photo" data-detail-portrait-photo width="160" height="181" alt="" decoding="async" hidden>';
 return '<div class="app-player-detail-wrap" data-player-detail>\n'
  +'<header class="app-player-detail-heading"><div class="app-player-detail-portrait" data-detail-portrait>'+silhouette+portraitPhoto+'</div>'
  +'<div class="app-player-detail-identity"><h1 id="player-detail-title" class="app-page-title"><span class="sr-only" data-detail-heading-fallback>'+(preview?'Player preview':'Player')+'</span><span data-detail-name><span class="app-skeleton-bar app-player-detail-name-skeleton" aria-hidden="true"></span></span></h1>'
  +'<p class="app-player-detail-role" data-detail-role><span class="app-skeleton-bar" aria-hidden="true"></span></p>'
  +'<div class="app-player-detail-header-meta"><span data-detail-header-nationality><span class="app-player-detail-country-skeleton" aria-hidden="true"><span class="app-skeleton-bar app-player-detail-flag-skeleton"></span><span class="app-skeleton-bar app-player-detail-nationality-skeleton"></span></span></span><span class="app-player-detail-header-separator" aria-hidden="true" hidden>·</span><span data-detail-header-age hidden></span></div>'
  +'<p class="app-player-detail-subtitle" data-detail-subtitle>&nbsp;</p></div>'
  +'<div class="app-player-detail-affiliation"><div class="app-player-detail-affiliation-content" data-detail-club><span class="app-player-detail-club-loading" aria-hidden="true"><span class="app-skeleton-bar app-player-detail-club-logo-skeleton"></span><span class="app-skeleton-bar app-player-detail-club-name-skeleton"></span></span></div></div>'
  +(preview?'<a class="app-player-detail-back" data-detail-back href="/admin/players">Back to preview</a>':'')+'</header>\n'
  +'<nav class="app-competition-tabs club-tabs app-player-detail-tabs" role="tablist" aria-label="Player views">'+viewTabs+'</nav>\n'
  +'<div class="app-player-detail-overview" id="player-detail-overview-panel" data-detail-panel="overview" role="tabpanel" aria-labelledby="player-detail-overview-tab">'
  +'<div class="app-player-detail-top">'
  +'<section class="app-panel app-player-detail-positions" data-detail-positions aria-labelledby="player-detail-positions-title"><h2 id="player-detail-positions-title" data-detail-section-title="positions">Positions</h2>'
  +'<div class="app-player-detail-pitch-holder">'+pitch+'</div></section>'
  +'<section class="app-panel app-player-detail-attributes" aria-labelledby="player-detail-attributes-title"><h2 id="player-detail-attributes-title" data-detail-section-title="attributes">Attributes</h2>'
  +'<div class="app-player-detail-attribute-columns">'+columns+'</div>'+legend+'</section></div></div>'
  +'<section class="app-panel app-player-detail-info app-player-detail-info-view" id="player-detail-info-panel" data-detail-panel="info" role="tabpanel" aria-labelledby="player-detail-info-tab"><h2 data-detail-section-title="info">Info</h2><dl class="app-player-detail-info-list">'+infoRows+'</dl></section>'
  +'<p class="app-player-detail-status" data-detail-status role="status" aria-live="polite" hidden></p></div>';
}
export function renderPlayerDetailPage(html,mode){
 if(mode!=='public'&&mode!=='preview')throw new TypeError('invalid_detail_mode');
 const preview=mode==='preview',marker=preview?'<section id="app-admin"':'<section id="app-divisions"';
 const start=html.indexOf(marker),end=html.indexOf('\n      </main>',start);
 if(start<0||end<0)throw new Error('Player detail source shell missing');
 const section='<section id="'+(preview?'app-admin':'app-divisions')+'" class="app-view '+(preview?'app-admin-view ':'')+'app-player-detail-page" aria-labelledby="player-detail-title" data-player-detail-mode="'+mode+'"'+(preview?' hidden':'')+'>\n          '+detailPanel(preview)+'\n        </section>';
 let result=html.slice(0,start)+section+html.slice(end);
 const current=preview?'/assets/admin-players-preview.js':'/assets/players-directory.js';
 if(!result.includes(current))throw new Error('Player detail source script missing');
 result=result.replace(current,'/assets/player-detail.js')
  .replace(preview?'<title>Admin — Players Preview':'<title>Players — Football Architect',
           preview?'<title>Player preview':'<title>Player — Football Architect');
 if(!result.includes('/assets/player-detail.css'))
  result=result.replace('</head>','  <link rel="stylesheet" href="/assets/player-detail.css">\n</head>');
 if(!result.includes('data-player-detail-first-paint'))
  result=result.replace('</head>','  <script data-player-detail-first-paint>document.documentElement.dataset.playerDetailView=new URLSearchParams(location.search).get("view")==="info"?"info":"overview";</script>\n</head>');
 return result;
}
