import {ApiError} from './errors.ts';
import countries from '../../data/country-codes.json' with {type:'json'};

export function parseRegistrationProfile(input:Record<string,unknown>){
 const username=typeof input.username==='string'?input.username.trim():'';
 if(!/^[A-Za-z0-9_]{3,24}$/.test(username))throw new ApiError(422,'invalid_username');
 const nationality=input.nationality===undefined||input.nationality===null||input.nationality===''?null:input.nationality;
 if(nationality!==null&&(typeof nationality!=='string'||!countries.includes(nationality)))throw new ApiError(422,'invalid_nationality');
 const city=input.city===undefined||input.city===null?null:typeof input.city==='string'?input.city.trim():input.city;
 if(city!==null&&(typeof city!=='string'||[...city].length>100||/[\u0000-\u001f\u007f]/.test(city)))throw new ApiError(422,'invalid_city');
 return {username,nationality:nationality as string|null,city:(city||null) as string|null};
}
