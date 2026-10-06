/** QOL02.04: Stable fictional rates for eight leagues (never request external FX).
 * EUR is the canonical accounting unit. Values are safe integer euro cents;
 * display conversions do not round-trip into the ledger balance.
 */
export const FX_POLICY_VERSION='FA-FIXED-2026-01';
export const COUNTRY_CURRENCIES=Object.freeze({IT:'EUR',ENG:'GBP',ESP:'EUR',GER:'EUR',FRA:'EUR',NED:'EUR',POR:'EUR',BEL:'EUR',BRA:'BRL',BR:'BRL',ES:'EUR',DE:'EUR',FR:'EUR',NL:'EUR',PT:'EUR'});
// A fictional fixed internal policy: 100 euro cents -> 86 pound pence.
const rates=Object.freeze({EUR:Object.freeze({n:1n,d:1n}),GBP:Object.freeze({n:86n,d:100n}),BRL:Object.freeze({n:560n,d:100n})});
const MAX=9_000_000_000_000; // within safe integer and Intl exact-cent display on practical balances
const bad=code=>{throw Error(`QOL02_FX_${code}`);};
const fingerprint=text=>{let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619)>>>0;return hash;}; // corruption check, not authentication
function integerMinor(n){if(!Number.isSafeInteger(n)||Math.abs(n)>MAX)bad('AMOUNT');return n;}
function currency(code){if(typeof code!=='string'||!Object.hasOwn(rates,code))bad('CURRENCY');return code;}
export function currencyForCountry(code){if(typeof code!=='string'||!Object.hasOwn(COUNTRY_CURRENCIES,code))bad('COUNTRY');return COUNTRY_CURRENCIES[code];}
// Round half to even, including debts; no binary float is used.
export function roundRational(numerator,denominator){
 if(typeof numerator!=='bigint'||typeof denominator!=='bigint'||denominator<=0n)bad('RATIONAL');
 const sign=numerator<0n?-1n:1n,n=numerator<0n?-numerator:numerator,q=n/denominator,r=n%denominator;
 return sign*(q+(2n*r>denominator||2n*r===denominator&&q%2n===1n?1n:0n));
}
export function convertMinor(minor,fromCurrency,toCurrency){
 integerMinor(minor);currency(fromCurrency);currency(toCurrency);
 const a=rates[fromCurrency],b=rates[toCurrency];
 const result=roundRational(BigInt(minor)*a.d*b.n,a.n*b.d);
 if(result>BigInt(MAX)||result< -BigInt(MAX))bad('OVERFLOW');return Number(result);
}
export function formatMoney(minor,code,{lang='it'}={}){
 integerMinor(minor);currency(code);
 if(!['it','en','it-IT','en-GB'].includes(lang))bad('LANG');
 // Max value fits <=9e10 major units, exact to cents when formatted from safe integer minor.
 return new Intl.NumberFormat(lang.startsWith('en')?'en-GB':'it-IT',{style:'currency',currency:code,currencyDisplay:'symbol',minimumFractionDigits:2,maximumFractionDigits:2}).format(minor/100);
}
export function localMoneyFromBase(baseMinor,country){
 integerMinor(baseMinor);const code=currencyForCountry(country);
 return Object.freeze({currency:code,minor:convertMinor(baseMinor,'EUR',code),canonicalMinorEUR:baseMinor,fxVersion:FX_POLICY_VERSION});
}
export function quoteMovement({id,baseMinorEUR,fromCountry,toCountry}={}){
 if(typeof id!=='string'||id.length<1||id.length>90||!/^[-\w:.]+$/.test(id)||['__proto__','constructor','prototype'].includes(id))bad('ID');
 integerMinor(baseMinorEUR);if(baseMinorEUR<0)bad('NEGATIVE_TRANSFER');
 const source=localMoneyFromBase(baseMinorEUR,fromCountry),target=localMoneyFromBase(baseMinorEUR,toCountry);
 const data={schemaVersion:1,id,baseMinorEUR,fromCountry,toCountry,source,target,policy:FX_POLICY_VERSION};
 return Object.freeze({...data,digest:fingerprint(JSON.stringify(data))});
}
export function validateMovement(m){
 if(!m||m.schemaVersion!==1||m.policy!==FX_POLICY_VERSION)bad('MOVEMENT_SCHEMA');
 const test=quoteMovement({id:m.id,baseMinorEUR:m.baseMinorEUR,fromCountry:m.fromCountry,toCountry:m.toCountry});
 if(JSON.stringify(test)!==JSON.stringify(m))bad('MOVEMENT_TAMPER');
 return true;
}
export function appendMovement(ledger,m){
 if(!Array.isArray(ledger)||ledger.length>20000)bad('LEDGER');validateMovement(m);
 if(ledger.some(x=>{validateMovement(x);return x.id===m.id;})){
  const previous=ledger.find(x=>x.id===m.id);
  if(JSON.stringify(previous)!==JSON.stringify(m))bad('DUPLICATE_CONFLICT');return structuredClone(ledger);
 }
 return [...structuredClone(ledger),structuredClone(m)];
}
export function ledgerBaseTotal(ledger){
 if(!Array.isArray(ledger))bad('LEDGER');let total=0n;
 for(const m of ledger){validateMovement(m);total+=BigInt(m.baseMinorEUR);}
 if(total>BigInt(MAX))bad('OVERFLOW');return Number(total);
}
