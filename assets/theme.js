// UI-THEME #96 — shared, dark-default preference loaded before CSS.
(() => {
  "use strict";
  const KEY = "football-architect:theme";
  const valid = value => value === "light" ? "light" : "dark";
  let theme = "dark";
  try { theme = valid(window.localStorage.getItem(KEY)); }
  catch { /* Storage can be unavailable in private browsing. */ }
  function paint(value) {
    theme = valid(value);
    document.documentElement.setAttribute("data-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#F4F7F4" : "#101A1D");
    for (const button of document.querySelectorAll("[data-theme-choice]"))
      button.setAttribute("aria-pressed", String(button.dataset.themeChoice === theme));
    for (const img of document.querySelectorAll(".brand-image, .app-brand-symbol")) {
      const src = img.getAttribute("src");
      if (src && /-(?:dark|light)\.svg$/.test(src))
        img.setAttribute("src", src.replace(/-(?:dark|light)\.svg$/, "-" + theme + ".svg"));
    }
  }
  // Keep accessible label associations, but clicking label text does not focus/toggle controls.
  document.addEventListener('click',event=>{
    const target=event.target;
    if(!target?.closest||!target.closest('label'))return;
    if(target.closest('input,textarea,select,button,a,[role="option"]'))return;
    event.preventDefault();
  },true);
  // Login returns stay in this tab, never in an account URL or persistent storage.
  const returnKey='football-architect:login-return';
  function safeReturn(raw){
    if(typeof raw!=='string'||!raw.startsWith('/')||raw.startsWith('//')||/[\\\x00-\x20]/.test(raw)||raw.split(/[?#]/)[0].includes('%'))return '/account';
    try{
      const url=new URL(raw,location.origin);
      const path=url.pathname.replace(/\/+$/,'')||'/';
      if(url.origin!==location.origin||(path!=='/account'&&!window.faRoutesRegistry?.parseRoute(path)))return '/account';
      return path+url.search+url.hash;
    }catch{return '/account';}
  }
  window.faLoginReturn={
    remember(){try{sessionStorage.setItem(returnKey,location.pathname+location.search+location.hash)}catch{}},
    take(){
      let raw;try{raw=sessionStorage.getItem(returnKey);sessionStorage.removeItem(returnKey)}catch{}
      if(!raw&&document.referrer){try{const ref=new URL(document.referrer);if(ref.origin===location.origin)raw=ref.pathname+ref.search+ref.hash}catch{}}
      return safeReturn(raw);
    }
  };
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[href]');if(!link||link.id==='app-nav-profile')return;
    const target=new URL(link.href,location.href);
    if(target.origin===location.origin&&/^\/account\/(?:login|register|recover)\/?$/.test(target.pathname)&&!/^\/account\/(?:login|register|recover|verify-email)\/?$/.test(location.pathname))window.faLoginReturn.remember();
  },true);
  // Parser-blocking in <head>: theme is set before stylesheets are parsed.
  paint(theme);
  function ready() {
    paint(theme);
    for (const button of document.querySelectorAll("[data-theme-choice]"))
      button.addEventListener("click", () => {
        paint(button.dataset.themeChoice);
        try { window.localStorage.setItem(KEY, theme); }
        catch { /* Theme remains active in the current document. */ }
      });
  }
  // The competition renderer inserts its shared body after DOMContentLoaded.
  window.faThemeRebind = ready;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready, {once:true});
  else ready();
  window.addEventListener("storage", event => {
    if (event.key === KEY) paint(event.newValue);
  });
})();
