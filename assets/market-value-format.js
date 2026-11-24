/* #763: integer ARC display, never a browser-side valuation calculation. */
((root,factory)=>{
 const ui=factory();root.faMarketValue=ui;
 if(typeof module!=='undefined'&&module.exports)module.exports=ui;
})(typeof window!=='undefined'?window:globalThis,()=>{
 const words={
  en:['Market value','Estimated remaining agent commissions (DRAFT benchmark)'],
  it:['Valore di mercato','Commissioni future stimate dell’agente (modello provvisorio)'],
  de:['Marktwert','Geschätzte verbleibende Vermittlerprovisionen (Entwurf)'],
  es:['Valor de mercado','Comisiones futuras estimadas del agente (modelo provisional)'],
  fr:['Valeur marchande','Commissions restantes estimées de l’agent (modèle provisoire)']
 };
 const copy=lang=>words[lang]||words.en;
 return Object.freeze({label:lang=>copy(lang)[0],help:lang=>copy(lang)[1],
  format:(value,lang='en')=>Number.isSafeInteger(value)&&value>=0?new Intl.NumberFormat(lang,{useGrouping:'always'}).format(value)+' ARC':'—'});
});
