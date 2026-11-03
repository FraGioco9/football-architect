declare module '*sporting-contract.js' {
 const contract:{
  readonly countries:readonly string[];
  readonly domestic:readonly string[];
  readonly international:readonly string[];
  readonly competitionIds:readonly string[];
  readonly cups:Readonly<Record<string,string>>;
  readonly versions:readonly string[];
  rulesVersion(id:string):string|null;
  finalEvent(id:string):string|null;
 };
 export default contract;
}
