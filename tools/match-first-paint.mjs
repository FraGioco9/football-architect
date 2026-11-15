/**
 * #577 — HTML first-paint palette for an AUTHORITATIVELY PUBLISHED match.
 * No client request, user preference, untrusted HEX or guessed competition.
 */
import {referenceFromPublicMatch} from '../assets/match-references.mjs';
import {resolveFirstPaintMatchTheme} from '../assets/match-scoreboard-themes.mjs';
export function applyPublishedMatchFirstPaint(html,payload,expectedId){
 const reference=referenceFromPublicMatch(payload,expectedId);
 if(!reference)return html;
 const theme=resolveFirstPaintMatchTheme(reference.competitionId);
 if(!theme)return html;
 // Only the approved, generated match HTML is eligible. Do not modify API
 // responses, arbitrary documents, or malformed/fallback content.
 if(!html.startsWith('<!doctype html>')||!html.includes('<head>')||
    !html.includes('<section class="app-match-scoreboard"')||
    !html.includes('</head>'))return html;
 // These are closed-over versioned HEX literals; never embed a request value.
 // Executed by the HTML parser before the scoreboard exists or any defer JS.
 const css='html .app-match-scoreboard{'+
  '--app-match-surface:'+theme.backgroundHex+';'+
  '--app-match-ink:'+theme.foregroundHex+';'+
  '--app-match-accent:'+theme.accentHex+'}';
 return html.replace('</head>','<style data-fa-match-first-paint>'+css+'</style>\n</head>');
}
