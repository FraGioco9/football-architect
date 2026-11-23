// PERF-API-02 (#734): shared-shell browser HTTP transport, synthetic API only.
// This audits browser request starts, NOT real Worker/D1 bytes, latency or compression.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const origin='http://app.localhost:2000';
const siteOrigin='http://localhost:2000';
const world={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',
 revision:4,seasonNumber:1,day:20,phase:'active'};
const worldPayload={world};
const grants={permissions:['admin.access','admin.world.read']};
const denial={error:{code:'unauthorized'}};
const bytes=value=>Buffer.byteLength(JSON.stringify(value));

export async function verifySharedShellNetwork(browser,{engine='chromium'}={}){
 const observations=[];
 for(const authorized of [false,true]){
  const context=await browser.newContext({viewport:{width:390,height:844},
   locale:'en-US',reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await context.newPage(),requests=[],errors=[];
  let stage='setup';
  page.on('pageerror',error=>errors.push(String(error.message)));
  page.on('request',request=>{
   const u=new URL(request.url());
   if([origin,siteOrigin].includes(u.origin)&&(u.pathname.startsWith('/api/')||
    u.pathname==='/data/divisions.json'))
    requests.push({stage,method:request.method(),path:u.pathname,search:u.search,status:null});
  });
  await context.addInitScript(()=>{
   sessionStorage.setItem('football-architect:debug-enabled','off');
   window.__faShellPageshow=[];
   window.addEventListener('pageshow',event=>window.__faShellPageshow.push(event.persisted));
  });
  await page.route('**/api/**',route=>{
   const url=new URL(route.request().url()),path=url.pathname;
   const preview=path==='/api/matches';
   const body=preview?{schemaVersion:1,providerId:'authoritative-world',world,
    selectedSeason:world.seasonNumber,day:Number(url.searchParams.get('day')),
    publication:'published',fixtures:[]}:path==='/api/world'?worldPayload:
    path==='/api/player/permissions'?(authorized?grants:denial):
    path==='/api/player/session'?denial:null;
   return route.fulfill({status:preview||path==='/api/world'||(authorized&&path==='/api/player/permissions')?200:401,
    contentType:'application/json',body:JSON.stringify(body??denial)});
  });
  const count=(when,path)=>requests.filter(r=>r.stage===when&&r.method==='GET'&&r.path===path).length;
  const apiCount=when=>requests.filter(r=>r.stage===when&&r.path.startsWith('/api/')).length;
  const waitWorld=()=>page.waitForResponse(r=>new URL(r.url()).pathname==='/api/world'&&r.status()===200,{timeout:15000});
  const waitPermission=()=>page.waitForResponse(r=>new URL(r.url()).pathname==='/api/player/permissions'&&
   r.status()===(authorized?200:401),{timeout:15000});
  const ready=async()=>page.waitForFunction(()=>window.faWorldState?.get?.().worldStatus==='ready',
   null,{timeout:15000});
  const document=async(path,name,permissionExpected)=>{
   stage=name;
   const pendingWorld=waitWorld();
   const pendingPermission=permissionExpected?waitPermission():null;
   const response=await page.goto(origin+path,{waitUntil:'domcontentloaded',timeout:30000});
   assert.equal(response?.status(),200,name+' document');
   await pendingWorld;
   if(pendingPermission)await pendingPermission;
   await ready();
   await page.waitForTimeout(130);
   assert.equal(count(name,'/api/world'),1,name+' world read');
   assert.equal(count(name,'/api/player/permissions'),permissionExpected?1:0,name+' permission read');
   const previews=requests.filter(r=>r.stage===name&&r.path==='/api/matches');
   const expectedPreviews=path==='/dashboard'?4:0;
   assert.equal(previews.length,expectedPreviews,name+' bounded published match previews');
   for(const item of previews){
    const params=new URLSearchParams(item.search);
    assert.deepEqual([...params.keys()].sort(),['day','season'],name+' scoped preview query');
    assert.equal(params.get('season'),String(world.seasonNumber),name+' current season');
    const day=Number(params.get('day'));
    assert.ok(Number.isSafeInteger(day)&&day>=1&&day<=56&&
      params.get('day')===String(day),name+' canonical sporting day');
    assert.equal(item.method,'GET',name+' read-only preview');
   }
   assert.equal(new Set(previews.map(item=>item.search)).size,previews.length,name+' distinct days');
   assert.equal(apiCount(name),1+(permissionExpected?1:0)+expectedPreviews,name+' total API reads');
   observations.push({case:name,worldGets:count(name,'/api/world'),
    permissionGets:count(name,'/api/player/permissions'),matchPreviewGets:previews.length,
    totalApiGets:apiCount(name),distinctApiPaths:1+(permissionExpected?1:0)+(expectedPreviews?1:0)});
  };
  try{
   if(!authorized){
    for(const [path,name] of [['/','landing'],['/guide','guide']]){
     stage=name;
     const result=await page.goto(siteOrigin+path,{waitUntil:'domcontentloaded',timeout:30000});
     assert.equal(result?.status(),200,name+' document');
     await page.waitForTimeout(180);
     assert.equal(apiCount(name),0,name+' has no API GET: '+
      JSON.stringify(requests.filter(r=>r.stage===name)));
     observations.push({case:name,totalApiGets:0,distinctApiPaths:0});
    }
   }
   await document('/dashboard','dashboard-cold',1);
   if(authorized)
    await page.locator('#app-nav-admin').waitFor({state:'attached',timeout:10000});
   else
    await page.waitForFunction(()=>sessionStorage.getItem('fa:player:anonymous:v1')==='1');
   await document('/settings','settings-same-tab',0);
   if(!authorized){
    stage='settings-local-actions';
    await page.locator('#theme-light').click();
    await page.locator('#site-language').click();
    await page.locator('#language-it').click();
    await page.waitForFunction(()=>document.documentElement.lang==='it');
    assert.equal(apiCount(stage),0,'theme/language changes use no API');
    observations.push({case:stage,totalApiGets:0,distinctApiPaths:0});

    stage='search-first';
    const catalogue=page.waitForResponse(r=>
     new URL(r.url()).pathname==='/data/divisions.json'&&r.status()===200,{timeout:15000});
    await page.locator('#app-search-trigger').click();
    await catalogue;
    assert.equal(count(stage,'/data/divisions.json'),1,'one static search catalogue');
    assert.equal(apiCount(stage),0,'search has zero API GETs');
    await page.locator('#app-search-close').click();
    await page.waitForFunction(()=>document.querySelector('#app-search-dialog')?.open===false);
    stage='search-reopen';
    await page.locator('#app-search-trigger').click();
    await page.waitForTimeout(220);
    assert.equal(count(stage,'/data/divisions.json'),0,'reopening search reuses catalogue');
    assert.equal(apiCount(stage),0,'reopened search has no API GET');
    observations.push({case:'search',initialStaticGets:1,reopenStaticGets:0,totalApiGets:0,
     distinctApiPaths:0});

    stage='world-invalidation';
    const worldRead=waitWorld();
    await page.evaluate(()=>window.dispatchEvent(new Event('fa:world-invalidated')));
    await worldRead;await ready();
    assert.equal(count(stage,'/api/world'),1,'explicit invalidation reloads world');
    assert.equal(apiCount(stage),1,'invalidation does not refetch permission hint');
    observations.push({case:stage,totalApiGets:1,distinctApiPaths:1});

    stage='settings-reload';
    const worldReadReload=waitWorld(),permissionReload=waitPermission();
    const reload=await page.reload({waitUntil:'domcontentloaded',timeout:30000});
    assert.equal(reload?.status(),200,'settings reload document');
    await worldReadReload;await permissionReload;await ready();
    assert.equal(count(stage,'/api/world'),1,'reload world');
    assert.equal(count(stage,'/api/player/permissions'),1,'reload rechecks permission');
    assert.equal(apiCount(stage),2,'reload API count');
    observations.push({case:stage,totalApiGets:2,distinctApiPaths:2});
   }
   await document('/competitions','competitions-directory',0);
   await document('/dashboard','dashboard-return-cold',0);
   stage='back';
   const worldBack=waitWorld();
   await page.goBack({waitUntil:'commit',timeout:30000});
   await page.waitForURL(url=>url.pathname==='/competitions');
   await worldBack;await ready();
   await page.waitForTimeout(200);
   const bfcache=await page.evaluate(()=>
    (window.__faShellPageshow||[]).includes(true));
   assert.equal(count(stage,'/api/world'),1,'Back revalidates canonical world');
   assert.equal(count(stage,'/api/player/permissions'),0,'Back reuses validated UI hint');
   assert.equal(apiCount(stage),1,'Back API count');
   observations.push({case:'back',bfcacheHit:bfcache,totalApiGets:1,distinctApiPaths:1});
   if(!authorized){
    await document('/settings','settings-return',0);
    stage='profile-activation';
    const loginWorld=waitWorld();
    await page.locator('#app-nav-profile').click();
    await page.waitForURL(url=>url.pathname==='/account/login',{timeout:15000});
    await loginWorld;await ready();
    await page.waitForTimeout(150);
    assert.equal(count(stage,'/api/player/session'),0,'confirmed anonymous skips redundant session');
    assert.equal(count(stage,'/api/world'),1,'Login shell revalidates canonical public world');
    assert.equal(count(stage,'/api/player/permissions'),0,'Login does not repeat Admin hint');
    assert.equal(apiCount(stage),1,'anonymous Profile click loads Login shell world only');
    observations.push({case:stage,totalApiGets:1,distinctApiPaths:1,
     loginShellWorldGets:1,sessionGets:0});
   }
   assert.deepEqual(errors,[],'shared-shell JS errors '+engine+' '+(authorized?'authorized':'anonymous'));
  }finally{await context.close()}
 }
 const size={world:bytes(worldPayload),permissionGranted:bytes(grants),
  permissionDenied:bytes(denial)};
 mkdirSync('int24-browser-artifacts',{recursive:true});
 writeFileSync('int24-browser-artifacts/shared-shell-734-'+engine+'.json',
  JSON.stringify({scope:'browser network, intercepted synthetic auth/world responses; no real D1',
   syntheticResponseBytes:size,observations},null,2)+'\n');
 console.log('PERF-API-02 '+engine+' shared-shell HTTP evidence: '+
  JSON.stringify({syntheticResponseBytes:size,observations}));
 return observations.length;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {webkit}=await import('playwright');
 const browser=await webkit.launch({headless:true});
 try{await verifySharedShellNetwork(browser,{engine:'webkit'})}
 finally{await browser.close()}
}
