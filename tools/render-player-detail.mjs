// Canonical player-detail first-paint shell. All player data is API-owned.
const groups=['technical','mental','physical','goalkeeping'];
const overview=['nationality','secondary_nationality','age','positions','height_cm','preferred_foot'];
function detailPanel(){
 const fields=overview.map(key=>'<div class="app-player-detail-field"><dt data-detail-label="'+key+'">&nbsp;</dt><dd data-detail-value="'+key+'"><span class="app-skeleton-bar" aria-hidden="true"></span></dd></div>').join('\n');
 const skills=Array.from({length:8},(_,i)=>'<div class="app-player-detail-field" data-detail-attr-slot="'+i+'"><dt>&nbsp;</dt><dd><span class="app-skeleton-bar" aria-hidden="true"></span></dd></div>').join('\n');
 const tabs=groups.map((key,i)=>'<button type="button" class="app-competition-tab app-players-group'+(i===0?' is-active':'')+'" role="tab" aria-selected="'+(i===0)+'" data-detail-group="'+key+'">'+key+'</button>').join('\n');
 return '<div class="app-player-detail-wrap" data-player-detail>\n'
 +'<header class="app-player-detail-heading"><div class="app-player-detail-identity">'
 +'<h1 id="player-detail-title" class="app-page-title"><span data-detail-name><span class="app-skeleton-bar app-player-detail-name-skeleton" aria-hidden="true"></span></span></h1>'
 +'<p data-detail-subtitle class="app-player-detail-subtitle">&nbsp;</p></div>'
 +'<a class="app-link app-link-secondary app-player-detail-back" data-detail-back href="/players">Back to players</a></header>\n'
 +'<nav class="app-competition-tabs app-players-tabs" role="tablist" aria-label="Player views">'
 +'<button type="button" class="app-competition-tab is-active" role="tab" data-detail-view="overview" aria-selected="true">Overview</button>'
 +'<button type="button" class="app-competition-tab" role="tab" data-detail-view="attributes" aria-selected="false">Attributes</button></nav>\n'
 +'<div class="app-players-toolbar"><nav class="app-players-groups" role="tablist" aria-label="Attribute groups">'+tabs+'</nav></div>\n'
 +'<section class="app-player-detail-content" data-detail-panel="overview" aria-label="Player overview"><dl class="app-player-detail-grid">'+fields+'</dl></section>\n'
 +'<section class="app-player-detail-content" data-detail-panel="attributes" aria-label="Player attributes" hidden><dl class="app-player-detail-grid">'+skills+'</dl></section>\n'
 +'<p class="app-player-detail-status" data-detail-status role="status" aria-live="polite"></p></div>';
}
export function renderPlayerDetailPage(html,mode){
 if(mode!=='public'&&mode!=='preview')throw new TypeError('invalid_detail_mode');
 const preview=mode==='preview',marker=preview?'<section id="app-admin"':'<section id="app-divisions"';
 const start=html.indexOf(marker),end=html.indexOf('\n      </main>',start);
 if(start<0||end<0)throw new Error('Player detail source shell missing');
 const section='<section id="'+(preview?'app-admin':'app-divisions')+'" class="app-view '+(preview?'app-admin-view ':'')+'app-player-detail-page" aria-labelledby="player-detail-title" data-player-detail-mode="'+mode+'"'+(preview?' hidden':'')+'>\n          '+detailPanel()+'\n        </section>';
 let result=html.slice(0,start)+section+html.slice(end);
 const current=preview?'/assets/admin-players-preview.js':'/assets/players-directory.js';
 if(!result.includes(current))throw new Error('Player detail source script missing');
 result=result.replace(current,'/assets/player-detail.js')
  .replace(preview?'<title>Admin — Players Preview':'<title>Players — Football Architect',
           preview?'<title>Admin — Player':'<title>Player — Football Architect');
 if(!result.includes('/assets/player-detail.css'))
  result=result.replace('</head>','  <link rel="stylesheet" href="/assets/player-detail.css">\n</head>');
 return result;
}
