// DEV-only browser enhancement injected in memory by the loopback server.
// This file must never be copied into a public artifact or loaded by public HTML.
import { createPreviewStandings } from "./standings-data.mjs";
import { createDebugWidget, registerDebugControls } from "./debug-widget.mjs";

const FLAG = "football-architect:standings-dev-preview";
const ROUNDS_KEY = "football-architect:standings-dev-matchdays";
function readMatchdays(){
 try{const raw=sessionStorage.getItem(ROUNDS_KEY);if(raw===null)return 15;
  const value=Number(raw);return Number.isInteger(value)&&value>=0&&value<=30?value:15;
 }catch{return 15}
}
let matchdays=readMatchdays();
function selectedSeason(){return new URLSearchParams(location.search).get("season")==="2"?2:1;}
async function setMatchdays(value){
 if(!Number.isInteger(value)||value<0||value>30)return false;
 const old=matchdays;if(value===old)return true;
 if(previewState==="ERROR")return false;
 try{sessionStorage.setItem(ROUNDS_KEY,String(value))}catch{return false}
 matchdays=value;
 if(previewState==="ON"){
  const previous=activePreview;
  const replacement=await boot(validPath[1].toUpperCase());
  if(typeof replacement!=="function"){
   matchdays=old;try{sessionStorage.setItem(ROUNDS_KEY,String(old))}catch{}
   return false;
  }
  activePreview=()=>{try{replacement()}finally{previous()}};
 }
 const slider=document.querySelector('[data-dev-control="matchdays"]');
 const number=document.querySelector('[data-dev-control="matchdays-number"]');
 for(const input of [slider,number].filter(Boolean)){input.value=String(matchdays);input.dataset.previous=String(matchdays)}
 return true;
}
async function resetPreview(){
 if(previewState!=="OFF" && !await setPreviewEnabled(false))return false;
 try{sessionStorage.removeItem(ROUNDS_KEY)}catch{return false}
 matchdays=15;
 const input=document.querySelector('[data-dev-control="fictional-standings"]');
 const matchdayRow=document.querySelector('[data-dev-control-row="matchdays"]');
 if(input)input.checked=false;
 for(const control of document.querySelectorAll('[data-dev-control="matchdays"],[data-dev-control="matchdays-number"]')){control.value="15";control.dataset.previous="15"}
 if(matchdayRow)matchdayRow.hidden=true
 return true;
}
const DETAIL = /^\/app\/competitions\/([a-z]{2,3}-[12])\/(?:index\.html)?$/;
const LANG = {
  en: { round: "Matchday",
    home: "Home", away: "Away", W: "Win", D: "Draw", L: "Loss",
    letters: {W:"W",D:"D",L:"L"},
    recent: "latest match" },
  de: { round: "Spieltag",
    home: "Heim", away: "Auswärts", W: "Sieg", D: "Remis", L: "Niederlage",
    letters: {W:"S",D:"U",L:"N"},
    recent: "letztes Spiel" },
  es: { round: "Jornada",
    home: "Local", away: "Visitante", W: "Victoria", D: "Empate", L: "Derrota",
    letters: {W:"V",D:"E",L:"D"},
    recent: "último partido" },
  fr: { round: "Journée",
    home: "Domicile", away: "Extérieur", W: "Victoire", D: "Nul", L: "Défaite",
    letters: {W:"V",D:"N",L:"D"},
    recent: "dernier match" },
  it: { round: "Giornata",
    home: "Casa", away: "Trasferta", W: "Vittoria", D: "Pareggio", L: "Sconfitta",
    letters: {W:"V",D:"N",L:"P"},
    recent: "ultima partita" }
};
const validPath = location.pathname.match(DETAIL);
function isPreviewEnabled() {
 try{return sessionStorage.getItem(FLAG)==="on"}catch{return false}
}
let activePreview=null;
let previewState="OFF";
let transition=Promise.resolve();
function setPreviewEnabled(enabled) {
 transition=transition.catch(()=>false).then(async()=>{
  if(previewState==="ERROR"){
   try{activePreview()}
   catch(error){console.error("DEV preview retry restore failed:",error);return false}
   try{sessionStorage.removeItem(FLAG)}
   catch(error){console.error("DEV preview retry storage failed:",error);return false}
   activePreview=null;
   previewState="OFF";
   if(!enabled)return true;
  }
  if(enabled===(previewState==="ON"))return true;
  if(enabled){
   const cleanup=await boot(validPath[1].toUpperCase());
   if(typeof cleanup!=="function")return false;
   try{sessionStorage.setItem(FLAG,"on")}
   catch(error){
    try{cleanup()}
    catch(restoreError){
     activePreview=cleanup;
     previewState="ERROR";
     console.error("DEV preview rollback failed:",restoreError);
    }
    console.error("DEV preview storage unavailable:",error);
    return false;
   }
   activePreview=cleanup;
   previewState="ON";
   return true;
  }
  // Reject OFF without changing the DOM if persistence is unavailable.
  try{sessionStorage.removeItem(FLAG)}
  catch(error){console.error("DEV preview storage unavailable:",error);return false}
  try{activePreview()}
  catch(error){
   previewState="ERROR";
   console.error("DEV preview restore failed:",error);
   try{sessionStorage.setItem(FLAG,"on")}
   catch(storageError){console.error("DEV preview rollback storage failed:",storageError)}
   return false;
  }
  activePreview=null;
  previewState="OFF";
  return true;
 });
 return transition;
}

if(validPath){
 waitForRows().then(() => {
  registerDebugControls("standings",[{
   type:"switch",id:"fictional-standings",label:"Fictional standings",
   checked:isPreviewEnabled,onChange:setPreviewEnabled
  },{type:"range",id:"matchdays",label:"Matchdays",min:0,max:30,step:1,
    value:()=>matchdays,visible:()=>previewState==="ON",onChange:setMatchdays},
    {type:"button",id:"reset-page",label:"Reset current page",onChange:resetPreview}]);
  let widgetRoot;
  registerDebugControls("general",[{type:"button",id:"reset-global",label:"Reset all",scope:"general",onChange:async()=>{
   if(!await resetPreview())return false;
   return widgetRoot?.resetWidgetState()===true;
  }}]);
  widgetRoot=createDebugWidget({page:"standings"});
  let renderedSeason=selectedSeason();
  let seasonRefresh=Promise.resolve();
  function syncSeason(){
   const next=selectedSeason();
   if(next===renderedSeason)return;
   renderedSeason=next;
   seasonRefresh=seasonRefresh.then(async()=>{
    await transition;
    if(previewState!=="ON")return;
    const previous=activePreview;
    const replacement=await boot(validPath[1].toUpperCase());
    if(typeof replacement!=="function")return;
    activePreview=()=>{try{replacement()}finally{previous()}};
   }).catch(error=>console.error("DEV season preview refresh failed:",error));
  }
  // The competition router notifies subscribers after updating its URL state.
  // Avoid delayed document click polling (which can briefly display stale scores).
  if(typeof window.faCompetitionRoute?.subscribe==="function"){
   window.faCompetitionRoute.subscribe(syncSeason);
  }else{
   window.addEventListener("popstate",syncSeason);
  }
  if(isPreviewEnabled())setPreviewEnabled(true).then(ok=>{
   widgetRoot?.syncVisibility();
  if(!ok){try{sessionStorage.removeItem(FLAG)}catch{}
    const input=document.querySelector('[data-dev-control="fictional-standings"]');
    if(input)input.checked=false;
   }
  });
 }).catch(error => {
  console.error("DEV Debug unavailable:", error);
 });
}

function strings() { return LANG[document.documentElement.lang] || LANG.en; }
function node(tag, className = "", value = "") {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = value;
  return el;
}
function waitForRows() {
  return new Promise((resolve, reject) => {
    let done = false;
    const table = () => {
      const tbody = document.getElementById("app-standings-body");
      if (tbody?.rows.length === 16 && document.querySelector(".app-world-standing-table")) {
        finish(null, tbody);
      }
    };
    const observer = new MutationObserver(table);
    const timer = setTimeout(() => finish(Error("Standings hydration timeout")), 7000);
    function finish(error, body) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      observer.disconnect();
      if (error) reject(error);
      else resolve(body);
    }
    observer.observe(document.documentElement, { childList: true, subtree: true });
    table();
  });
}

async function boot(routeId) {
  try {
    const response = await fetch("/app/competitions/_shared/manifest.json",
      { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw Error("DEV manifest unavailable");
    const manifest = await response.json();
    if (manifest.schemaVersion !== 1 || manifest.approved !== false ||
        !Array.isArray(manifest.divisions) || manifest.divisions.length !== 16 ||
        manifest.divisions.reduce((n, d) => n + d.clubs?.length, 0) !== 256) {
      throw Error("Invalid DEV manifest");
    }
    const division = manifest.divisions.find(d => d.id === routeId);
    if (!division) throw Error("Unknown DEV division");
    const season=selectedSeason();
    const { rows, clubs } = createPreviewStandings(division,matchdays,season);
    // Prepare the complete DEV calendar from the same deterministic season seed.
    // Future rounds have no result; standings and fixtures share completed scores.
    const complete=createPreviewStandings(division,30,season);
    const fixtureData=complete.fixtures.map(game=>({
      round:game.round,
      homeId:game.homeId,
      awayId:game.awayId,
      homeGoals:game.round<=matchdays?game.homeGoals:null,
      awayGoals:game.round<=matchdays?game.awayGoals:null,
      kickoff:null
    }));
    const fixturesApi=window.faFixtures;
    const restoreFixtures=typeof fixturesApi?.snapshot==="function"
      ?fixturesApi.snapshot():null;
    const commitFixtures=typeof fixturesApi?.prepare==="function"
      ?fixturesApi.prepare(fixtureData,{currentMatchday:Math.min(30,matchdays+1)}):null;
    const tbody = await waitForRows();
    const originalIds = new Set([...tbody.rows].map(x => x.dataset.worldClub));
    if (originalIds.size !== 16 || rows.some(r =>
      !originalIds.has(r.club.countryId + "-" + r.club.clubId))) {
      throw Error("DEV standings identities mismatch");
    }

    // Construct the entire table detached. Inconsistencies cannot partly alter the UI.
    const fragment = document.createDocumentFragment();
    const entries = [];
    rows.forEach((r, position) => {
      const tr = node("tr");
      tr.dataset.worldClub = r.club.countryId + "-" + r.club.clubId;
      const value = (text, cls = "app-world-stat-value") => {
        const td = node("td", cls, String(text));
        tr.appendChild(td);
        return td;
      };
      value(position + 1);
      const clubCell = node("th", "app-world-standing-club");
      clubCell.scope = "row";
      const identity = node("span", "app-world-club-identity");
      const crest = node("span", "app-world-club-crest-placeholder");
      crest.dataset.clubCrest = tr.dataset.worldClub;
      crest.setAttribute("aria-hidden", "true");
      identity.append(crest, node("span", "app-world-club-name", r.club.primaryName));
      clubCell.append(identity);
      tr.append(clubCell);
      for (const number of [r.played, r.won, r.drawn, r.lost, r.gf, r.ga,
        r.gd > 0 ? "+" + r.gd : r.gd, r.pts]) value(number);
      const formCell = node("td");
      const strip = node("span", "app-world-form-strip");
      for (const [index, game] of r.recent.entries()) {
        const button = node("button", "app-world-form-dot app-world-form-control app-world-form-" +
          game.result.toLowerCase() + (index === 0 ? " app-world-form-last" : ""));
        button.type = "button";
        button.setAttribute("aria-haspopup","true");
        const glyph = node("span","app-world-form-glyph",game.result);
        button.append(glyph);
        entries.push({ button, glyph, game, ownId: r.club.clubId, latest: index === 0 });
        strip.append(button);
      }
      formCell.append(strip);
      tr.append(formCell);
      fragment.append(tr);
    });
    if (entries.length !== 16*Math.min(5,matchdays) || fragment.childNodes.length !== 16) {
      throw Error("Incomplete DEV standings rendering");
    }
    // Prepare mobile from the validated fixture model before changing the table.
    const mobile = window.faStandingsMobile;
    if (typeof mobile?.prepare !== "function") throw Error("Mobile standings unavailable");
    const commitMobile = mobile.prepare(rows);

    const caption = document.getElementById("app-standings-caption");
    if(!caption)throw Error("Missing standings caption");
    const canonicalRows=[...tbody.childNodes];
    const mobileList=document.getElementById("app-standings-compact-list");
    if(!mobileList)throw Error("Mobile standings list unavailable");
    const canonicalMobile=[...mobileList.childNodes];
    const mobileEntries=[];
    const captionI18n=caption.getAttribute("data-app-i18n");
    const captionText=caption.textContent;
    const listeners=new AbortController();
    const tooltip = node("div", "app-world-form-tooltip");
    tooltip.setAttribute("role", "tooltip");
    tooltip.id = "fa-dev-form-tooltip";
    tooltip.hidden = true;
    const meta = node("div", "app-world-form-tooltip-meta");
    const round = node("span", "app-world-form-tooltip-round");
    const roundLabel = node("span");
    const roundNumber = node("strong");
    round.append(roundLabel, roundNumber);
    meta.append(round);
    const scoreline = node("div", "app-world-form-tooltip-scoreline");
    const homeName = node("span", "app-world-form-tooltip-team");
    const score = node("strong", "app-world-form-tooltip-score");
    const awayName = node("span", "app-world-form-tooltip-team");
    scoreline.append(homeName, score, awayName);
    const context = node("div", "app-world-form-tooltip-context");
    const perspective = node("span");
    context.append(perspective);
    tooltip.append(meta, scoreline, context);
    const lookup = new Map(clubs.map(c => [c.clubId, c]));
    let active = null;
    let selected = null;
    let pressedWhenOpen = false;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    function close() {
      active?.button.removeAttribute("aria-describedby");
      active = null;
      tooltip.setAttribute("aria-hidden", "true");
      if (reduced || tooltip.hidden) {
        tooltip.className = "app-world-form-tooltip";
        tooltip.hidden = true;
      } else {
        tooltip.className = "app-world-form-tooltip is-closing";
      }
    }
    const listen=(target,type,handler,options={})=>
      target?.addEventListener(type,handler,{...options,signal:listeners.signal});
    listen(tooltip,"animationend", e => {
      if (e.target === tooltip && e.animationName === "app-world-tooltip-out" && !active) {
        tooltip.hidden = true;
        tooltip.className = "app-world-form-tooltip";
      }
    });
    function place() {
      if (!active || tooltip.hidden) return;
      const rect = active.button.getBoundingClientRect();
      const width = innerWidth, height = innerHeight;
      const topbarBottom = Math.max(0,
        document.querySelector(".fa-shell-topbar")?.getBoundingClientRect().bottom ?? 0);
      const topLimit = Math.max(8, topbarBottom + 8), bottomLimit = height - 8;
      const w = tooltip.offsetWidth || 300, h = tooltip.offsetHeight || 124;
      if (rect.bottom <= topbarBottom || rect.top >= height || rect.right <= 0 ||
          rect.left >= width || bottomLimit - topLimit < h) return close();
      const left = Math.max(8, Math.min(rect.left + rect.width / 2 - w / 2, width - w - 8));
      const above = rect.top - h - 8, below = rect.bottom + 8;
      const top = above >= topLimit ? above : below + h <= bottomLimit ? below :
        (rect.top - topLimit >= bottomLimit - rect.bottom ? topLimit : bottomLimit - h);
      tooltip.style.left = Math.round(left) + "px";
      tooltip.style.top = Math.round(Math.max(topLimit, Math.min(top, bottomLimit - h))) + "px";
    }
    function translate() {
      const t = strings();
      for (const entry of entries) {
         entry.glyph.textContent = t.letters[entry.game.result];
         entry.button.setAttribute("aria-label", t[entry.game.result] +
           (entry.latest ? " — " + t.recent : ""));
       }
      if (selected) {
        roundLabel.textContent = t.round + " ";
        perspective.textContent = selected.game.isHome ? t.home : t.away;
      }
    }
    function open(entry) {
      active?.button.removeAttribute("aria-describedby");
      active = entry;
      selected = entry;
      const game = entry.game;
      homeName.textContent = lookup.get(game.homeId).primaryName;
      awayName.textContent = lookup.get(game.awayId).primaryName;
      score.textContent = game.homeGoals + " – " + game.awayGoals;
      roundNumber.textContent = String(game.round);
      tooltip.hidden = false;
      tooltip.className = "app-world-form-tooltip";
      tooltip.removeAttribute("aria-hidden");
      entry.button.setAttribute("aria-describedby", tooltip.id);
      translate();
      place();
    }
    const languageObserver=new MutationObserver(translate);
    let committed=false;
    let restored=false;
    function restore(){
      if(restored)return;
      const failures=[];
      const attempt=fn=>{try{fn()}catch(error){failures.push(error)}};
      attempt(()=>listeners.abort());
      attempt(()=>languageObserver.disconnect());
      attempt(()=>tooltip.remove());
      if(committed){
       if(restoreFixtures)attempt(restoreFixtures);
       attempt(()=>tbody.replaceChildren(...canonicalRows));
       attempt(()=>mobileList.replaceChildren(...canonicalMobile));
       attempt(()=>{
        if(captionI18n===null)caption.removeAttribute("data-app-i18n");
        else caption.setAttribute("data-app-i18n",captionI18n);
        caption.textContent=captionText;
       });
       attempt(()=>window.faAppRenderLanguage?.());
      }
      if(failures.length)throw new AggregateError(failures,"DEV standings restore incomplete");
      restored=true;
    }
    try {
    committed=true;
    // Commit to DOM only after all integrity checks and node construction passed.
    if(commitFixtures)commitFixtures();
    tbody.replaceChildren(fragment);
    commitMobile();
    // Preserve the canonical compact-form marks exactly as rendered. Bind taps
    // directly to those marks and cancel the enclosing <summary> activation.
    const mobileItems=[...mobileList.querySelectorAll(".app-world-mobile-item")];
    if(mobileItems.length!==rows.length)throw Error("Mobile standings row/model mismatch");
    mobileItems.forEach((item,rowIndex)=>{
      const row=rows[rowIndex];
      const marks=[...item.querySelectorAll(".app-world-mobile-form .app-world-form-dot")];
      if(marks.length!==row.recent.length)throw Error("Mobile recent-form count mismatch");
      marks.forEach((mark,index)=>{
        const game=row.recent[index];
        mobileEntries.push({button:mark,glyph:mark,game,ownId:row.club.clubId,latest:index===0,mobile:true});
      });
    });
    caption.dataset.appI18n="standingsFilledCaption";
    window.faAppRenderLanguage?.();
    document.body.appendChild(tooltip);
    translate();
    languageObserver.observe(document.documentElement, {
      attributes: true, attributeFilter: ["lang"]
    });
    for (const entry of [...entries,...mobileEntries]) {
      const btn = entry.button;
      listen(btn,"pointerenter", e => {
        if (e.pointerType === "mouse" || e.pointerType === "pen") open(entry);
      });
      listen(btn,"pointerleave", e => {
        if ((e.pointerType === "mouse" || e.pointerType === "pen") &&
            active === entry && document.activeElement !== btn) close();
      });
      listen(btn,"focus", () => open(entry));
      listen(btn,"blur", () => { if (active === entry) close(); });
      listen(btn,"pointerdown", e => {
        pressedWhenOpen = (e.pointerType === "touch" || e.pointerType === "pen") &&
          active === entry;
      });
      listen(btn,"click", e => {
        if(entry.mobile){e.preventDefault();e.stopPropagation();}
        if (pressedWhenOpen && active === entry) close();
        else open(entry);
        pressedWhenOpen = false;
      });
    }
    listen(document,"pointerdown", e => {
      if (active && !tooltip.contains(e.target) && e.target !== active.button) close();
    });
    listen(document,"keydown", e => {
      if (e.key === "Escape" && active) { close(); e.stopPropagation(); }
    });
    listen(window,"resize", place);
    listen(window,"scroll", place, { passive: true });
    listen(document.querySelector(".fa-shell-content-scroll"),"scroll",place,{passive:true});
    listen(document.querySelector(".app-world-standing-scroll"),"scroll",place,{passive:true});
    return restore;
    } catch(error){restore();throw error}
  } catch (error) {
    // Fail closed: do not disclose partial standings or mutate canonical sources.
    console.error("Standings DEV Preview unavailable:", error);
  }
}
