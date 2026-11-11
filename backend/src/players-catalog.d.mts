export interface GivenBank{values:string[];cumulative:number[];total:number}
export interface PlayerCatalog {given:Map<string,GivenBank>;surnames:Map<string,string[]>;surnameSource:string}
export function loadRuntimePlayerCatalog():PlayerCatalog;
