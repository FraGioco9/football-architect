// DEBUG-DATA-01 I05: explicit local-only development bootstrap.
// Not referenced by public HTML. Both gates required before imports.
const root=document.documentElement;
const enabled=()=>root.dataset.faI03Renderer==="1"&&root.dataset.faI05Enable==="1"&&
 ["localhost","127.0.0.1","app.localhost"].includes(location.hostname);
if(enabled()){
 const route=location.pathname;
 if(/^\/competitions\/((?:it|eng|es|de|fr|pt|nl|br)-[12]|int-[12])(?:\/|$)/i.test(route)){
  await import("./dev-protected-debug-source.mjs");
  if(!route.toLowerCase().includes("/int-"))await import("./dev-protected-domestic-controller.mjs");
  await import("./dev-protected-stats-controller.mjs");
  await import("./dev-protected-history-controller.mjs");
  await import("./dev-protected-international-controller.mjs");
 }else if(route==="/calendar"||/^\/clubs\/(?:it|eng|es|de|fr|pt|nl|br)\/(?:[1-9]|[1-3][0-9]|40)(?:\/|$)/i.test(route)){
  await import("./dev-protected-world-presenter.mjs");
  await import("./dev-protected-world-source.mjs");
 }
}
