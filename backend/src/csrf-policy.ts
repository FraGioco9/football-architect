import {ApiError} from './errors.ts';
import {digestOpaqueToken} from './session-tokens.ts';

/** Shared digest verification only. Origin, roles and token namespaces remain distinct. */
export async function requireCsrfDigest(expectedDigest:string,token:string|null):Promise<void>{
 let actual='';
 try{actual=await digestOpaqueToken(token??'')}catch{throw new ApiError(403,'csrf_forbidden')}
 if(actual!==expectedDigest)throw new ApiError(403,'csrf_forbidden');
}
