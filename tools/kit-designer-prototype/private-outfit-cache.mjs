// KM-35: Owner-provided private kit file lives ONLY in this browser's
// origin-scoped IndexedDB. No upload, network request or public Git asset.
const DATABASE='fa-dev-kit-maker-private-outfit-v1';
const STORE='private-outfit';
const KEY='original-glb';
const MAX_BYTES=100*1024*1024;
function openDatabase(databaseApi=globalThis.indexedDB){
  if(!databaseApi?.open)return Promise.resolve(null);
  return new Promise((resolve,reject)=>{
    const request=databaseApi.open(DATABASE,1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE);
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||Error('Private browser storage unavailable'));
    request.onblocked=()=>reject(Error('Private browser storage blocked'));
  });
}
async function operate(mode,run,databaseApi){
  const db=await openDatabase(databaseApi);
  if(!db)throw Error('Browser storage unavailable; enable IndexedDB for Kit Maker');
  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,mode);
      let value;
      const request=run(tx.objectStore(STORE));
      request.onsuccess=()=>{value=request.result;};
      request.onerror=()=>reject(request.error||Error('Private outfit storage request failed'));
      tx.oncomplete=()=>resolve(value); // Confirm commit before reloading the page.
      tx.onerror=()=>reject(tx.error||Error('Private outfit storage transaction failed'));
      tx.onabort=()=>reject(tx.error||Error('Private outfit storage transaction aborted'));
    });
  }finally{db.close();}
}
function looksLikeGlb(bytes){
  if(!(bytes instanceof ArrayBuffer)||bytes.byteLength<20||
      bytes.byteLength>MAX_BYTES)return false;
  const view=new DataView(bytes);
  return view.getUint32(0,true)===0x46546c67&&
    view.getUint32(4,true)===2&&
    view.getUint32(8,true)===bytes.byteLength;
}
export async function cachePrivateOutfit(bytes,databaseApi=globalThis.indexedDB){
  if(!looksLikeGlb(bytes))throw Error('Select a valid standalone glTF v2 .glb file (maximum 100 MB)');
  await operate('readwrite',store=>store.put(new Blob([bytes],{
    type:'model/gltf-binary'
  }),KEY),databaseApi);
}
export async function readCachedPrivateOutfit(databaseApi=globalThis.indexedDB){
  try{
    const blob=await operate('readonly',store=>store.get(KEY),databaseApi);
    if(!blob||typeof blob.arrayBuffer!=='function')return null;
    const bytes=await blob.arrayBuffer();
    return looksLikeGlb(bytes)?bytes:null;
  }catch{return null;}
}
export async function clearCachedPrivateOutfit(databaseApi=globalThis.indexedDB){
  await operate('readwrite',store=>store.delete(KEY),databaseApi);
}
