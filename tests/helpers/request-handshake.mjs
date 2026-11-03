// Synchronize on route-handler entry rather than polling for an arbitrary time.
export function requestHandshake(scenario,timeoutMs=10000){
 let arrive;
 const ready=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Fixture request did not reach handler: '+scenario)),timeoutMs);
  arrive=value=>{clearTimeout(timer);resolve(value)};
 });
 // A prior browser assertion may abort before awaiting; keep that original error.
 // Awaiting ready still rejects if this handler never arrives.
 ready.catch(()=>{});
 return {ready,arrive};
}
