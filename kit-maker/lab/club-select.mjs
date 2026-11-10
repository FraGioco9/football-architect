import {kitDesignStore,formatKitStripeWidth} from "./kit-design.mjs";
// KM-02: read-only canonical club picker using Football Architect's
// language-trigger / language-menu design system. No kit or account writes.
const countries=Object.freeze([
  ["BR","Brazil"],["DE","Germany"],["ENG","England"],["ES","Spain"],
  ["FR","France"],["IT","Italy"],["NL","Netherlands"],["PT","Portugal"]
]);

export function groupKitMakerClubs(manifest){
  if(!Array.isArray(manifest?.clubs)||manifest.clubs.length!==320)
    throw new Error("Expected the canonical 320-club catalogue");
  const byCountry=new Map(countries.map(([code,name])=>[code,{code,name,clubs:[]}]));
  const seen=new Set();
  for(const club of manifest.clubs){
    const code=club?.countryId;
    const number=club?.clubId;
    const name=club?.primaryName;
    const group=byCountry.get(code);
    if(!group||!Number.isSafeInteger(number)||number<1||number>40||
      typeof name!=="string"||!name.trim())
      throw new Error("Invalid canonical club identity");
    const id=code+"-"+number;
    if(seen.has(id))throw new Error("Duplicate canonical club identity");
    seen.add(id);
    group.clubs.push({id,name:name.trim()});
  }
  for(const group of byCountry.values()){
    if(group.clubs.length!==40)throw new Error("Incomplete country club catalogue");
    group.clubs.sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base",numeric:true}));
  }
  return [...byCountry.values()];
}

export async function loadKitMakerClubs(select,status,{fetchManifest=fetch,locationObject=location,historyObject=history}={}){
  const control=select.closest(".km-club-control");
  const trigger=control?.querySelector(".language-trigger");
  const menu=control?.querySelector(".language-menu");
  const value=trigger?.querySelector("#km-club-value");
  if(!control||!trigger||!menu||!value)
    throw new Error("Kit Maker canonical club dropdown is missing");

  const response=await fetchManifest("/clubs/_shared/manifest.json",{cache:"force-cache"});
  if(!response.ok)throw new Error("Club catalogue unavailable");
  const manifest=await response.json();
  const groups=groupKitMakerClubs(manifest);
  const clubPalettes=new Map(manifest.clubs.map(club=>[
    club.countryId+"-"+club.clubId,club
  ]));
  const selectFragment=document.createDocumentFragment();
  const menuFragment=document.createDocumentFragment();
  const options=[];
  const names=new Map();
  for(const group of groups){
    const optgroup=document.createElement("optgroup");
    optgroup.label=group.name;
    const menuGroup=document.createElement("div");
    menuGroup.setAttribute("role","group");
    menuGroup.setAttribute("aria-label",group.name);
    const heading=document.createElement("div");
    heading.className="km-option-group-title";
    heading.textContent=group.name;
    heading.setAttribute("aria-hidden","true");
    menuGroup.append(heading);
    for(const club of group.clubs){
      const native=document.createElement("option");
      native.value=club.id;
      native.textContent=club.name;
      optgroup.append(native);
      const item=document.createElement("div");
      item.className="language-option";
      item.role="option";
      item.id="km-club-option-"+club.id;
      item.tabIndex=-1;
      item.dataset.value=club.id;
      item.setAttribute("aria-selected","false");
      item.textContent=club.name;
      options.push(item);
      names.set(club.id,club.name);
      menuGroup.append(item);
    }
    selectFragment.append(optgroup);
    menuFragment.append(menuGroup);
  }
  select.append(selectFragment);
  menu.replaceChildren(menuFragment);
  const query=new URLSearchParams(locationObject.search);
  const requested=query.get("club");
  select.value=names.has(requested)?requested:"";

  function refresh(){
    value.textContent=names.get(select.value)||"Select club";
    for(const item of options)
      item.setAttribute("aria-selected",String(item.dataset.value===select.value));
    document.documentElement.dataset.kitMakerClub=select.value;
    // Reuse the ONE club-manifest request; no additional colours API.
    const club=clubPalettes.get(select.value);
    kitDesignStore.setClub(club?select.value:null,club||null);
  }
  function selectedIndex(){
    return Math.max(0,options.findIndex(item=>item.dataset.value===select.value));
  }
  function close(restoreFocus=false){
    menu.hidden=true;
    trigger.setAttribute("aria-expanded","false");
    for(const item of options)delete item.dataset.active;
    if(restoreFocus)trigger.focus();
  }
  function focusOption(index){
    const item=options[(index+options.length)%options.length];
    for(const node of options){
      if(node===item)node.dataset.active="true";
      else delete node.dataset.active;
    }
    item.focus({preventScroll:true});
    item.scrollIntoView({block:"nearest"});
  }
  function open(index=selectedIndex()){
    menu.hidden=false;
    trigger.setAttribute("aria-expanded","true");
    focusOption(index);
  }
  function choose(item){
    if(!options.includes(item))return;
    const next=item.dataset.value;
    const changed=select.value!==next;
    select.value=next;
    refresh();
    close(true);
    if(changed)select.dispatchEvent(new Event("change",{bubbles:true}));
  }
  select.addEventListener("change",()=>{
    refresh();
    const url=new URL(locationObject.href);
    if(select.value)url.searchParams.set("club",select.value);
    else url.searchParams.delete("club");
    historyObject.replaceState(historyObject.state,"",url.pathname+url.search+url.hash);
  });
  trigger.addEventListener("click",()=>{
    if(menu.hidden)open();
    else close(true);
  });
  trigger.addEventListener("keydown",event=>{
    if(["ArrowDown","ArrowUp","Home","End"].includes(event.key)){
      event.preventDefault();
      open(event.key==="Home"?0:event.key==="End"?options.length-1:
        selectedIndex()+(event.key==="ArrowUp"?-1:1));
    }else if(event.key==="Escape"&&!menu.hidden){
      event.preventDefault();
      close(true);
    }
  });
  menu.addEventListener("click",event=>{
    const item=event.target.closest?.('[role="option"][data-value]');
    if(item&&menu.contains(item))choose(item);
  });
  let typed="",typedAt=0;
  menu.addEventListener("keydown",event=>{
    const index=Math.max(0,options.indexOf(document.activeElement));
    if(["ArrowDown","ArrowUp","Home","End"].includes(event.key)){
      event.preventDefault();
      focusOption(event.key==="Home"?0:event.key==="End"?options.length-1:
        index+(event.key==="ArrowDown"?1:-1));
    }else if(event.key==="Enter"||event.key===" "){
      event.preventDefault();
      choose(options[index]);
    }else if(event.key==="Escape"){
      event.preventDefault();
      close(true);
    }else if(event.key==="Tab"){
      close();
    }else if(event.key.length===1&&!event.ctrlKey&&!event.altKey&&!event.metaKey){
      const now=Date.now();
      typed=(now-typedAt>600?"":typed)+event.key.toLocaleLowerCase();
      typedAt=now;
      const found=options.findIndex(item=>item.textContent.toLocaleLowerCase().startsWith(typed));
      if(found>=0){event.preventDefault();focusOption(found);}
    }
  });
  document.addEventListener("pointerdown",event=>{
    if(!menu.hidden&&!control.contains(event.target))close();
  });

  refresh();
  trigger.disabled=false;
  status.textContent="";
  status.hidden=true;
  return groups;
}
// KM-16: the option boxes are already present at first paint. Render
// variable swatches only once canonical manifest data has arrived.
export function initKitMakerControls(doc=document,store=kitDesignStore){
  const parts=[...doc.querySelectorAll("[data-km-part]")];
  const colors=[...doc.querySelectorAll("[data-km-color]")];
  const styles=[...doc.querySelectorAll("[data-km-style]")];
  const layers=[...doc.querySelectorAll("[data-km-layer]")];
  const widthSlider=doc.getElementById("km-stripe-width");
  const widthValue=doc.getElementById("km-stripe-width-value");
  const stripePanel=doc.getElementById("km-stripe-settings");
  const colorHeading=doc.getElementById("km-colors-title");
  const trimNote=doc.getElementById("km-trim-note");
  if(parts.length!==3||colors.length!==6||styles.length!==2||
     layers.length!==3||!widthSlider||widthSlider.type!=="range"||
     !widthValue||!stripePanel||!colorHeading||!trimNote)
    throw new Error("Kit Maker design panel is incomplete");
  for(const button of parts)
    button.addEventListener("click",()=>store.selectPart(button.dataset.kmPart));
  for(const button of styles)
    button.addEventListener("click",()=>store.selectStyle(button.dataset.kmStyle));
  for(const button of layers)
    button.addEventListener("click",()=>store.selectColorLayer(button.dataset.kmLayer));
  // Input fires continuously while dragging, also supports keyboard arrows.
  widthSlider.addEventListener("input",()=>{
    store.selectStripeWidth(Number(widthSlider.value));
  });
  for(const button of colors)
    button.addEventListener("click",()=>{
      if(!button.disabled)store.selectColor(button.dataset.kmColor);
    });
  function render(state){
    const striped=state.style==="vertical-stripes";
    stripePanel.hidden=!striped;
    trimNote.hidden=state.activePart!=="jersey";
    colorHeading.textContent={
      base:"Body color",accent:"Stripe color",trim:"Jersey trim color"
    }[state.activeLayer]||"Color";
    for(const button of parts)
      button.setAttribute("aria-pressed",String(button.dataset.kmPart===state.activePart));
    for(const button of styles)
      button.setAttribute("aria-pressed",String(button.dataset.kmStyle===state.style));
    for(const button of layers){
      const layer=button.dataset.kmLayer;
      button.hidden=(layer==="accent"&&!striped)||
        (layer==="trim"&&state.activePart!=="jersey");
      button.setAttribute("aria-pressed",String(layer===state.activeLayer));
    }
    const widthMm=state.stripeWidths[state.activePart];
    widthSlider.value=String(widthMm);
    widthValue.textContent=formatKitStripeWidth(widthMm);
    widthSlider.setAttribute("aria-valuetext",formatKitStripeWidth(widthMm));
    const selectedRole=state.activeLayer==="trim"
      ?state.detailSelections.trim
      :state.activeLayer==="accent"
        ?state.accentSelections[state.activePart]
        :state.selections[state.activePart];
    const choices=new Map(state.choices.map(choice=>[choice.id,choice]));
    for(const button of colors){
      const role=button.dataset.kmColor,choice=choices.get(role);
      if(!choice)throw new Error("Unknown Kit Maker colour role");
      button.disabled=!choice.enabled;
      button.setAttribute("aria-pressed",String(selectedRole===role));
      const swatch=button.querySelector(".km-color-swatch");
      const value=button.querySelector(".km-color-hex");
      if(!swatch||!value)throw new Error("Incomplete Kit Maker colour option");
      button.style.setProperty("--km-swatch",choice.hex||"transparent");
      value.textContent=choice.hex||"";
      button.title=choice.hex?choice.label+" · "+choice.hex:choice.label+" · select a club";
    }
  }
  const unsubscribe=store.subscribe(render);
  render(store.getState());
  return unsubscribe;
}

if(typeof document!=="undefined"){
  if(document.querySelector("[data-km-part]"))initKitMakerControls();
  const select=document.getElementById("km-club-select");
  const status=document.getElementById("km-club-status");
  if(select&&status)loadKitMakerClubs(select,status).catch(error=>{
    const trigger=document.getElementById("km-club-trigger");
    if(trigger)trigger.disabled=true;
    status.hidden=false;
    status.textContent="Club catalogue unavailable.";
    console.error("Kit Maker club catalogue unavailable",error);
  });
}
