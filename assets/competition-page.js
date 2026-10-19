/* One shared competition renderer for all sixteen static deep-link routes. */
(() => {
  "use strict";
  const sourceUrl = document.currentScript?.src;
  const routeId = document.querySelector('meta[name="fa-division"]')?.content;
  const root = new URL("../competitions/_shared/", sourceUrl);
  const status = document.getElementById("main-content");

  function fail() {
    if (!status || !document.body) return;
    document.body.replaceChildren();
    const main = document.createElement("main");
    main.className = "app-main";
    main.setAttribute("role", "alert");
    main.textContent = "Competition unavailable. ";
    const back = document.createElement("a");
    back.href = "../";
    back.textContent = "Back to Competitions";
    main.appendChild(back);
    document.body.appendChild(main);
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
    if (!Number.isInteger(position) || position < 1 || position > 16) return "";
    if (routeId.endsWith("-1")) {
      if (position === 1) return "champion";
      if (position >= 15) return "relegated";
      if (position >= 13) return "playout";
    } else if (routeId.endsWith("-2")) {
      if (position <= 2) return "promoted";
      if (position <= 6) return "playoff";
    }
    return "";
  }
  function decorateStanding(row, position) {
    const outcome = standingOutcome(position);
    if (outcome) {
      row.dataset.standingOutcome = outcome;
      row.setAttribute("aria-describedby", "standings-outcome-" + outcome);
    }
  }
  window.faStandingsOutcomes = Object.freeze({decorate:decorateStanding});

  function bindPostseasonTips() {
    let active=null,wasOpen=false,leaveTimer;
    function close(blur=false) {
      clearTimeout(leaveTimer);
      if(!active)return;
      const previous=active;active=null;previous.tip.hidden=true;
      if(blur&&document.activeElement===previous.button)previous.button.blur();
    }
    for(const button of document.querySelectorAll("[data-postseason-help]")) {
      const tip=document.getElementById(button.dataset.postseasonHelp);
      if(!tip)continue;
      document.body.appendChild(tip);
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
      button.addEventListener("pointerenter",event=>{if(event.pointerType==="mouse"||event.pointerType==="pen")open()});
      const leave=()=>{if(document.activeElement!==button)leaveTimer=setTimeout(()=>close(),160)};
      button.addEventListener("pointerleave",leave);
      tip.addEventListener("pointerenter",open);
      tip.addEventListener("pointerleave",leave);
      button.addEventListener("focus",open);
      button.addEventListener("blur",()=>{if(active?.button===button)close()});
      button.addEventListener("pointerdown",()=>{wasOpen=active?.button===button});
      button.addEventListener("click",()=>{if(wasOpen)close(true);else{button.focus();open()}wasOpen=false});
    }
    document.addEventListener("keydown",event=>{if(event.key==="Escape"&&active){close();event.preventDefault();event.stopPropagation()}});
    document.addEventListener("pointerdown",event=>{if(active&&event.target!==active.button&&!active.button.contains?.(event.target)&&!active.tip.contains(event.target))close(true)});
    window.addEventListener("resize",()=>close());
    window.addEventListener("scroll",()=>{if(active&&document.activeElement===active.button)active.open();else close()},{capture:true,passive:true});
    return close;
  }

  function createPostseason(division) {
    const bracket=document.getElementById("app-postseason-bracket");
    if(!bracket)return;
    const slots=[...document.querySelectorAll("[data-postseason-position]")];
    const scores=[...document.querySelectorAll("[data-postseason-score]")];
    const finalists=[...document.querySelectorAll("[data-postseason-finalist]")];
    const matchRows=[...document.querySelectorAll("[data-postseason-row]")];
    const resolutions=[...document.querySelectorAll("[data-postseason-resolution]")];
    const winner=document.getElementById("app-postseason-winner");
    // Align playout connector and winner to the actual boundary between team rows.
    // Text notes below the teams must not affect either position.
    if(division.tier===1){
      const left=bracket.querySelector(".app-knockout-left");
      const result=bracket.querySelector(".app-knockout-result");
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
        if(typeof requestAnimationFrame==="function")requestAnimationFrame(align);
      }
    }
    // Playoff lines are anchored to the midpoint between team rows, not card height.
    // Do not move either semifinal, final, or winner box.
    if(division.tier===2){
      const semifinals=bracket.querySelectorAll(".app-knockout-left,.app-knockout-right");
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
      if(club){const name=document.createElement("span");name.textContent=club.primaryName;slot.replaceChildren(createCrestHost(club.countryId+"-"+club.clubId),name)}
      else slot.replaceChildren(word(key,label));
    }
    function render(rows,results) {
      closeTips();current={rows,results};
      const qualified=rows!==null&&rows.every(row=>row.played===model.schedule.rounds);
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
      const qualified=rows.every(row=>row.played===model.schedule.rounds);
      if(qualified!==(data.matchday>=30))invalid();
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
      const expected=qualified?(division.tier===1?[["playout",13,14]]:[["semi-one",3,6],["semi-two",4,5]]):[];
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
      if(division.tier===2&&data.matchday>=32){
        const ids=data.ties.map(t=>t.winnerId).sort((a,b)=>rows.findIndex(r=>r.club.clubId===a)-rows.findIndex(r=>r.club.clubId===b));
        game(data.final,ids[0],ids[1],data.matchday>=33);
        const win=data.matchday>=33?winning(ids,[data.final.homeGoals,data.final.awayGoals],data.final):null;
        if(data.final.winnerId!==win||data.winnerId!==win)invalid();
      }else if(data.final!==null||data.winnerId!==(division.tier===1?data.ties[0]?.winnerId??null:null))invalid();
      return data;
    }
    window.faPostseason=Object.freeze({
      prepare(rows,results=null) {
        if(rows===null){if(results!==null)throw Error("Invalid postseason standings");return()=>render(null,null)}
        if(!Array.isArray(rows)||rows.length!==model.profile.capacity)throw Error("Invalid postseason standings");
        const seen=new Set();
        const next=rows.map(row=>{
          const club=clubs.get(row?.club?.clubId);
          if(!club||row.club.countryId!==division.countryId||seen.has(club.clubId)||!Number.isInteger(row.played)||row.played<0||row.played>model.schedule.rounds)throw Error("Invalid postseason participant");
          seen.add(club.clubId);return{club,played:row.played};
        });
        const prepared=validateResults(results,next);
        return()=>render(next,prepared);
      },
      snapshot(){const previous=current;return()=>render(previous.rows,previous.results)}
    });
    render(null,null);
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
      if (!Array.isArray(rows) || rows.length !== model.profile.capacity)
        throw Error("Incomplete mobile standings model");
      const identities = new Set();
      const clubs = new Map(rows.map(row => [row.club?.clubId,row.club]));
      const items = rows.map((row,index) => {
        const club = row.club;
        const id = club?.countryId + "-" + club?.clubId;
        if (!club || !(club.primaryName || club.abbr) || !Number.isInteger(club.clubId) ||
            identities.has(id) || !club.countryId || !Array.isArray(row.recent) ||
            row.recent.length !== Math.min(5,row.played))
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
        name.append(crest,element("span","app-world-mobile-club-name",club.primaryName || club.abbr));
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
      if (identities.size !== model.profile.capacity) throw Error("Invalid mobile standings size");
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
    const name = document.createElement("span");
    name.className = "app-world-club-name";
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
  function loadScript(url) {
    return new Promise((resolve,reject) => {
      const script = document.createElement("script");
      script.src = new URL(url,sourceUrl).href;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Missing shared app script"));
      document.head.appendChild(script);
    });
  }
  async function start() {
    if (!sourceUrl || !/^(IT|ENG|ES|DE|FR|PT|NL|BR)-[12]$/.test(routeId)) throw Error("Invalid route identity");
    const path = window.location.pathname.replace(/\/index\.html$/,"").replace(/\/+$/,"");
    if (path.split("/").pop() !== routeId.toLowerCase()) throw Error("Route identity mismatch");
    const dataResponse=await fetch(new URL("manifest.json",root),{credentials:"same-origin"});
    if(!dataResponse.ok)throw Error("Competition data unavailable");
    const manifest=await dataResponse.json();
    if(!model.validManifest(manifest))throw Error("Invalid or approved competition manifest");
    const division=manifest.divisions.find(d=>d.id===routeId);
    if(!division)throw Error("Unknown division");
    const required=["app-divisions","app-competition-badge","app-competition-flag",
      "app-competition-country","app-competition-tier","app-competition-capacity",
      "app-competition-level","app-standings-body","app-standings-caption","app-search-dialog"];
    if(required.some(id=>!document.getElementById(id)))throw Error("Incomplete generated page");
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
    const provisional = division.clubs.map(club => ({
      club,position:null,played:null,won:null,drawn:null,lost:null,
      gf:null,ga:null,gd:null,pts:null,recent:[]
    }));
    const commitMobile = mobile.prepare(provisional);
    // Public statistics remain unknown in both presentations.
    tbody.replaceChildren(...division.clubs.map(club => createStandingsRow(club)));
    commitMobile();
    window.faStandingsMobile = mobile;
    window.faCompetitionDivision=division;
    createPostseason(division);
    for (const script of ["landing.js","app.js","app-search.js","club-crests.js","competition-tabs.js","competition-history.js","competition-fixtures.js"])
      await loadScript(script);
  }
  start().catch(fail);
})();
