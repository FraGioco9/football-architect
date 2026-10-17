// Separate opt-in site/app subdomain preview; loopback only, never published.
import { createPreviewServer } from "./dev-standings-preview.mjs";
if (process.argv.length !== 2) throw Error("DEV app preview accepts no CLI flags");
createPreviewServer({subdomains:true}).listen(2000, "127.0.0.1", () => {
  process.stdout.write("Site: http://localhost:2000/\nApp: http://app.localhost:2000/dashboard\nCompetitions: http://app.localhost:2000/competitions\nHistory DEV preview: http://app.localhost:2000/competitions/it-1?season=4&view=history\n");
});
