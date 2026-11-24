/** Local-only explicit maintenance. Does not migrate, deploy or access remote D1. */
import {resolve} from 'node:path';
import {openLocalDatabase} from './operator-local.mts';
import {refreshMarketValueIndexBatch} from '../src/player-market-value-index.ts';

const args=process.argv.slice(2);
if(args.length!==3||args[0]!=='--state'||args[2]!=='--confirm-local-refresh')
 throw Error('Usage: node --experimental-strip-types tools/refresh-player-market-values.mts --state <existing-local-state-directory> --confirm-local-refresh');
const handle=await openLocalDatabase(resolve(args[1]),{requireExisting:true,migrate:false});
try{
 let total=0;
 // A finite bound per invocation; retry safely if the database changes.
 for(let batch=0;batch<1000;batch++){
  const result=await refreshMarketValueIndexBatch(handle.db);total+=result.updated;
  if(result.ready){console.log(JSON.stringify({updated:total,ready:true}));break;}
  if(result.selected===0||result.updated===0||batch===999)throw Error('market_value_refresh_incomplete_retry');
 }
}finally{await handle.close();}
