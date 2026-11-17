/**
 * #577 — HTML first-paint palette for an AUTHORITATIVELY PUBLISHED match.
 * No client request, user preference, untrusted HEX or guessed competition.
 */
import {referenceFromPublicMatch} from '../assets/match-references.mjs';
import {resolveFirstPaintMatchTheme} from '../assets/match-scoreboard-themes.mjs';
import {matchPublicContext} from '../assets/match-public-context.mjs';
export function applyPublishedMatchFirstPaint(html,payload,expectedId){
 const reference=referenceFromPublicMatch(payload,expectedId);
 if(!reference)return html;
 const theme=resolveFirstPaintMatchTheme(reference.competitionId);
 if(!theme)return html;
 // Only the approved, generated match HTML is eligible. Do not modify API
 // responses, arbitrary documents, or malformed/fallback content.
 if(!html.startsWith('<!doctype html>')||!html.includes('<head>')||
    !html.includes('<section class="app-match-scoreboard" data-scoreboard-theme="neutral"')||
    !html.includes('</head>'))return html;
 // These are closed-over versioned HEX literals; never embed a request value.
 // Executed by the HTML parser before the scoreboard exists or any defer JS.
 const css='html .app-match-scoreboard{'+
  '--app-match-surface:'+theme.backgroundHex+';'+
  '--app-match-ink:'+theme.foregroundHex+';'+
  '--app-match-accent:'+theme.accentHex+'}';
 // Also remove the neutral-state CSS override before paint. In Light mode
 // that override otherwise keeps the logo tile border grey until hydration.
 const branded=html.replace('data-scoreboard-theme="neutral"',
  'data-scoreboard-theme="competition"');
 return branded.replace('</head>','<style data-fa-match-first-paint>'+css+'</style>\n</head>');
}


/**
 * Reuse the same anonymous authoritative read for first paint and hydration.
 * Invalid/unpublished/mismatched matches keep the existing client API fallback.
 * The JSON script is inert and HTML-escaped, never executable JavaScript.
 */
export function applyPublishedMatchDocument(html,payload,expectedId){
 const painted=applyPublishedMatchFirstPaint(html,payload,expectedId);
 if(!referenceFromPublicMatch(payload,expectedId)||
    !['awaiting_participants','scheduled','in_progress','completed','postponed','cancelled'].includes(payload.status)||
    payload.status==='completed'&&(!Number.isSafeInteger(payload.result?.homeGoals)||
     !Number.isSafeInteger(payload.result?.awayGoals)||payload.result.homeGoals<0||payload.result.awayGoals<0)||
    !html.startsWith('<!doctype html>')||!html.includes('<head>')||
    !html.includes('<section class="app-match-scoreboard" data-scoreboard-theme="neutral"')||
    !html.includes('</head>')||html.includes('id="fa-match-initial-data"'))return painted;
 let json;
 try{json=JSON.stringify({match:payload,context:matchPublicContext(payload)})}catch{return painted}
 // Bound HTML growth; a large response can safely use the normal API path.
 if(typeof json!=='string'||json.length>131072)return painted;
 const safe=json.replace(/[<>&\u2028\u2029]/g,ch=>'\\u'+ch.charCodeAt(0).toString(16).padStart(4,'0'));
 const script='<script id="fa-match-initial-data" type="application/json">'+safe+'</script>';
 return painted.replace('</head>',script+'\n</head>');
}
