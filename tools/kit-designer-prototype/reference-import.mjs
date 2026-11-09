// Local-only mannequin asset checks. No network requests, uploads or persistence.
export const MAX_PREVIEW_BYTES=40*1024*1024;
export function validateLocalModelFile(file){
  if(!file||typeof file.name!=="string"||typeof file.size!=="number"){
    throw new Error("Select an exported .glb or .obj model.");
  }
  const extension=file.name.split(".").pop().toLowerCase();
  if(extension!=="glb"&&extension!=="obj"){
    throw new Error("Use a self-contained GLB or OBJ file (not a shared scene link).");
  }
  if(!Number.isSafeInteger(file.size)||file.size<=0||file.size>MAX_PREVIEW_BYTES){
    throw new Error("The model file must be nonempty and at most 40 MB.");
  }
  return extension;
}
export function validateStandaloneGLB(buffer){
  if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<20){
    throw new Error("Invalid GLB header.");
  }
  const view=new DataView(buffer);
  if(view.getUint32(0,true)!==0x46546c67 ||
     view.getUint32(4,true)!==2 ||
     view.getUint32(8,true)!==buffer.byteLength){
    throw new Error("Expected a complete binary glTF 2.0 file.");
  }
  const length=view.getUint32(12,true);
  const chunkType=view.getUint32(16,true);
  if(chunkType!==0x4e4f534a||length<=0||length+20>buffer.byteLength){
    throw new Error("Missing the embedded GLB JSON chunk.");
  }
  let data;
  try {
    data=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,length)));
  } catch {
    throw new Error("Invalid GLB JSON data.");
  }
  // An imported local file must not instruct GLTFLoader to fetch another file
  // or a remote URL. Embedded data: URIs and bufferViews are permitted.
  const resources=[...(data.buffers||[]),...(data.images||[])];
  for(const resource of resources){
    if(typeof resource.uri==="string"&&!resource.uri.startsWith("data:")){
      throw new Error("GLB references an external resource. Export a self-contained model.");
    }
  }
  return data;
}
