/** QOL02 official career facade. Only view projections; never mutate monetary balances. */
import {t,formatNumber,formatDate,plural,formatStanding,normalizeLanguage,auditCatalog} from '../addons/domain/localization.mjs';
import {currencyForCountry,convertMinor,formatMoney,FX_POLICY_VERSION} from '../addons/domain/currency.mjs';
import {renderNotification,makeEvent,validateNotification} from '../addons/domain/localized-events.mjs';

export const OFFICIAL_LOCALE_VERSION=1;
/** Browser-local display of the already-stored ISO timestamp, without rewriting the save. */
export function displayCareerTimestamp(iso,{lang='it'}={}){
 lang=normalizeLanguage(lang);
 if(typeof iso!=='string'||iso.length>40||!Number.isFinite(Date.parse(iso)))throw Error('QOL02_CAREER_DATE');
 return new Intl.DateTimeFormat(lang==='en'?'en-GB':'it-IT',{dateStyle:'short',timeStyle:'short'}).format(new Date(iso));
}
export {formatNumber,formatDate,plural,formatStanding,auditCatalog,FX_POLICY_VERSION};
const countryToCurrency=c=>currencyForCountry(c??'IT');
export function currencyOfCareer(countryId){return countryToCurrency(countryId);}
/** Career balances are historic integer EUR major units, NOT kit EUR cents. */
export function displayCareerMoney(majorEUR,{countryId='IT',lang='it',compact=true}={}){
 lang=normalizeLanguage(lang);
 if(typeof majorEUR!=='number'||!Number.isFinite(majorEUR)||Math.abs(majorEUR)>9e10)throw Error('QOL02_CAREER_MONEY');
 const euroCents=Math.round(majorEUR*100),code=countryToCurrency(countryId),minor=convertMinor(euroCents,'EUR',code);
 if(!compact||Math.abs(minor)<100000)return formatMoney(minor,code,{lang});
 const value=minor/100,symbol=code==='GBP'?'£':code==='BRL'?'R$':'€';
 const unit=Math.abs(value)>=1e6?1e6:1000,suffix=unit===1e6?'M':'k';
 return `${formatNumber(value/unit,{lang,maximumFractionDigits:1})} ${suffix}${symbol}`;
}
/** Only structured future messages can be fully retranslated. Preserve legacy bodies verbatim. */
export function readCareerMessage(message,{lang='it',countryId='IT'}={}){
 normalizeLanguage(lang);
 if(!message||typeof message!=='object')throw Error('QOL02_CAREER_MESSAGE');
 if(!message.localeEvent)return {subject:message.subject,text:message.text,structured:false};
 const event=message.localeEvent;
 validateNotification(event);
 if(event.id!==message.id)throw Error('QOL02_CAREER_MESSAGE_ID');
 const rendered=renderNotification(event,{lang,currencyCountry:countryId});
 const subjectKey=`mail.subject.${event.type}`;
 return {subject:t(subjectKey,{},lang),text:rendered.text,structured:true};
}
export function makeCareerMessageEvent(mailId,type,params,round){
 return makeEvent({id:mailId,type,params,day:round});
}
export function validCareerMessages(items){
 if(!Array.isArray(items))return false;
 try{return items.every(m=>!m.localeEvent||(validateNotification(m.localeEvent)&&m.localeEvent.id===m.id&&m.localeEvent.schemaVersion===1));}
 catch{return false;}
}
