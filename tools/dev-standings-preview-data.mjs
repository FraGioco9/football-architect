// Deterministic fictional league fixtures for isolated local DEV preview only.
// This module is NOT on the publication-guard allowlist. Never use as sports data.
export const PREVIEW_SCHEMA_VERSION = 1;
const DIVISION_ID = /^(IT|ENG|ES|DE|FR|PT|NL|BR)-[12]$/;

function assertDivision(division) {
  if (!division || !DIVISION_ID.test(division.id) ||
      !Array.isArray(division.clubs) || division.clubs.length !== 16 || division.capacity !== 16 ||
      ![1,2].includes(division.tier) || division.id !== division.countryId + "-" + division.tier) {
    throw Error("Invalid DEV division");
  }
  const ids = new Set();
  const start = division.tier === 1 ? 1 : 17;
  for (const club of division.clubs) {
    if (!Number.isInteger(club.clubId) || club.clubId !== start + ids.size ||
        club.countryId !== division.countryId ||
        typeof club.primaryName !== "string" || !club.primaryName.trim() ||
        ids.has(club.clubId)) throw Error("Invalid or repeated DEV club identity");
    ids.add(club.clubId);
  }
}

function randomSource(key) {
  let state = 2166136261;
  for (const letter of key) {
    state ^= letter.codePointAt(0);
    state = Math.imul(state, 16777619) >>> 0;
  }
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function createPreviewStandings(division, matchdays = 15) {
  assertDivision(division);
  if (!Number.isInteger(matchdays) || matchdays < 0 || matchdays > 30) throw Error("Invalid DEV matchday count");
  const clubs = [...division.clubs].sort((a, b) => a.clubId - b.clubId);
  const random = randomSource("FA-STANDINGS-DEV-v" + PREVIEW_SCHEMA_VERSION + ":" +
    division.id + ":" + clubs.map(c => c.clubId).join(","));
  const rotation = clubs.map(c => c.clubId);
  const fixtures = [];
  const byId = new Map(clubs.map(club => [club.clubId, {
    club, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0,
    gd: 0, pts: 0, recent: []
  }]));
  const pairings = new Set();

  for (let round = 1; round <= 15; round++) {
    for (let index = 0; index < 8; index++) {
      const a = rotation[index], b = rotation[15 - index];
      const homeId = (round + index) % 2 === 0 ? a : b;
      const awayId = homeId === a ? b : a;
      const pair = [a, b].sort((x, y) => x - y).join(":");
      if (a === b || pairings.has(pair)) throw Error("Invalid DEV schedule pairing");
      pairings.add(pair);
      const homeGoals = Math.floor(random() * 5);
      const awayGoals = Math.floor(random() * 5);
      const fixture = { round, homeId, awayId, homeGoals, awayGoals };
      fixtures.push(fixture);
      fixtures.push({round:round+15,homeId:awayId,awayId:homeId,
        homeGoals:Math.floor(random()*5),awayGoals:Math.floor(random()*5)});
    }
    rotation.splice(1, 0, rotation.pop());
  }
  for (const fixture of fixtures.filter(game=>game.round<=matchdays)) {
      const {homeId,awayId,homeGoals,awayGoals}=fixture;
      const h = byId.get(homeId), v = byId.get(awayId);
      h.played++; v.played++;
      h.gf += homeGoals; h.ga += awayGoals;
      v.gf += awayGoals; v.ga += homeGoals;
      const homeForm = homeGoals > awayGoals ? "W" : homeGoals < awayGoals ? "L" : "D";
      const awayForm = homeForm === "W" ? "L" : homeForm === "L" ? "W" : "D";
      if (homeForm === "W") { h.won++; v.lost++; }
      else if (homeForm === "L") { v.won++; h.lost++; }
      else { h.drawn++; v.drawn++; }
      h.recent.push({ ...fixture, result: homeForm, isHome: true });
      v.recent.push({ ...fixture, result: awayForm, isHome: false });
  }
  const rows = [...byId.values()].map(row => {
    row.gd = row.gf - row.ga;
    row.pts = 3 * row.won + row.drawn;
    row.recent = row.recent.slice(-5).reverse();
    if (row.played !== matchdays || row.won + row.drawn + row.lost !== matchdays ||
        row.recent.length !== Math.min(5,matchdays)) throw Error("Incomplete DEV club results");
    return row;
  }).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf ||
    a.club.clubId - b.club.clubId);
  if (fixtures.length !== 240 || pairings.size !== 120 || rows.length !== 16 ||
      rows.reduce((n, x) => n + x.gf, 0) !== rows.reduce((n, x) => n + x.ga, 0) ||
      rows.reduce((n, x) => n + x.won, 0) !== rows.reduce((n, x) => n + x.lost, 0)) {
    throw Error("Unbalanced DEV fixture model");
  }
  return { divisionId: division.id, rows, fixtures:fixtures.filter(game=>game.round<=matchdays), clubs };
}
