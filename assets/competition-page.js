/* Shared competition initialization for domestic and international routes. */
(() => {
  "use strict";
  if(window.faCompetitionContextApi)return;
  const sourceUrl = document.currentScript?.src;
  const routeId = document.querySelector('meta[name="fa-competition"]')?.content;
  const root = new URL("../competitions/_shared/", sourceUrl);
  const status = document.getElementById("main-content");

  function fail() {
    if (!status || !document.body) return;
    delete window.faCompetitionContext;
    delete window.faCompetitionDivision;
    delete window.faCompetitionContextApi;
    const main = document.createElement("main");
    main.className = "app-main";
    main.setAttribute("role", "alert");
    main.textContent = "Competition unavailable. ";
    const back = document.createElement("a");
    back.href = "../";
    back.textContent = "Back to Competitions";
    main.appendChild(back);
    status.replaceChildren(main);
  }
  const model=window.faCompetitionModel;
  const formLabels = {
    W:["standingsDemoFormWin","Win","standingsDemoWinLetter"],
    D:["standingsDemoFormDraw","Draw","standingsDemoDrawLetter"],
    L:["standingsDemoFormLoss","Loss","standingsDemoLossLetter"]
  };
  const demoFormTriggers = [];
  // Enhance only the standings region; logos remain in their original declarative shadow roots.
  function withMobileShell(html) {
    const open = '<div class="app-world-standings">';
    const close = '</table>\n            </div>\n          </div>';
    if (html.split(open).length !== 2 || html.split(close).length !== 2)
      throw Error("Unexpected shared standings markup");
    const compact = [
      '<div class="app-world-compact" id="app-standings-compact" hidden>',
      '<ol class="app-world-mobile-list" id="app-standings-compact-list"></ol>',
      '</div>'
    ].join("");
    return html
      .replace('<div class="app-world-standing-scroll" role="region"',
        '<div class="app-world-standing-scroll" id="app-standings-full" role="region"')
      .replace(close,'</table>\n            </div>'+compact+'\n          </div>');
  }

  function createCrestHost(id) {
    const crest=document.createElement("span");
    crest.className="app-world-club-crest-placeholder";
    crest.dataset.clubCrest=id;
    crest.setAttribute("aria-hidden","true");
    // Reserve a blank slot before initial rows paint or the image renderer loads.
    if(Object.hasOwn(window.faClubCrests||{},id))crest.dataset.clubCrestPending="true";
    return crest;
  }

  // Presentation only: indicate the Rules bands without changing league ranking.
  function standingOutcome(position) {
    const selected=window.faCompetitionContext?.definition||definition;
    if(!Number.isInteger(position)||position<1||!selected||position>selected.capacity)return '';
    // The canonical rank-outcome configuration owns row styling; international qualification is legend-only.
    const phase=selected.rules.phases.find(p=>p.rankOutcomes);
    return window.faCompetitionRules.outcomeStyle(window.faCompetitionRules.outcomeAt(selected,phase.id,position)?.kind);
  }
  function decorateStanding(row, position) {
    if(Number.isInteger(position))row.dataset.standingRank=String(position);else delete row.dataset.standingRank;
    const outcome = standingOutcome(position);
    // Debug Settings can reorder the same mounted rows. Always clear the previous
    // position band before applying the new one, or stale champion/gold highlights remain.
    if (row.dataset.standingOutcome) delete row.dataset.standingOutcome;
    if (row.getAttribute?.("aria-describedby")?.startsWith("standings-outcome-")) {
      row.removeAttribute("aria-describedby");
    }
    if (outcome) {
      row.dataset.standingOutcome = outcome;
      row.setAttribute("aria-describedby", "standings-outcome-" + outcome);
    }
  }
  window.faStandingsOutcomes = Object.freeze({decorate:decorateStanding});
  function refreshSeasonPresentation(){
    for(const id of ['app-standings-body','app-standings-compact-list'])for(const row of document.getElementById(id)?.children||[]){
      if(row.dataset.standingRank!==undefined)decorateStanding(row,Number(row.dataset.standingRank));
    }
    const selected=window.faCompetitionContext?.definition,host=document.querySelector('.app-standings-legend'),list=host?.querySelector?.('ul');
    if(!selected||!list||!window.faCompetitionRulesView)return;
    const phase=selected.rules.phases.find(p=>p.rankOutcomes),outcomes=phase.rankOutcomes.filter(outcome=>window.faCompetitionRules.outcomeStyle(outcome.kind));
    host.hidden=!outcomes.length;
    const international=selected.category==='domestic'&&selected.tier===1?[{from:1,to:1,kind:'champion',internationalCup:'sovereign'},{from:2,to:3,kind:'sovereign'},{from:4,to:6,kind:'federation'}]:[];
    const visibleOutcomes=outcomes.filter(o=>!international.some(q=>o.from>=q.from&&o.to<=q.to));
    list.replaceChildren(...[...international,...visibleOutcomes].map(outcome=>{
      const style=outcome.kind==='sovereign'||outcome.kind==='federation'?outcome.kind:window.faCompetitionRules.outcomeStyle(outcome.kind),li=document.createElement('li');li.dataset.standingOutcome=style;
      const swatch=document.createElement('span');swatch.className='app-standings-legend-swatch';swatch.setAttribute('aria-hidden','true');
      const label=document.createElement('span');label.id='standings-outcome-'+style;
      const range=document.createElement('strong');range.textContent=outcome.from===outcome.to?String(outcome.from):outcome.from+'–'+outcome.to;
      const separator=document.createElement('span');separator.textContent=' · ';
      const text=document.createElement('span');if(!international.includes(outcome))text.dataset.competitionOutcome=outcome.kind;if(outcome.targetPhaseId)text.dataset.competitionTarget=outcome.targetPhaseId;
      text.textContent=outcome.internationalCup==='sovereign'?'Champion · Sovereign Cup':outcome.kind==='sovereign'?'Sovereign Cup qualification':outcome.kind==='federation'?'Federation Cup qualification':window.faCompetitionRulesView.outcomeLabel(selected,outcome,document.documentElement.lang);
      label.append(range,separator,text);li.append(swatch,label);return li;
    }));
  }

  function bindPostseasonTips() {
    let active=null,wasOpen=false,leaveTimer;
    const releases=[],tips=[];
    const listen=(target,type,callback,options)=>{target.addEventListener(type,callback,options);releases.push(()=>target.removeEventListener?.(type,callback,options))};
    function close(blur=false) {
      clearTimeout(leaveTimer);
      if(!active)return;
      const previous=active;active=null;previous.tip.hidden=true;
      if(blur&&document.activeElement===previous.button)previous.button.blur();
    }
    for(const button of document.querySelectorAll("[data-postseason-help]")) {
      const tip=document.getElementById(button.dataset.postseasonHelp);
      if(!tip)continue;
      document.body.appendChild(tip);tips.push(tip);
      function open() {
        clearTimeout(leaveTimer);
        if(active?.button!==button)close();
        tip.hidden=false;active={button,tip,open};
        const box=button.getBoundingClientRect(),width=tip.offsetWidth||120,height=tip.offsetHeight||34;
        const viewportWidth=window.innerWidth||390,viewportHeight=window.innerHeight||700;
        tip.style.left=Math.max(12,Math.min(box.left+box.width/2-width/2,viewportWidth-width-12))+"px";
        const above=box.top-height-8;
        tip.style.top=Math.max(8,Math.min(above>=8?above:box.bottom+8,viewportHeight-height-8))+"px";
      }
      listen(button,"pointerenter",event=>{if(event.pointerType==="mouse"||event.pointerType==="pen")open()});
      const leave=()=>{if(document.activeElement!==button)leaveTimer=setTimeout(()=>close(),160)};
      listen(button,"pointerleave",leave);
      listen(tip,"pointerenter",open);
      listen(tip,"pointerleave",leave);
      listen(button,"focus",open);
      listen(button,"blur",()=>{if(active?.button===button)close()});
      listen(button,"pointerdown",()=>{wasOpen=active?.button===button});
      listen(button,"click",()=>{if(wasOpen)close(true);else{button.focus();open()}wasOpen=false});
    }
    listen(document,"keydown",event=>{if(event.key==="Escape"&&active){close();event.preventDefault();event.stopPropagation()}});
    listen(document,"pointerdown",event=>{if(active&&event.target!==active.button&&!active.button.contains?.(event.target)&&!active.tip.contains(event.target))close(true)});
    listen(window,"resize",()=>close());
    listen(window,"scroll",()=>{if(active&&document.activeElement===active.button)active.open();else close()},{capture:true,passive:true});
    close.destroy=()=>{close();for(const release of releases)release();for(const tip of tips)tip.remove?.()};
    return close;
  }

  function createPostseason(division,definition=window.faCompetitionContext?.definition) {
    const releases=[];
    const rules=window.faCompetitionRules,league=definition.rules.phases.find(p=>p.rankOutcomes);
    const roundCount=definition.metrics.phases[league.id].rounds;
    const initialPhase=definition.rules.phases.find(p=>p.type==='knockout');
    const isPlayout=initialPhase.labelKey==='playout',finalPhase=initialPhase.ties.find(t=>t.legs===1);
    const bracket=document.getElementById("app-postseason-bracket");
    if(!bracket)return;
    mountedPostseasonGraph=JSON.stringify(definition.rules.phases.filter(p=>p.type==='knockout'));
    const slots=[...document.querySelectorAll("[data-postseason-position]")];
    const scores=[...document.querySelectorAll("[data-postseason-score]")];
    const finalists=[...document.querySelectorAll("[data-postseason-finalist]")];
    const matchRows=[...document.querySelectorAll("[data-postseason-row]")];
    const resolutions=[...document.querySelectorAll("[data-postseason-resolution]")];
    const winner=document.getElementById("app-postseason-winner");
    // Align playout connector and winner to the actual boundary between team rows.
    // Text notes below the teams must not affect either position.
    if(isPlayout){
      const left=bracket.querySelector?.(".app-knockout-left");
      const result=bracket.querySelector?.(".app-knockout-result");
      const teamRows=left?.querySelectorAll(".app-knockout-team-row");
      if(left&&result&&teamRows?.length===2){
        const align=()=>{
          const first=teamRows[0].getBoundingClientRect();
          const second=teamRows[1].getBoundingClientRect();
          const origin=left.getBoundingClientRect();
          const axis=(first.bottom+second.top)/2-origin.top;
          left.style.setProperty("--playout-axis",axis+"px");
          const resultOrigin=result.getBoundingClientRect();
          const box=result.querySelector(".app-postseason-group");
          if(box&&window.matchMedia("(min-width:1001px)").matches){
            const currentMargin=parseFloat(window.getComputedStyle(result).marginTop)||0;
            result.style.marginTop=(currentMargin+origin.top+axis-resultOrigin.top-box.offsetHeight/2)+"px";
          }else result.style.removeProperty("margin-top");
        };
        const observer=typeof ResizeObserver==="function"?new ResizeObserver(align):null;
        observer?.observe(left.querySelector(".app-postseason-group")||left);
        observer?.observe(result.querySelector(".app-postseason-group")||result);
        window.addEventListener("resize",align);
        releases.push(()=>{observer?.disconnect();window.removeEventListener?.('resize',align)});
        if(typeof requestAnimationFrame==="function")requestAnimationFrame(align);
      }
    }
    // Playoff lines are anchored to the midpoint between team rows, not card height.
    // Do not move either semifinal, final, or winner box.
    if(finalPhase){
      const semifinals=bracket.querySelectorAll?.(".app-knockout-left,.app-knockout-right")||[];
      for(const semifinal of semifinals){
        const teamRows=semifinal.querySelectorAll(".app-knockout-team-row");
        if(teamRows.length!==2)continue;
        const alignLine=()=>{
          const first=teamRows[0].getBoundingClientRect();
          const second=teamRows[1].getBoundingClientRect();
          const origin=semifinal.getBoundingClientRect();
          semifinal.style.setProperty("--playoff-connector-axis",((first.bottom+second.top)/2-origin.top)+"px");
        };
        const observer=typeof ResizeObserver==="function"?new ResizeObserver(alignLine):null;
        observer?.observe(semifinal.querySelector(".app-postseason-group")||semifinal);
        window.addEventListener("resize",alignLine);
        releases.push(()=>{observer?.disconnect();window.removeEventListener?.('resize',alignLine)});
        if(typeof requestAnimationFrame==="function")requestAnimationFrame(alignLine);
      }
    }
    const clubs=new Map(division.clubs.map(club=>[club.clubId,club]));
    const closeTips=bindPostseasonTips();
    let current={rows:null,results:null};
    const tieId=id=>id.replace(/^postseason-/,"");
    function word(key,text) {
      const node=document.createElement("span");node.dataset.appI18n=key;node.textContent=text;return node;
    }
    function clubContent(slot,club,key,label) {
      if(club){
        const id=club.countryId+"-"+club.clubId;
        const existing=slot.querySelector?.("[data-club-crest]");
        if(existing?.dataset.clubCrest===id){
          const name=existing.nextElementSibling;
          if(name&&name.textContent!==club.primaryName)name.textContent=club.primaryName;
          return;
        }
        const name=document.createElement("a");name.className="app-world-standing-club-link";name.href=window.faRoutesRegistry.buildRoute({kind:"club",country:club.countryId.toLowerCase(),id:club.clubId,view:"overview"});name.textContent=club.primaryName;
        slot.replaceChildren(createCrestHost(id),name);
      }
      else slot.replaceChildren(word(key,label));
    }
    function render(rows,results) {
      closeTips();current={rows,results};
      const qualified=rows!==null&&rows.every(row=>row.played===roundCount);
      bracket.dataset.postseasonQualified=String(qualified);
      const ties=new Map((results?.ties||[]).map(tie=>[tie.id,tie]));
      for(const slot of slots) {
        const position=Number(slot.dataset.postseasonPosition);
        if(qualified)clubContent(slot,rows[position-1].club);
        else {const rank=document.createElement("strong");rank.textContent=String(position);slot.replaceChildren(word("postseasonPosition","League position"),rank)}
      }
      for(const slot of finalists) {
        const home=slot.dataset.postseasonFinalist==="home";
        const club=results?.final?clubs.get(results.final[home?"homeId":"awayId"]):null;
        clubContent(slot,club,home?"postseasonFinalHome":"postseasonFinalAway",home?"Better-ranked finalist":"Other finalist");
      }
      for(const score of scores) {
        const [raw,side,metric]=score.dataset.postseasonScore.split(":"),id=tieId(raw);
        let value=null;
        if(id==="final")value=results?.final?.[side==="home"?"homeGoals":"awayGoals"];
        else if(qualified) {
          const tie=ties.get(id),clubId=rows[Number(side)-1].club.clubId;
          if(metric==="aggregate")value=tie?.aggregate?.[tie.clubIds.indexOf(clubId)];
          else {const game=tie?.legs[metric==="first"?0:1];if(game)value=game.homeId===clubId?game.homeGoals:game.awayGoals}
        }
        score.textContent=value==null?"—":String(value);
      }
      for(const row of matchRows) {
        const [raw,side]=row.dataset.postseasonRow.split(":"),id=tieId(raw);
        const clubId=id==="final"?results?.final?.[side+"Id"]:qualified?rows[Number(side)-1].club.clubId:null;
        const winningId=id==="final"?results?.final?.winnerId:ties.get(id)?.winnerId;
        row.dataset.postseasonWinner=String(Boolean(clubId&&clubId===winningId));
      }
      for(const note of resolutions) {
        const id=tieId(note.dataset.postseasonResolution);
        const game=id==="final"?results?.final:ties.get(id)?.legs[1];
        note.replaceChildren();note.hidden=!game?.afterExtraTime;
        if(game?.penalties){const score=document.createElement("strong");score.textContent=game.penalties.homeGoals+"–"+game.penalties.awayGoals;note.append(word("postseasonPenalties","Penalties"),score)}
        else if(game?.afterExtraTime)note.append(word("postseasonExtraTime","After extra time"));
      }
      if(winner){
        winner.replaceChildren();winner.textContent="—";
        if(results?.winnerId)clubContent(winner,clubs.get(results.winnerId));
      }
      window.faAppRenderLanguage?.();
    }
    function validateResults(input,rows) {
      if(input==null)return null;
      const data=JSON.parse(JSON.stringify(input));
      const invalid=()=>{throw Error("Invalid postseason results")};
      const count=value=>Number.isInteger(value)&&value>=0&&value<=30;
      if(!rows||data.divisionId!==division.id||!Number.isInteger(data.season)||data.season<1||data.season>4||
         !Number.isInteger(data.matchday)||data.matchday<0||data.matchday>33||!Array.isArray(data.ties))invalid();
      const qualified=rows.every(row=>row.played===roundCount);
      if(qualified!==(data.matchday>=roundCount))invalid();
      function game(g,home,away,played) {
        if(!g||g.homeId!==home||g.awayId!==away||typeof g.afterExtraTime!=="boolean")invalid();
        if(!played){if(g.homeGoals!==null||g.awayGoals!==null||g.penalties!==null||g.afterExtraTime)invalid();return}
        if(!count(g.homeGoals)||!count(g.awayGoals))invalid();
        if(g.penalties!==null){const p=g.penalties;if(!g.afterExtraTime||!p||p.homeId!==home||p.awayId!==away||!count(p.homeGoals)||!count(p.awayGoals)||p.homeGoals===p.awayGoals)invalid()}
      }
      function winning(ids,totals,g) {
        if(totals[0]!==totals[1]){if(g.penalties)invalid();return totals[0]>totals[1]?ids[0]:ids[1]}
        if(!g.penalties||!g.afterExtraTime)invalid();
        return g.penalties.homeGoals>g.penalties.awayGoals?g.homeId:g.awayId;
      }
      const legacyTieId=id=>({semi36:'semi-one',semi45:'semi-two'}[id]||id);
      const expected=qualified?initialPhase.ties.filter(t=>t.participants.every(ref=>ref.rank)).map(t=>[legacyTieId(t.id),...t.participants.map(ref=>ref.rank).sort((a,b)=>a-b)]):[];
      if(data.ties.length!==expected.length)invalid();
      data.ties.forEach((tie,index)=>{
        const [id,better,lower]=expected[index],ids=[rows[better-1].club.clubId,rows[lower-1].club.clubId];
        if(tie.id!==id||JSON.stringify(tie.seedPositions)!==JSON.stringify([better,lower])||JSON.stringify(tie.clubIds)!==JSON.stringify(ids)||!Array.isArray(tie.legs)||tie.legs.length!==2)invalid();
        for(let leg=0;leg<2;leg++){
          const played=data.matchday>=31+leg,g=tie.legs[leg];
          if(!played){if(g!==null)invalid()}
          else {game(g,leg===0?ids[1]:ids[0],leg===0?ids[0]:ids[1],true);if(leg===0&&(g.afterExtraTime||g.penalties))invalid()}
        }
        const totals=data.matchday>=31?ids.map(id=>tie.legs.filter(Boolean).reduce((sum,g)=>sum+(g.homeId===id?g.homeGoals:g.awayGoals),0)):null;
        if(JSON.stringify(tie.aggregate)!==JSON.stringify(totals))invalid();
        const win=data.matchday>=32?winning(ids,totals,tie.legs[1]):null;
        if(tie.winnerId!==win)invalid();
      });
      if(finalPhase&&data.matchday>=32){
        const ids=data.ties.map(t=>t.winnerId).sort((a,b)=>rows.findIndex(r=>r.club.clubId===a)-rows.findIndex(r=>r.club.clubId===b));
        game(data.final,ids[0],ids[1],data.matchday>=33);
        const win=data.matchday>=33?winning(ids,[data.final.homeGoals,data.final.awayGoals],data.final):null;
        if(data.final.winnerId!==win||data.winnerId!==win)invalid();
      }else if(data.final!==null||data.winnerId!==(isPlayout?data.ties[0]?.winnerId??null:null))invalid();
      return data;
    }
    window.faPostseason=Object.freeze({
      prepare(rows,results=null,applicable=window.faCompetitionContext?.definition) {
        if(applicable&&JSON.stringify(applicable.rules.phases.filter(p=>p.type==='knockout'))!==mountedPostseasonGraph){
          replacePostseason(applicable);return window.faPostseason.prepare(rows,results,applicable);
        }
        if(rows===null){if(results!==null)throw Error("Invalid postseason standings");return()=>render(null,null)}
        if(!Array.isArray(rows)||rows.length!==definition.capacity)throw Error("Invalid postseason standings");
        const seen=new Set();
        const next=rows.map(row=>{
          const club=clubs.get(row?.club?.clubId);
          if(!club||row.club.countryId!==division.countryId||seen.has(club.clubId)||!Number.isInteger(row.played)||row.played<0||row.played>roundCount)throw Error("Invalid postseason participant");
          seen.add(club.clubId);return{club,played:row.played};
        });
        const prepared=validateResults(results,next);
        return()=>render(next,prepared);
      },
      snapshot(){const previous=current;return()=>render(previous.rows,previous.results)},
      destroy(){closeTips.destroy();for(const release of releases)release();}
    });
    render(null,null);
  }
  function replacePostseason(selected){
    const panel=document.getElementById('competition-panel-postseason');
    if(!panel||!window.faCompetitionRulesView?.renderPostseason)throw Error('Unavailable knockout presentation');
    window.faPostseason?.destroy?.();window.faPostseasonTips?.destroy?.();
    panel.innerHTML=window.faCompetitionRulesView.renderPostseason(selected);
    if(selected.category==='domestic')createPostseason(division,selected);else window.faPostseasonTips=bindPostseasonTips();
    mountedPostseasonGraph=JSON.stringify(selected.rules.phases.filter(p=>p.type==='knockout'));
  }

  // Both presentations receive the same validated row model, never parsed table text.
  function createMobileStandings() {
    const list = document.getElementById("app-standings-compact-list");
    const compact = document.getElementById("app-standings-compact");
    const full = document.getElementById("app-standings-full");
    if (![list,compact,full].every(Boolean))
      throw Error("Incomplete mobile standings layout");
    const fields = [
      ["played","standingsPlayed","P"],["won","standingsWon","W"],
      ["drawn","standingsDrawn","D"],["lost","standingsLost","L"],
      ["gf","standingsFor","GF"],["ga","standingsAgainst","GA"],
      ["gd","standingsDifference","GD"],["pts","standingsPoints","Pts"]
    ];
    const formKeys = {W:"standingsDemoFormWin",D:"standingsDemoFormDraw",L:"standingsDemoFormLoss"};
    const formLetterKeys = {W:"standingsDemoWinLetter",D:"standingsDemoDrawLetter",L:"standingsDemoLossLetter"};
    const element = (tag, cls = "", value = "") => {
      const el = document.createElement(tag);
      el.className = cls;
      el.textContent = String(value);
      return el;
    };
    const translation = (key, fallback, cls = "sr-only") => {
      const el = element("span",cls,fallback);
      el.dataset.appI18n = key;
      return el;
    };
    const breakpoint = window.matchMedia?.("(max-width: 620px)");
    function updateVisibility() {
      const mobile = breakpoint ? breakpoint.matches : window.innerWidth <= 620;
      compact.hidden = !mobile;
      full.hidden = mobile;
    }
    if (breakpoint?.addEventListener) breakpoint.addEventListener("change", updateVisibility);
    window.addEventListener("resize", updateVisibility);
    function prepare(rows) {
      if (!Array.isArray(rows) || rows.length !== definition.capacity)
        throw Error("Incomplete mobile standings model");
      const identities = new Set();
      const clubs = new Map(rows.map(row => [definition.category==='international'?window.faCompetitionRules.clubKey(row.club):row.club?.clubId,row.club]));
      const items = rows.map((row,index) => {
        const club = row.club;
        const id = club?.countryId + "-" + club?.clubId;
        if (!club || !(club.primaryName || club.abbr) || !Number.isInteger(club.clubId) ||
            identities.has(id) || !club.countryId || !Array.isArray(row.recent) ||
            row.recent.length > Math.min(5,row.played))
          throw Error("Invalid mobile standings identity or form");
        identities.add(id);
        const li = element("li","app-world-mobile-item");
        li.dataset.worldClub = id;
        decorateStanding(li, row.position ?? (row.played == null ? null : index + 1));
        const details = element("details","app-world-mobile-details");
        const summary = element("summary","app-world-mobile-summary");
        const pos = element("span","app-world-mobile-position",
          row.position == null ? (row.played == null ? "—" : String(index + 1)) :
            String(row.position));
        const name = element("span","app-world-mobile-name");
        const crest = createCrestHost(id);
        const clubLink = element("a","app-world-standing-club-link app-world-mobile-club-name",club.primaryName || club.abbr);
        clubLink.href = window.faRoutesRegistry.buildRoute({kind:"club",country:club.countryId.toLowerCase(),id:club.clubId,view:"overview"});
        clubLink.addEventListener("click",event=>event.stopPropagation());
        clubLink.addEventListener("keydown",event=>event.stopPropagation());
        name.append(crest,clubLink);
        const points = element("span","app-world-mobile-points",
          row.pts == null ? "—" : String(row.pts));
        const form = element("span","app-world-mobile-form");
        form.appendChild(translation("standingsMobileRecent","Recent form"));
        if (!row.recent.length) {
          form.appendChild(element("span","app-world-mobile-no-form","—"));
        } else {
          for (const game of row.recent) {
            if (!Object.hasOwn(formKeys,game.result) ||
                !Number.isInteger(game.round) || !clubs.has(game.homeId) ||
                !clubs.has(game.awayId)) throw Error("Invalid mobile fixture metadata");
            const mark = element("span","app-world-form-dot app-world-form-" +
              game.result.toLowerCase() + (row.recent.indexOf(game) === 0 ? " app-world-form-last" : ""),game.result);
            mark.dataset.appI18n = formLetterKeys[game.result];
            mark.setAttribute("aria-hidden","true");
            form.append(mark,translation(formKeys[game.result],
              game.result === "W" ? "Win" : game.result === "D" ? "Draw" : "Loss"));
          }
        }
        const ptsLabel = translation("standingsPoints","Pts ");
        points.appendChild(ptsLabel);
        summary.append(pos,name,points,form,
          translation("standingsMobileDetails","Club statistics"));
        const stats = element("dl","app-world-mobile-stats");
        for (const [field,key,fallback] of fields) {
          const item = element("div","app-world-mobile-stat");
          const label = element("dt","",fallback);
          label.dataset.appI18n = key;
          const value = row[field];
          if (value != null && (!Number.isInteger(value) || (field !== "gd" && value < 0)))
            throw Error("Invalid mobile standings statistic");
          const formatted = value == null ? "—" :
            field === "gd" && value > 0 ? "+"+value : String(value);
          item.append(label,element("dd","",formatted));
          stats.appendChild(item);
        }
        const panel = element("div","app-world-mobile-panel");
        panel.appendChild(stats);
        details.append(summary,panel);
        li.appendChild(details);
        return li;
      });
      if (identities.size !== definition.capacity) throw Error("Invalid mobile standings size");
      return (incremental=false) => {
        if(incremental && list.children.length===items.length){
          // Reuse club cards, expanded details and crest hosts across DEV progress changes.
          const existing=new Map([...list.children].map(item=>[item.dataset.worldClub,item]));
          const sync=(target,source)=>{
            if(target.nodeType!==source.nodeType||target.nodeName!==source.nodeName){
              target.replaceWith(source);return source;
            }
            if(target.nodeType===Node.TEXT_NODE){if(target.nodeValue!==source.nodeValue)target.nodeValue=source.nodeValue;return target}
            if(target.nodeType!==Node.ELEMENT_NODE)return target;
            for(const attr of [...target.attributes])if(!source.hasAttribute(attr.name)&&attr.name!=="open")target.removeAttribute(attr.name);
            for(const attr of [...source.attributes])if(target.getAttribute(attr.name)!==attr.value)target.setAttribute(attr.name,attr.value);
            const oldChildren=[...target.childNodes],newChildren=[...source.childNodes];
            for(let i=0;i<newChildren.length;i++){
              if(i>=oldChildren.length)target.append(newChildren[i]);
              else sync(oldChildren[i],newChildren[i]);
            }
            while(target.childNodes.length>newChildren.length)target.lastChild.remove();
            return target;
          };
          for(const item of items){
            const current=existing.get(item.dataset.worldClub);
            if(!current)throw Error("Missing mobile standings identity");
            sync(current,item);
            list.appendChild(current);
          }
        }else list.replaceChildren(...items);
        updateVisibility();
        window.faAppRenderLanguage?.();
      };
    }
    updateVisibility();
    return Object.freeze({prepare});
  }

  function createStandingsRow(club, sample = null, position = null) {
    const tr = document.createElement("tr");
    tr.dataset.worldClub = club.countryId + "-" + club.clubId;
    decorateStanding(tr, sample ? position : null);
    const unknown = () => {
      const td = document.createElement("td");
      td.className = "app-world-stat-unknown";
      td.textContent = "—";
      return td;
    };
    const stat = value => {
      const td = document.createElement("td");
      td.className = "app-world-stat-value";
      td.textContent = String(value);
      return td;
    };
    tr.appendChild(sample ? stat(position) : unknown());
    const th = document.createElement("th");
    th.scope = "row";
    th.className = "app-world-standing-club";
    const identity = document.createElement("span");
    identity.className = "app-world-club-identity";
    const crest = createCrestHost(tr.dataset.worldClub);
    const name = document.createElement("a");
    name.className = "app-world-club-name app-world-standing-club-link";
    name.href = window.faRoutesRegistry.buildRoute({kind:"club",country:club.countryId.toLowerCase(),id:club.clubId,view:"overview"});
    name.textContent = club.primaryName || club.abbr;
    identity.append(crest, name);
    th.appendChild(identity);
    tr.appendChild(th);
    if (sample) {
      const [id,w,d,l,gf,ga,form] = sample;
      const diff = gf - ga;
      const values = [15,w,d,l,gf,ga,diff > 0 ? "+" + diff : diff,3*w+d];
      values.forEach(value => tr.appendChild(stat(value)));
      const formCell = document.createElement("td");
      const strip = document.createElement("span");
      strip.className = "app-world-form-strip";
      // Latest result is displayed first (left); keep sample records unchanged.
      for (let i = form.length - 1; i >= 0; i--) {
        const result = form[i];
        const isLatest = i === form.length - 1;
        const [ariaKey,english,letterKey] = formLabels[result];
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "app-world-form-dot app-world-form-" + result.toLowerCase() +
          (isLatest ? " app-world-form-last" : "");
        dot.dataset.appAria = isLatest ? ariaKey + "Latest" : ariaKey;
        dot.dataset.appI18n = letterKey;
        dot.setAttribute("aria-label",isLatest ? english + " — latest match" : english);
        dot.textContent = result;
        demoFormTriggers.push({button:dot,club,result,round:11+i});
        strip.appendChild(dot);
      }
      formCell.appendChild(strip);
      tr.appendChild(formCell);
    } else {
      for (let i = 0; i < 9; i++) tr.appendChild(unknown());
    }
    return tr;
  }

  function bindSuppliedPanels(mobile){
    const tbody=document.getElementById('app-standings-body'),rules=window.faCompetitionRules;
    let slots,scores,initialSlots,bracketEmpty,initialHomeLabels;
    const capture=()=>{
      slots=[...document.querySelectorAll('[data-postseason-config-slot]')];scores=[...document.querySelectorAll('[data-postseason-score]')];initialSlots=slots.map(slot=>slot.innerHTML);
      bracketEmpty=document.querySelector('[data-configured-knockout-empty]');
      initialHomeLabels=slots.map(slot=>{const label=slot.parentElement?.querySelector('.app-knockout-home');return label?{label,key:label.dataset.appI18n,text:label.textContent}:null});
    };capture();
    let graph=JSON.stringify(definition.rules.phases.filter(p=>p.type==='knockout'));
    let suppliedOwned=false;
    const empty=()=>{
      if(definition.category==='domestic'){
        const rows=division.clubs.map(club=>({club,played:null,won:null,drawn:null,lost:null,gf:null,ga:null,gd:null,pts:null,recent:[]}));
        tbody.replaceChildren(...division.clubs.map(club=>createStandingsRow(club)));mobile.prepare(rows)();window.faPostseason?.prepare(null)();suppliedOwned=false;return;
      }
      const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=11;
      cell.className='app-competition-empty-row';cell.dataset.appI18n='competitionStandingsEmpty';cell.textContent='No standings available yet.';row.appendChild(cell);tbody.replaceChildren(row);
      document.getElementById('app-standings-compact-list')?.replaceChildren();
    };
    const resetBracket=()=>{slots.forEach((slot,i)=>{slot.innerHTML=initialSlots[i]});for(const home of initialHomeLabels)if(home){home.label.dataset.appI18n=home.key;home.label.textContent=home.text}if(definition.category==='international')scores.forEach(score=>score.textContent='—');if(bracketEmpty)bracketEmpty.hidden=false};
    function refresh(){
      const context=window.faCompetitionContext;if(!context)return;
      const definition=context.definition,league=definition.rules.phases.find(p=>p.rankOutcomes),roundCount=definition.metrics.phases[league.id].rounds;
      const nextGraph=JSON.stringify(definition.rules.phases.filter(p=>p.type==='knockout'));
      const panel=document.getElementById('competition-panel-postseason');
      if(nextGraph!==graph&&panel&&window.faCompetitionRulesView?.renderPostseason){
        if(nextGraph!==mountedPostseasonGraph)replacePostseason(definition);
        graph=nextGraph;capture();
      }
      const data=context.seasonData;
      if(definition.category==='domestic'&&!data?.statistics?.standings){if(suppliedOwned)empty();return;}
      if(!data){empty();resetBracket();return;}
      try{
        const clubs=new Map(data.participants.map(club=>[rules.clubKey(club),club]));
        if(clubs.size!==definition.capacity||[...clubs.values()].some(club=>typeof club.primaryName!=='string'||!club.primaryName.trim()))throw Error('Invalid supplied participants');
        const supplied=data.statistics?.standings;
        if(supplied!==undefined&&(!Array.isArray(supplied)||supplied.length!==definition.capacity))throw Error('Incomplete supplied standings');
        const seen=new Set();
        const rows=supplied?supplied.map((row,index)=>{
          const id=rules.clubKey(row.club),club=clubs.get(id);
          if(!club||seen.has(id))throw Error('Invalid supplied standings identity');seen.add(id);
          for(const field of ['played','won','drawn','lost','gf','ga','gd','pts'])if(!Number.isSafeInteger(row[field])||(field!=='gd'&&row[field]<0))throw Error('Invalid supplied statistic');
          if(row.played>roundCount||row.won+row.drawn+row.lost!==row.played||row.gd!==row.gf-row.ga)throw Error('Invalid supplied totals');
          return {...row,club,position:index+1,recent:row.recent||[]};
        }):data.participants.map(club=>({club,played:null,won:null,drawn:null,lost:null,gf:null,ga:null,gd:null,pts:null,recent:[]}));
        const commitMobile=mobile.prepare(rows);
        const desktop=rows.map((row,index)=>{
          const tr=createStandingsRow(row.club);decorateStanding(tr,supplied?index+1:null);
          if(supplied){const values=[index+1,null,...['played','won','drawn','lost','gf','ga','gd','pts'].map(k=>row[k])];values.forEach((value,i)=>{if(i!==1)tr.children[i].textContent=String(value)})}
          return tr;
        });
        // Resolving a referenced winner requires a complete original table and an explicit completed tie.
        const qualified=Boolean(supplied&&rows.every(row=>row.played===roundCount));
        const completed=(data.results||[]).filter(result=>result?.tieId||result?.id);
        const resolved=new Map();
        if(qualified)for(const phase of definition.rules.phases.filter(p=>p.type==='knockout'))for(const tie of phase.ties)resolved.set(tie.id,rules.tieParticipants(definition,tie.id,rows,completed));
        const seenTies=new Set();
        for(const result of completed){
          const id=result.id||result.tieId,tie=definition.rules.phases.flatMap(p=>p.ties||[]).find(t=>t.id===id),clubs=resolved.get(id);
          if(!tie||seenTies.has(id)||!clubs||result.winnerId!=null&&!clubs.some(club=>rules.clubKey(club)===result.winnerId))throw Error('Invalid supplied tie winner');seenTies.add(id);
          if(result.legs!==undefined){
            if(!Array.isArray(result.legs)||result.legs.length>tie.legs)throw Error('Invalid supplied tie legs');
            const order=rules.homeOrder(definition,id,clubs,rows);
            result.legs.forEach((game,index)=>{
              if(game===null)return;
              const pair=index===1?[...order].reverse():order;
              if(pair.some(club=>!club)||game.homeId!==rules.clubKey(pair[0])||game.awayId!==rules.clubKey(pair[1])||!['homeGoals','awayGoals'].every(k=>Number.isSafeInteger(game[k])&&game[k]>=0))throw Error('Invalid supplied tie result');
            });
            if(result.winnerId!=null&&(result.legs.length!==tie.legs||result.legs.some(game=>game===null)))throw Error('Incomplete supplied winning tie');
          }
        }
        const updates=slots.map(slot=>{
          const [id,side]=slot.dataset.postseasonConfigSlot.split(':');return {slot,club:resolved.get(id)?.[Number(side)]||null};
        });
        const commitDomestic=definition.category==='domestic'?window.faPostseason?.prepare(rows):null;
        tbody.replaceChildren(...desktop);commitMobile();commitDomestic?.();suppliedOwned=true;resetBracket();
        if(bracketEmpty)bracketEmpty.hidden=completed.some(t=>t.legs?.some(Boolean));
        for(const {slot,club} of updates)if(club){
          const name=document.createElement('a');name.className='app-world-standing-club-link';name.href=window.faRoutesRegistry.buildRoute({kind:"club",country:club.countryId.toLowerCase(),id:club.clubId,view:"overview"});name.textContent=club.primaryName;
          slot.replaceChildren(createCrestHost(rules.clubKey(club)),name);
          const [id]=slot.dataset.postseasonConfigSlot.split(':'),tie=definition.rules.phases.flatMap(p=>p.ties||[]).find(t=>t.id===id);
          const label=slot.parentElement?.querySelector('.app-knockout-home');
          const order=rules.homeOrder(definition,id,resolved.get(id),rows);
          if(label){label.dataset.appI18n=tie.homePolicy==='neutral'?'postseasonNeutralVenue':order.some(c=>!c)?'postseasonHigherReturn':tie.legs===1?'postseasonHomeSingle':rules.clubKey(order[1])===rules.clubKey(club)?'postseasonHomeReturn':'postseasonHomeFirst';}
        }
        for(const score of definition.category==='international'?scores:[]){
          const [id,side,metric]=score.dataset.postseasonScore.split(':'),club=resolved.get(id)?.[Number(side)];
          const result=completed.find(item=>(item.id||item.tieId)===id);
          if(!club||!Array.isArray(result?.legs))continue;
          const games=result.legs.filter(Boolean);
          if(games.some(game=>!['homeGoals','awayGoals'].every(k=>Number.isSafeInteger(game[k])&&game[k]>=0)||![game.homeId,game.awayId].includes(rules.clubKey(club))))continue;
          const goals=game=>game.homeId===rules.clubKey(club)?game.homeGoals:game.awayGoals;
          const game=result.legs[metric==='second'?1:0];
          const value=metric==='aggregate'?games.length?games.reduce((sum,g)=>sum+goals(g),0):null:game?goals(game):null;
          score.textContent=value===null?'—':String(value);
        }
      }catch{empty();resetBracket();}
      window.faAppRenderLanguage?.();
    }
    window.addEventListener('fa:competition-context-change',refresh);refresh();
  }

  // Form tooltips are regression-tested against isolated Node fixtures.
  // A fixed, document-level tooltip stays visible above both nested scroll regions.
  function attachFormTooltips(clubs) {
    if (!demoFormTriggers.length) return;
    const tooltip = document.createElement("div");
    tooltip.id = "app-world-form-tooltip";
    tooltip.className = "app-world-form-tooltip";
    tooltip.setAttribute("role","tooltip");
    tooltip.hidden = true;
    const item = (tag,cls,value,key) => {
      const el = document.createElement(tag);
      el.className = cls;
      el.textContent = value;
      if (key) el.dataset.appI18n = key;
      return el;
    };
    const header = item("div","app-world-form-tooltip-meta","");
    const round = item("span","app-world-form-tooltip-round","");
    const roundLabel = item("span","","Matchday","standingsTooltipRound");
    const number = item("strong","","");
    round.append(roundLabel,number);
    header.appendChild(round);
    const match = item("div","app-world-form-tooltip-scoreline","");
    const homeName = item("span","app-world-form-tooltip-team","");
    const score = item("strong","app-world-form-tooltip-score","");
    const awayName = item("span","app-world-form-tooltip-team","");
    match.append(homeName,score,awayName);
    const footer = item("div","app-world-form-tooltip-context","");
    const home = item("span","","Home","standingsTooltipHome");
    const away = item("span","","Away","standingsTooltipAway");
    footer.append(home,away);
    tooltip.append(header,match,footer);
    document.body.appendChild(tooltip);
    const opponents = [...clubs.values()];
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    let active = null, wasOpenOnPress = false;
    tooltip.addEventListener("animationend",event => {
      if (event.target === tooltip && event.animationName === "app-world-tooltip-out" && !active) {
        tooltip.hidden = true;
        tooltip.className = "app-world-form-tooltip";
      }
    });
    function close() {
      if (active) active.removeAttribute("aria-describedby");
      active = null;
      tooltip.setAttribute("aria-hidden","true");
      if (tooltip.hidden || reduceMotion) {
        tooltip.hidden = true;
        tooltip.className = "app-world-form-tooltip";
      } else {
        tooltip.className = "app-world-form-tooltip is-closing";
      }
    }
    function place() {
      if (!active || tooltip.hidden) return;
      const rect = active.getBoundingClientRect();
      const width = window.innerWidth, height = window.innerHeight;
      // Measure the shared, responsive topbar on every reposition. A tooltip
      // must never cross its lower edge, including while the page scrolls.
      const topbarBottom = Math.max(0,document.querySelector(".fa-shell-topbar")
        ?.getBoundingClientRect().bottom ?? 0);
      const topLimit = Math.max(8,topbarBottom+8), bottomLimit = height-8;
      const w = tooltip.offsetWidth || 300, h = tooltip.offsetHeight || 124;
      if (rect.bottom <= topbarBottom || rect.top >= height || rect.right <= 0 ||
          rect.left >= width || bottomLimit-topLimit < h) {
        close();
        return;
      }
      const left = Math.max(8,Math.min(rect.left + rect.width / 2 - w / 2,width-w-8));
      const above = rect.top-h-8;
      const below = rect.bottom+8;
      // Prefer a fully clear side; if neither fits, constrain the tooltip
      // within the usable content viewport without covering the topbar.
      const top = above >= topLimit ? above :
        below+h <= bottomLimit ? below :
        (rect.top-topLimit >= bottomLimit-rect.bottom ? topLimit : bottomLimit-h);
      tooltip.style.left = Math.round(left)+"px";
      tooltip.style.top = Math.round(Math.max(topLimit,Math.min(top,bottomLimit-h)))+"px";
    }
    function open(entry) {
      if (active && active !== entry.button) active.removeAttribute("aria-describedby");
      const others = opponents.filter(c => c.clubId !== entry.club.clubId);
      const opponent = others[(entry.club.clubId + entry.round*3) % others.length];
      const isHome = (entry.club.clubId + entry.round) % 2 === 0;
      const own = entry.result === "W" ? 2 : entry.result === "D" ? 1 : 0;
      const against = entry.result === "W" ? 1 : entry.result === "D" ? 1 : 2;
      homeName.textContent = (isHome ? entry.club : opponent).primaryName;
      awayName.textContent = (isHome ? opponent : entry.club).primaryName;
      score.textContent = (isHome ? own : against)+" – "+(isHome ? against : own);
      number.textContent = String(entry.round);
      home.hidden = !isHome;
      away.hidden = isHome;
      active = entry.button;
      active.setAttribute("aria-describedby",tooltip.id);
      tooltip.removeAttribute("aria-hidden");
      tooltip.className = "app-world-form-tooltip";
      tooltip.hidden = false;
      place();
    }
    for (const entry of demoFormTriggers) {
      const button = entry.button;
      button.addEventListener("pointerenter",event => {
        if (event.pointerType === "mouse" || event.pointerType === "pen") open(entry);
      });
      button.addEventListener("pointerleave",event => {
        if ((event.pointerType === "mouse" || event.pointerType === "pen") &&
            active === button && document.activeElement !== button) close();
      });
      button.addEventListener("focus",() => open(entry));
      button.addEventListener("blur",() => { if (active === button) close(); });
      button.addEventListener("pointerdown",event => {
        wasOpenOnPress = (event.pointerType === "touch" || event.pointerType === "pen") && active === button;
      });
      button.addEventListener("click",() => {
        if (wasOpenOnPress && active === button) close();
        else open(entry);
        wasOpenOnPress = false;
      });
    }
    document.addEventListener("pointerdown",event => {
      if (active && event.target !== active) close();
    });
    document.addEventListener("keydown",event => {
      if (event.key === "Escape" && active) {
        close();
        event.stopPropagation();
      }
    });
    window.addEventListener("resize",place);
    window.addEventListener("scroll",place,{passive:true});
    document.querySelector(".fa-shell-content-scroll")?.addEventListener("scroll",place,{passive:true});
    document.querySelector(".app-world-standing-scroll")?.addEventListener("scroll",place,{passive:true});
  }
  function loadScript(url,asModule=false) {
    return new Promise((resolve,reject) => {
      const script = document.createElement("script");
      script.src = new URL(url,sourceUrl).href;
      if(asModule)script.type="module";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Missing shared app script"));
      document.head.appendChild(script);
    });
  }
  const freeze=value=>{
    if(value&&typeof value==="object"&&!Object.isFrozen(value)){
      Object.values(value).forEach(freeze);Object.freeze(value);
    }
    return value;
  };
  let definition,division,activeDebugSeason,mountedPostseasonGraph;
  function createContext(definition,selectedSeason,seasonData,revision){
    if(!Number.isSafeInteger(selectedSeason)||selectedSeason<1||!Number.isSafeInteger(revision)||revision<1)
      throw Error("Invalid competition context");
    const applicable=seasonData?model.resolveSeasonDefinition(definition,seasonData):definition;
    if(!applicable)throw Error('Unavailable season rules');
    return freeze(JSON.parse(JSON.stringify({definition:applicable,currentDefinition:definition,selectedSeason,seasonData,revision})));
  }
  function publishCompetitionContext(context){
    window.faCompetitionContext=context;
    window.dispatchEvent(new CustomEvent("fa:competition-context-change",{detail:context}));
  }
  function nextContext(season,data=null){
    const current=window.faCompetitionContext;
    publishCompetitionContext(createContext(definition,season,data,(current?.revision||0)+1));
  }
  function selectSeason(season){
    const current=window.faCompetitionContext;
    if(!Number.isSafeInteger(season)||season<1||!current)return false;
    if(current.selectedSeason!==season)nextContext(season);
    return true;
  }
  function clearSeasonData(){
    if(window.faCompetitionContext)nextContext(window.faCompetitionContext.selectedSeason);
  }
  function setDebugSeason(season){
    if(!Number.isInteger(season)||season<0||season>4)return false;
    if(activeDebugSeason!==season){activeDebugSeason=season;clearSeasonData();}
    if(season===0)selectSeason(1);
    return true;
  }
  function replaceSeasonData(data,expectedRevision){
    const current=window.faCompetitionContext;
    if(!current||current.revision!==expectedRevision||activeDebugSeason===0||!data||
      data.season!==current.selectedSeason||!model.resolveSeasonRules(definition,data)||
      !["unavailable","partial","available"].includes(data.status)||!Array.isArray(data.participants)||
      data.participants.length!==definition.capacity||
      ![data.fixtures,data.results].every(x=>x===null||Array.isArray(x))||
      !(data.statistics===null||data.statistics&&typeof data.statistics==="object"&&!Array.isArray(data.statistics)))return false;
    const ids=new Set();
    for(const club of data.participants){
      if(!club||!model.countries.includes(club.countryId)||!Number.isInteger(club.clubId)||club.clubId<1||club.clubId>40)return false;
      const id=club.countryId+"-"+club.clubId;
      if(ids.has(id)||division&&!division.clubs.some(c=>c.countryId===club.countryId&&c.clubId===club.clubId))return false;
      ids.add(id);
    }
    nextContext(current.selectedSeason,data);return true;
  }
  async function start() {
    if (!sourceUrl || !/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-1|int-2)$/.test(routeId)) throw Error("Invalid route identity");
    const path = window.location.pathname.replace(/\/index\.html$/,"").replace(/\/+$/,"");
    const segments=path.split("/").filter(Boolean);
    const viewSegment=segments[2];
    const allowedViews=new Set(["overview","standings","postseason","fixtures","stats","history","rules","awards","teams"]);
    if(segments.length<2||segments.length>3||segments[0]!=="competitions"||segments[1]!==routeId.toLowerCase()||(viewSegment&&!allowedViews.has(viewSegment)))throw Error("Route identity mismatch");
    const dataResponse=await fetch(new URL("manifest.json",root),{credentials:"same-origin"});
    if(!dataResponse.ok)throw Error("Competition data unavailable");
    const manifest=await dataResponse.json();
    if(!model.validManifest(manifest))throw Error("Invalid or approved competition manifest");
    definition=model.competitionById(manifest,routeId);
    if(!definition)throw Error("Unknown competition");
    division=definition.category==="domestic"?manifest.divisions.find(d=>d.id===routeId):null;
    const legacyId=document.querySelector('meta[name="fa-division"]')?.content;
    if(division?legacyId!==routeId:legacyId!==undefined)throw Error("Invalid domestic compatibility identity");
    const required=["app-divisions","app-competition-badge","app-competition-capacity",
      "app-standings-body","app-standings-caption","app-search-dialog","division-detail-name"];
    if(division)required.push("app-competition-flag","app-competition-country","app-competition-tier","app-competition-level");
    if(required.some(id=>!document.getElementById(id)))throw Error("Incomplete generated page");
    const dataset=document.documentElement?.dataset||{};
    activeDebugSeason=dataset.faDevCurrentSeason===undefined?null:Number(dataset.faDevCurrentSeason);
    const devSeasons=(dataset.faDevSeasons||"").split(",").map(Number).filter(n=>n>=1&&n<=4);
    const seasons=devSeasons.length?devSeasons.filter(n=>activeDebugSeason===null||n<=activeDebugSeason):[1];
    if(!seasons.includes(1))seasons.push(1);
    const raw=new URL(window.location.href).searchParams.get("season");
    const requested=raw===null?Math.max(...seasons):/^[1-9]\d{0,8}$/.test(raw)?Number(raw):1;
    window.faCompetitionContextApi=Object.freeze({selectSeason,replaceSeasonData,clearSeasonData,setDebugSeason});
    nextContext(seasons.includes(requested)?requested:1);
    await loadScript('competition-rules.js');
    window.addEventListener('fa:competition-context-change',refreshSeasonPresentation);
    window.addEventListener("fa:dev-progress-change",event=>{
      setDebugSeason(event.detail?.season);
    });
    window.addEventListener("fa:fictional-standings-change",event=>{
      if(event.detail?.enabled===false)clearSeasonData();
    });
    document.getElementById("division-detail-name").textContent=definition.name;
    document.getElementById("app-competition-capacity").textContent=String(definition.capacity);
    window.faClubCrests=manifest.clubCrests;
    let suppliedMobile;
    if(division){
    // Only standings are enhanced; the original inline logo DOM is never replaced.
    const standings=document.querySelector(".app-world-standings");
    if(!standings)throw Error("Missing standings");
    standings.outerHTML=withMobileShell(standings.outerHTML);
    document.getElementById("division-detail-name").textContent=division.name;
    window.faThemeRebind?.(); // Rebind unrelated branding/theme controls.
    const flag = document.getElementById("app-competition-flag");
    // The server-generated inline SVG is already correct at first paint.
    // Validate the route identity instead of replacing the flag DOM.
    if (flag.tagName.toLowerCase() !== "svg" ||
        !flag.closest(".app-world-flag-frame")) throw Error("Invalid inline competition flag");
    const country = document.getElementById("app-competition-country");
    country.dataset.worldCountry = division.countryId;
    country.textContent = division.countryName;
    const tier = document.getElementById("app-competition-tier");
    tier.dataset.appI18n = division.tier === 1 ? "divisionTier1" : "divisionTier2";
    tier.textContent = division.tier === 1 ? "First division" : "Second division";
    document.getElementById("app-competition-capacity").textContent = String(division.capacity);
    document.getElementById("app-competition-level").textContent = String(division.tier);
    window.faClubCrests=manifest.clubCrests;
    const tbody = document.getElementById("app-standings-body");
    const mobile = createMobileStandings();
    suppliedMobile=mobile;
    const provisional = division.clubs.map(club => ({
      club,position:null,played:null,won:null,drawn:null,lost:null,
      gf:null,ga:null,gd:null,pts:null,recent:[]
    }));
    const commitMobile = mobile.prepare(provisional);
    // Public statistics remain unknown in both presentations.
    // RENDER-01: keep verified build-time rows in place instead of rebuilding them.
    // Fall back to the canonical renderer for older or incomplete HTML.
    const preRendered=[...(tbody.rows||tbody.children||[])];
    const expected=division.clubs.map(club=>club.countryId+"-"+club.clubId);
    const staticReady=preRendered.length===expected.length&&preRendered.every((row,index)=>
      row.dataset.worldClub===expected[index]&&row.cells.length===11&&
      row.querySelector(".app-world-club-name")?.textContent===(division.clubs[index].primaryName||division.clubs[index].abbr)&&
      row.querySelector("[data-club-crest]")?.dataset.clubCrest===expected[index]);
    if(!staticReady)tbody.replaceChildren(...division.clubs.map(club => createStandingsRow(club)));
    commitMobile();
    window.faStandingsMobile = mobile;
    window.faCompetitionDivision=division;
    createPostseason(division);
    }else{
      delete window.faCompetitionDivision;
      const standings=document.querySelector('.app-world-standings');
      if(!standings)throw Error('Missing standings');
      standings.outerHTML=withMobileShell(standings.outerHTML);
      suppliedMobile=createMobileStandings();window.faStandingsMobile=suppliedMobile;
      window.faPostseasonTips=bindPostseasonTips();
      mountedPostseasonGraph=JSON.stringify(definition.rules.phases.filter(p=>p.type==='knockout'));
      const empty=document.createElement("tr"),cell=document.createElement("td");
      cell.colSpan=11;cell.className="app-competition-empty-row";
      cell.dataset.appI18n="competitionStandingsEmpty";
      cell.textContent="No standings available yet.";empty.appendChild(cell);
      document.getElementById("app-standings-body").replaceChildren(empty);
    }
    bindSuppliedPanels(suppliedMobile);
    const awardsStyle=document.createElement("link");awardsStyle.rel="stylesheet";awardsStyle.href="/assets/competition-awards.css";document.head.append(awardsStyle);
    // The module bootstrap does not delay legacy shared-page initialization.
    // Selector module is optional to boot: never stall existing public consumers.
    void loadScript('provider-selectors-bootstrap.mjs',true).catch(()=>{});
    for (const script of ["competition-rules-view.js","landing.js","app.js","app-search.js","club-crests.js","competition-tabs.js","competition-history.js","competition-fixtures.js","competition-stats.js","competition-awards.js",...(definition.category==="international"?["international-cups.js"]:[])])
      await loadScript(script);
    window.addEventListener('fa:competition-context-change',()=>window.faAppRenderLanguage?.());
    refreshSeasonPresentation();
    const statsPanel=document.getElementById('competition-panel-stats');
    if(statsPanel&&window.faCompetitionStats){
      const stats=window.faCompetitionStats.mount(statsPanel,window.faCompetitionContext);
      window.addEventListener('fa:competition-context-change',event=>stats.update(event.detail));
      window.addEventListener('fa:competition-route-change',()=>stats.update(window.faCompetitionContext));
    }
  }
  start().catch(fail);
})();
