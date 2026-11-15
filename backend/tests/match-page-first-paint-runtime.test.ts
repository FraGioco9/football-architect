import {it,expect} from 'vitest';
import {applyPublishedMatchFirstPaint} from '../src/match-page-first-paint.ts';
const template='<!doctype html>\n<html lang="en"><head>\n<title>Match</title></head><body>'+
 '<section class="app-match-scoreboard"></section></body></html>';
const published={schemaVersion:1,providerId:'authoritative-world',matchId:'128',
 season:2,competitionId:'IT-1',stageId:'league',day:8,round:4,
 provenance:{kind:'authoritative'},result:{homeGoals:8,awayGoals:0}};
it('parser-time HTML includes only verified competition palette before page markup',()=>{
 const result=applyPublishedMatchFirstPaint(template,published,'128');
 const style=result.indexOf('<style data-fa-match-first-paint>');
 expect(style).toBeGreaterThan(result.indexOf('<head>'));
 expect(style).toBeLessThan(result.indexOf('</head>'));
 expect(result).toContain('--app-match-surface:#155F50');
 expect(result).toContain('--app-match-accent:#243039');
 expect(result).not.toContain('homeGoals');
 expect(result).not.toContain('IT-1');
 expect(result.match(/data-fa-match-first-paint/g)).toHaveLength(1);
});
it('unpublished, bad IDs, mismatched scopes and malformed HTML remain neutral',()=>{
 for(const invalid of [
  {...published,providerId:'demo'}, {...published,matchId:'129'},
  {...published,provenance:{kind:'staged'}},
  {...published,competitionId:'ZZ-1'},
  {...published,season:0},
  {...published,day:57}
 ])expect(applyPublishedMatchFirstPaint(template,invalid,'128')).toBe(template);
 expect(applyPublishedMatchFirstPaint(template,{...published,competitionId:'int-1'},'128')).toBe(template);
 expect(applyPublishedMatchFirstPaint('<html>missing scoreboard</html>',published,'128')).toBe('<html>missing scoreboard</html>');
});
