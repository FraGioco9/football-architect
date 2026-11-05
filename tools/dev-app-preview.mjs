// Canonical local site/app preview. An explicit --lan opt-in opens a second
// frontend-only listener on one owned private interface, never the Worker/D1.
import { createPreviewServer } from "./dev-standings-preview.mjs";
import { validateLanAddress } from "./dev.mjs";
if (process.argv.length !== 2) throw Error("DEV app preview accepts no CLI flags");
const lanAddress=process.env.FA_DEV_LAN==='1'
  ? validateLanAddress(process.env.FA_DEV_LAN_HOST) : null;

// Keep the canonical separate loopback origins unchanged, including local APIs.
createPreviewServer({subdomains:true}).listen(2000, "127.0.0.1", () => {
  process.stdout.write("Site: http://localhost:2000/\nApp: http://app.localhost:2000/dashboard\nCompetitions: http://app.localhost:2000/competitions\nHistory DEV preview: http://app.localhost:2000/competitions/it-1/history?season=4\n");
});
// LAN uses a single IP origin, routes by path and deliberately does not expose
// /api/* to other devices: the existing proxy requires loopback clients/hosts.
if(lanAddress){
 createPreviewServer({subdomains:false}).listen(2000,lanAddress,()=>{
  process.stdout.write('Safari QA LAN (frontend only): http://'+lanAddress+':2000/dashboard | http://'+lanAddress+':2000/clubs\n');
 });
}
