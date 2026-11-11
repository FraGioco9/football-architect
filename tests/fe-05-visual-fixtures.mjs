// FE-05: deliberately bounded, pairwise visual samples. No live sporting fixture is fabricated.
export const visualProfiles=Object.freeze([
  {id:'landing',path:'/',site:true,width:320,height:844,language:'en',theme:'dark',frame:'.site-header',ready:'.site-header'},
  {id:'dashboard',path:'/dashboard',width:1440,height:900,language:'it',theme:'light',frame:'.fa-shell-topbar',ready:'.fa-shell-topbar'},
  {id:'standings',path:'/competitions/it-1/standings?season=1',width:320,height:844,language:'en',theme:'dark',frame:'.app-competition-tabs',ready:'#competition-tab-standings',tabs:7},
  {id:'domestic-fixtures',path:'/competitions/it-1/fixtures?season=1',width:390,height:844,language:'fr',theme:'light',frame:'.app-competition-tabs',ready:'#competition-tab-fixtures',tabs:7},
  {id:'international-postseason',path:'/competitions/int-1/postseason?season=1',width:768,height:900,language:'es',theme:'dark',frame:'#app-postseason-bracket',ready:'#app-postseason-bracket',tabs:7},
  {id:'club-overview',path:'/clubs/it/1/overview',width:390,height:844,language:'de',theme:'dark',frame:'.club-tabs',ready:'.club-tabs',tabs:5},
  {id:'club-roster',path:'/clubs/it/1/roster',width:768,height:900,language:'it',theme:'light',frame:'.club-tabs',ready:'.club-tabs',tabs:5},
  {id:'clubs-directory',path:'/clubs',width:768,height:900,language:'es',theme:'light',frame:'.nav01-filters',ready:'.nav01-filters'},
  {id:'calendar',path:'/calendar?calendarView=week',width:320,height:844,language:'it',theme:'dark',frame:'#calendar-controls',ready:'#calendar-controls'},
  {id:'login',path:'/account/login/',width:390,height:844,language:'es',theme:'light',frame:'.fa-shell-topbar',ready:'.account-body input'},
  {id:'admin-anonymous',path:'/admin',width:1440,height:900,language:'en',theme:'dark',frame:'.fa-shell-topbar',ready:'.fa-shell-topbar'}
]);

export function frameDrift(before,after,{geometryTolerance=1.5}={}){
  if(!before||!after)return [{field:'missing',before,after}];
  const issues=[];
  for(const field of ['width','height','x','y']){
    if(!Number.isFinite(before[field])||!Number.isFinite(after[field])||Math.abs(before[field]-after[field])>geometryTolerance){
      issues.push({field,before:before[field],after:after[field]});
    }
  }
  for(const field of ['display','visibility','fontSize','fontWeight','backgroundColor','color','borderRadius']){
    if(before[field]!==after[field])issues.push({field,before:before[field],after:after[field]});
  }
  return issues;
}

export function screenshotBudget(width,height,{fraction=0.002}={}){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw Error('Invalid screenshot geometry');
  if(!Number.isFinite(fraction)||fraction<0||fraction>0.01)throw Error('Unsafe screenshot tolerance');
  return Math.max(1,Math.floor(width*height*fraction));
}

export const visualOrigins=Object.freeze({site:'http://localhost:2000',app:'http://app.localhost:2000'});
