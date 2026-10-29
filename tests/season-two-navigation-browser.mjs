// Final-gate browser scenario. Requires a disposable seeded Season2 world with a published calendar.
// Exported for the consolidated Worker/browser harness; never executes on import.
import assert from 'node:assert/strict';
export async function verifySeasonTwoNavigation(page,baseUrl='http://localhost:2000'){
 await page.goto(baseUrl+'/competitions/it-1/history?season=1');
 await page.waitForFunction(()=>window.faCompetitionContext?.seasonData?.history?.season===1);
 assert.equal(new URL(page.url()).searchParams.get('season'),'1');
 await page.reload();await page.waitForFunction(()=>window.faCompetitionContext?.seasonData?.history?.season===1);
 assert.equal(new URL(page.url()).searchParams.get('season'),'1');
 await page.goto(baseUrl+'/competitions/it-1/fixtures?season=2');
 await page.waitForFunction(()=>window.faCompetitionContext?.selectedSeason===2&&window.faCompetitionContext?.seasonData?.provenance?.kind==='authoritative'&&!document.getElementById('app-fixtures-list')?.hidden);
 assert.equal(await page.locator('#app-fixtures-list .app-fixture-match').count(),8);
 await page.goto(baseUrl+'/calendar?season=2');
 await page.waitForFunction(()=>window.faWorldCalendar?.getPublicWorld?.()?.seasonNumber===2&&window.faCalendarSelectedSeason?.()===2);
 await page.locator('#calendar-season-picker').focus();await page.keyboard.press('ArrowUp');
 await page.waitForFunction(()=>window.faCalendarSelectedSeason?.()===1);
 await page.waitForFunction(()=>window.faWorldCalendar?.getPublicWorld?.()?.seasonNumber===2);
 await page.locator('#calendar-season-picker').focus();await page.keyboard.press('ArrowDown');
 await page.waitForFunction(()=>window.faCalendarSelectedSeason?.()===2);
 return {historicalSeasonRetained:true,seasonTwoFixturesVisible:true,calendarKeyboardSeasonSelection:true};
}
