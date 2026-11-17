// PERF-API-657: shared validated compact Competition transport for Club Fixtures and Calendar.
// The authoritative sporting projection still consumes the full canonical shape.
export async function readCompetitionCatalogue({fetchJson,loadModel}){
 if(typeof fetchJson!=='function'||typeof loadModel!=='function')
  throw TypeError('Missing Club competition catalogue dependencies');
 const [compact,model]=await Promise.all([
  fetchJson('/competitions/_shared/compact.json'),loadModel()
 ]);
 if(!model||typeof model.expandCompactManifest!=='function'||
    typeof model.validManifest!=='function')
  throw TypeError('Missing canonical Competition validator');
 const manifest=model.expandCompactManifest(compact);
 if(!model.validManifest(manifest))
  throw TypeError('Unverified Competition catalogue');
 return manifest;
}

// Backwards-compatible scoped alias; Club Fixtures and Calendar share the same validator.
export const readClubCompetitionCatalogue=readCompetitionCatalogue;
