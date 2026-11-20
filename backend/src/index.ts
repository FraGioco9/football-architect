import {readMatchDirectory} from './public-match-directory.ts';
import {httpJson,routeMethod} from './http-contract.ts';
import {assertEnvironmentPool,resolveAccountConfiguration} from './environment-pool.ts';
import {handleAdmin,type AdminEnv} from './http-admin.ts';
import {handlePlayer,type PlayerEnv} from './http-player.ts';
import {cloudflareEmailDeliveries,type CloudflareDeliveryEnv} from './cloudflare-email-delivery.ts';
import {gmailEmailDeliveries,type GmailDeliveryEnv} from './gmail-email-delivery.ts';
import {localInboxDeliveries,handleLocalInbox,type LocalInboxEnv} from './local-dev-inbox.ts';
import { ApiError } from './errors.ts';
import {requireDatabase} from './database.ts';
import {readPublicRosterStats,readPublicSportingSeasonLineupV1 as readPublicSportingSeason,readPublicCalendarDayLineupV1 as readPublicCalendarDay,readPublicClubHistoryLineupV1 as readPublicClubHistory,readPublicClubFixturesLineupV1 as readPublicClubFixtures} from './public-sporting-read-lineup-v1.ts';
import { projectWorld } from './public-projections.ts';
import {readPublicPlayers,readPublicPlayer} from './public-players-read.ts';
import {readPublicPlayerStatsLineupV1,readPublicPlayerMatchesLineupV1} from './public-sporting-read-lineup-v1.ts';
import {readPublicClubRoster} from './public-club-roster-read.ts';
import {readPublicMatchLineupV1 as readPublicMatch,readPublicMatchStatisticsV1,readPublishedCompetitionMatchesLineupV1 as readPublishedCompetitionMatches,readPublishedClubFixturesBeforeCalendarLineupV1 as readPublishedClubFixturesBeforeCalendar} from './public-match-read-lineup-v1.ts';
import {parsePublicPlayerQuery} from './public-players-filters.mjs';
import { readWorld, type WorldDatabase } from './world-repository.ts';

export interface Env extends AdminEnv, PlayerEnv, CloudflareDeliveryEnv, GmailDeliveryEnv, LocalInboxEnv {
  DB?: WorldDatabase;
}

const json=(status:number,payload:unknown)=>httpJson('public',status,payload);

/**
 * Anonymous public read and separately configured, server-authorized Admin routes.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // A Dev bridge cannot accidentally dispatch credentials or commands to Production.
    const expected=request.headers.get('X-FA-Expected-Pool');
    if(expected!==null&&(expected!=='dev-preview'||env.PLAYER_MODE!=='preview'))return json(503,{error:{code:'environment_unavailable'}});
    if(url.pathname==='/api/local-dev/inbox')return handleLocalInbox(request,env);
    if(url.pathname==='/api/environment'){
      const denied=routeMethod(request,'GET','public',false);if(denied)return denied;
      try{
        if(env.PLAYER_MODE!=='preview'||url.search)throw new ApiError(503,'environment_unavailable');
        const c=await resolveAccountConfiguration(request,env,'environment_unavailable');
        return json(200,{schemaVersion:1,pool:'dev-preview',origin:c.origin,sharedWorld:true,separateSignIn:true});
      }catch{return json(503,{error:{code:'environment_unavailable'}})}
    }
    if(url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/api/player/')&&!url.pathname.startsWith('/api/admin/')){
      try{await assertEnvironmentPool(env)}catch{return json(503,{error:{code:'environment_unavailable'}})}
    }
    if (url.pathname === '/api/world') {
      const denied=routeMethod(request,'GET','public',false);if(denied)return denied;
      try {
        return json(200, { world: projectWorld(await readWorld(env.DB)) });
      } catch (error) {
        if (error instanceof ApiError) return json(error.status, { error: { code: error.code } });
        return json(503, { error: { code: 'world_unavailable' } });
      }
    }
    if(url.pathname==='/api/matches'){
      const denied=routeMethod(request,'GET','public',false);if(denied)return denied;
      const query=url.searchParams,season=query.get('season')??'',day=query.get('day')??'';
      if(query.size!==2||!/^[1-9][0-9]{0,8}$/.test(season)||!/^(?:[1-9]|[1-4][0-9]|5[0-6])$/.test(day))
        return json(422,{error:{code:'invalid_public_request'}});
      try{return json(200,await readMatchDirectory(requireDatabase(env.DB),Number(season),Number(day)))}
      catch(error){
        if(error instanceof ApiError&&error.code==='stale_world')return json(409,{error:{code:error.code}});
        return json(503,{error:{code:'match_unavailable'}});
      }
    }
    const matchList=url.pathname.match(/^\/api\/matches\/seasons\/([1-9][0-9]*)\/competitions\/((?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12]))$/);
    if(matchList){
      const denied=routeMethod(request,'GET','public',false);if(denied)return denied;
      if(url.search)return json(422,{error:{code:'invalid_public_request'}});
      try{return json(200,await readPublishedCompetitionMatches(requireDatabase(env.DB),Number(matchList[1]),matchList[2]))}
      catch(error){
        if(error instanceof ApiError&&(error.code==='not_found'||error.code==='stale_world'))
         return json(error.status,{error:{code:error.code}});
        return json(503,{error:{code:'match_unavailable'}});
      }
    }
    const matchStatistics=url.pathname.match(/^\/api\/matches\/([1-9][0-9]*)\/stats$/);
    if(matchStatistics){
      const denied=routeMethod(request,'GET','public',false);if(denied)return denied;
      if(url.search)return json(422,{error:{code:'invalid_public_request'}});
      try{return json(200,await readPublicMatchStatisticsV1(requireDatabase(env.DB),matchStatistics[1]))}
      catch(error){
        if(error instanceof ApiError&&(error.code==='not_found'||error.code==='stale_world'))return json(error.status,{error:{code:error.code}});
        return json(503,{error:{code:'match_unavailable'}});
      }
    }
    const matchDetail=url.pathname.match(/^\/api\/matches\/([1-9][0-9]*)$/);
    if(matchDetail){
      const denied=routeMethod(request,'GET','public',false);if(denied)return denied;
      if(url.search)return json(422,{error:{code:'invalid_public_request'}});
      try{return json(200,await readPublicMatch(requireDatabase(env.DB),matchDetail[1]))}
      catch(error){
        if(error instanceof ApiError&&(error.code==='not_found'||error.code==='stale_world'))
         return json(error.status,{error:{code:error.code}});
        return json(503,{error:{code:'match_unavailable'}});
      }
    }
    const playerMatches=url.pathname.match(/^\/api\/players\/([1-9][0-9]*)\/matches$/);
    if(playerMatches){
      const denied=routeMethod(request,'GET','public',false);if(denied)return denied;
      if(!Number.isSafeInteger(Number(playerMatches[1])))
        return json(422,{error:{code:'invalid_public_request'}});
      const params=url.searchParams,keys=[...params.keys()];
      if(keys.some(key=>!['season','competition','limit','cursor'].includes(key))||
         new Set(keys).size!==keys.length)return json(422,{error:{code:'invalid_public_request'}});
      const seasonParam=params.get('season')??'all';
      const competition=params.get('competition')??'all';
      const limitParam=params.get('limit')??'20';
      const cursor=params.get('cursor');
      if(!(seasonParam==='all'||/^[1-2]$/.test(seasonParam))||
         !(competition==='all'||/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/.test(competition))||
         !/^[1-9][0-9]?$/.test(limitParam)||Number(limitParam)>50||
         cursor!==null&&(!cursor||cursor.length>512))
        return json(422,{error:{code:'invalid_public_request'}});
      try{return json(200,await readPublicPlayerMatchesLineupV1(requireDatabase(env.DB),Number(playerMatches[1]),{
       season:seasonParam==='all'?'all':Number(seasonParam),competition,cursor,limit:Number(limitParam)}))}
      catch(error){
        if(error instanceof ApiError&&['invalid_public_request','player_not_found','stale_world'].includes(error.code))
          return json(error.status,{error:{code:error.code}});
        return json(503,{error:{code:'player_matches_unavailable'}});
      }
    }
    const playerStats=url.pathname.match(/^\/api\/players\/([1-9][0-9]*)\/stats$/);
    if(playerStats){
      const denied=routeMethod(request,'GET','public',false);if(denied)return denied;
      if(url.search||!Number.isSafeInteger(Number(playerStats[1])))
        return json(422,{error:{code:'invalid_public_request'}});
      try{return json(200,await readPublicPlayerStatsLineupV1(requireDatabase(env.DB),Number(playerStats[1])))}
      catch(error){
        if(error instanceof ApiError&&['player_not_found','stale_world'].includes(error.code))
          return json(error.status,{error:{code:error.code}});
        return json(503,{error:{code:'player_stats_unavailable'}});
      }
    }
    const playerDetail=url.pathname.match(/^\/api\/players\/([1-9][0-9]*)$/);
    if(playerDetail){
      const denied=routeMethod(request,'GET','public',false);if(denied)return denied;
      if(url.search||!Number.isSafeInteger(Number(playerDetail[1])))return json(422,{error:{code:'invalid_public_request'}});
      try{return json(200,await readPublicPlayer(requireDatabase(env.DB),Number(playerDetail[1])))}
      catch(error){
        if(error instanceof ApiError&&(error.code==='player_not_found'||error.code==='stale_world'))
          return json(error.status,{error:{code:error.code}});
        return json(503,{error:{code:'players_unavailable'}});
      }
    }
    if(url.pathname==='/api/players'){
      const denied=routeMethod(request,'GET','public',false);if(denied)return denied;
      let query;
      try{query=parsePublicPlayerQuery(url.search)}
      catch{return json(422,{error:{code:'invalid_public_request'}})}
      try{return json(200,await readPublicPlayers(requireDatabase(env.DB),query.page,query.filters))}
      catch(error){
        if(error instanceof ApiError&&error.code==='stale_world')return json(409,{error:{code:'stale_world'}});
        return json(503,{error:{code:'players_unavailable'}});
      }
    }
    const rosterStats=url.pathname.match(/^\/api\/clubs\/((?:IT|ENG|ES|DE|FR|PT|NL|BR)-(?:[1-9]|[1-3][0-9]|40))\/roster\/stats$/);
    if(rosterStats){
      const denied=routeMethod(request,'GET','public',false);if(denied)return denied;
      if(url.search&&!/^\?season=(0|[1-9][0-9]{0,8})$/.test(url.search))return json(422,{error:{code:'invalid_public_request'}});
      try{return json(200,await readPublicRosterStats(requireDatabase(env.DB),rosterStats[1],url.search?Number(url.searchParams.get('season')):null))}
      catch(error){if(error instanceof ApiError&&error.code==='stale_world')return json(409,{error:{code:error.code}});
        return json(503,{error:{code:'roster_unavailable'}});}
    }
    const roster=url.pathname.match(/^\/api\/clubs\/([^/]+)\/roster$/);
    if(roster){
      const denied=routeMethod(request,'GET','public',false);if(denied)return denied;
      if(url.search)return json(422,{error:{code:'invalid_public_request'}});
      try{return json(200,await readPublicClubRoster(requireDatabase(env.DB),roster[1]))}
      catch(error){
        if(error instanceof ApiError&&['club_not_found','stale_world'].includes(error.code))
         return json(error.status,{error:{code:error.code}});
        return json(503,{error:{code:'roster_unavailable'}});
      }
    }
    const sporting=url.pathname.match(/^\/api\/competitions\/((?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12]))\/seasons\/([1-9][0-9]*)$/);
    if(sporting){
      const denied=routeMethod(request,'GET','public',false);if(denied)return denied;
      if(url.search||!Number.isSafeInteger(Number(sporting[2])))return json(422,{error:{code:'invalid_public_request'}});
      try{return json(200,await readPublicSportingSeason(requireDatabase(env.DB),sporting[1],Number(sporting[2])))}
      catch(error){
        if(error instanceof ApiError&&error.code==='stale_world')return json(409,{error:{code:'stale_world'}});
        return json(503,{error:{code:'sporting_data_unavailable'}});
      }
    }
    // One canonical, read-only club-season fixture projection.
    const clubFixtures=url.pathname.match(/^\/api\/clubs\/((?:IT|ENG|ES|DE|FR|PT|NL|BR)-(?:[1-9]|[1-3][0-9]|40))\/seasons\/([1-9][0-9]*)\/fixtures$/);
    if(clubFixtures){
      const denied=routeMethod(request,'GET','public',false);if(denied)return denied;
      if(url.search||!Number.isSafeInteger(Number(clubFixtures[2])))return json(422,{error:{code:'invalid_public_request'}});
      try{
        const db=requireDatabase(env.DB),clubKey=clubFixtures[1],season=Number(clubFixtures[2]);
        const projection=await readPublicClubFixtures(db,clubKey,season);
        if(projection.status==='empty'&&projection.reason==='calendar-unpublished'){
          const draw=await readPublishedClubFixturesBeforeCalendar(db,clubKey,season);
          if(draw.fixtures.length){
            if(draw.world.generation!==projection.world.generation||
               draw.world.revision!==projection.world.revision||
               draw.world.seasonNumber!==projection.world.seasonNumber||
               draw.world.day!==projection.world.day||draw.world.phase!==projection.world.phase)
              throw new ApiError(409,'stale_world');
            return json(200,{...projection,status:'partial',reason:null,
              provenance:{kind:'authoritative',resultAuthority:'published-draw-v1',
                sourceRef:'club-fixtures-draw:'+projection.world.generation+':season:'+season+':'+draw.sourceHash},
              data:{season,seasonState:{day:projection.world.day,phase:projection.world.phase},
                competitions:draw.competitions,fixtures:draw.fixtures}});
          }
        }
        return json(200,projection);
      }
      catch(error){
        if(error instanceof ApiError&&error.code==='stale_world')return json(409,{error:{code:'stale_world'}});
        return json(503,{error:{code:'sporting_data_unavailable'}});
      }
    }
    // All verified seasons for a single club in one anonymous read-only response.
    // Keep source authority on the backend; no client fan-out to competitions.
    const clubHistory=url.pathname.match(/^\/api\/clubs\/((?:IT|ENG|ES|DE|FR|PT|NL|BR)-(?:[1-9]|[1-3][0-9]|40))\/history$/);
    if(clubHistory){
      const denied=routeMethod(request,'GET','public',false);if(denied)return denied;
      if(url.search)return json(422,{error:{code:'invalid_public_request'}});
      try{return json(200,await readPublicClubHistory(requireDatabase(env.DB),clubHistory[1]))}
      catch(error){
        if(error instanceof ApiError&&error.code==='stale_world')return json(409,{error:{code:'stale_world'}});
        return json(503,{error:{code:'sporting_data_unavailable'}});
      }
    }
    const calendar=url.pathname.match(/^\/api\/calendar\/seasons\/([1-9][0-9]*)\/days\/([1-9][0-9]?)$/);
    if(calendar){
      if(Number(calendar[2])>56)return json(404,{error:{code:'not_found'}});
      const denied=routeMethod(request,'GET','public',false);if(denied)return denied;
      if(url.search||!Number.isSafeInteger(Number(calendar[1])))return json(422,{error:{code:'invalid_public_request'}});
      try{return json(200,await readPublicCalendarDay(requireDatabase(env.DB),Number(calendar[1]),Number(calendar[2])))}
      catch(error){
        if(error instanceof ApiError&&error.code==='stale_world')return json(409,{error:{code:'stale_world'}});
        return json(503,{error:{code:'sporting_data_unavailable'}});
      }
    }
    if (url.pathname === '/api/player' || url.pathname.startsWith('/api/player/')) {
      const delivery=env.PLAYER_MODE==='local'?localInboxDeliveries(env):env.PLAYER_EMAIL_DELIVERY_ENABLED==='gmail-preview'?gmailEmailDeliveries(env):cloudflareEmailDeliveries(env);
      return handlePlayer(request,{
        ...env,
        PLAYER_VERIFICATION_DELIVERY:env.PLAYER_VERIFICATION_DELIVERY??delivery.verification,
        PLAYER_RESET_DELIVERY:env.PLAYER_RESET_DELIVERY??delivery.reset
      });
    }
    // Admin access requires explicit configuration, durable authorization and CSRF.
    if (url.pathname === '/api/admin' || url.pathname.startsWith('/api/admin/'))
      return handleAdmin(request,env);
    return json(404, { error: { code: 'not_found' } });
  },
};
