import {it,expect} from 'vitest';
import {applyPublishedMatchFirstPaint,applyPublishedMatchDocument} from '../src/match-page-first-paint.ts';
const template='<!doctype html>\n<html lang="en"><head>\n<title>Match</title></head><body>'+
 '<section class="app-match-scoreboard" data-scoreboard-theme="neutral"></section></body></html>';
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
 expect(result).toContain('data-scoreboard-theme="competition"');
 expect(result).not.toContain('data-scoreboard-theme="neutral"');
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

it('reuses one authorised public match read without executable inline scripts',()=>{
 const match={...published,status:'scheduled',homeParticipant:{clubId:'IT-1'},
  awayParticipant:{clubId:'IT-2'},venue:{name:'</script><script>alert(1)</script> & \u2028'}};
 const html=applyPublishedMatchDocument(template,match,'128');
 expect(html).toContain('data-fa-match-first-paint');
 const script=html.match(/<script id="fa-match-initial-data" type="application\/json">([\s\S]*?)<\/script>/);
 expect(script).not.toBeNull();
 expect(script?.[1]).not.toContain('<');
 expect(script?.[1]).toContain('\\u003c');
 const boot=JSON.parse(script![1]);
 expect(boot.match).toEqual(match);
 expect(boot.context.clubs.map((c:{countryId:string;clubId:number})=>c.countryId+'-'+c.clubId)).toEqual(['IT-1','IT-2']);
 expect(boot.context.competitions[0].id).toBe('IT-1');
 expect((html.match(/id="fa-match-initial-data"/g)||[])).toHaveLength(1);
});
it('keeps the neutral theme for international matches but still reuses their read',()=>{
 const match={...published,competitionId:'int-1',status:'awaiting_participants',
  homeParticipant:null,awayParticipant:null};
 const html=applyPublishedMatchDocument(template,match,'128');
 expect(html).not.toContain('data-fa-match-first-paint');
 expect(html).toContain('data-scoreboard-theme="neutral"');
 expect(html).toContain('id="fa-match-initial-data"');
});
it('falls back to API for missing, invalid or oversized boot data',()=>{
 const valid={...published,status:'scheduled'};
 for(const invalid of [
  {...valid,providerId:'demo'}, {...valid,matchId:'129'}, {...valid,status:'other'},
  {...valid,provenance:{kind:'staged'}},
  {...valid,status:'completed',result:null}
 ])expect(applyPublishedMatchDocument(template,invalid,'128')).not.toContain('id="fa-match-initial-data"');
 const oversized={...valid,events:['x'.repeat(140000)]};
 expect(applyPublishedMatchDocument(template,oversized,'128')).not.toContain('id="fa-match-initial-data"');
});
