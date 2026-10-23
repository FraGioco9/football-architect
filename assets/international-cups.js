/* INT-24 UI localization. Display only; no sporting state changes. */
(()=>{"use strict";
const copy={"en":["International Cups","24 clubs · 8 countries"],"it":["Coppe internazionali","24 club · 8 Paesi"],"de":["Internationale Pokale","24 Klubs · 8 Länder"],"es":["Copas internacionales","24 clubes · 8 países"],"fr":["Coupes internationales","24 clubs · 8 pays"]};
const apply=()=>{
 const lang=Object.hasOwn(copy,document.documentElement.lang)?document.documentElement.lang:"en",t=copy[lang];
 const heading=document.getElementById("international-cups-heading");if(heading)heading.textContent=t[0];
 for(const link of document.querySelectorAll('a[href="/competitions/int-1"],a[href="/competitions/int-2"]')){const small=link.querySelector("small");if(small)small.textContent=t[1];}
 for(const node of document.querySelectorAll('[data-cup-copy="category"]'))node.textContent=t[0];
 for(const node of document.querySelectorAll('[data-cup-copy="summary"]'))node.textContent=t[1];

};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",apply,{once:true});else apply();
new MutationObserver(apply).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
})();
