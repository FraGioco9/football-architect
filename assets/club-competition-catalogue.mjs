// PERF-API-657: reuse the validated Competition compact transport on Club Fixtures.
// The authoritative sporting projection still consumes the full canonical shape.
export async function readClubCompetitionCatalogue({fetchJson,loadModel}){
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
  throw TypeError('Unverified Club competition catalogue');
 return manifest;
}
