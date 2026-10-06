/** UX2-00 — Progressive semantics for existing screens.
 * Idempotent, DOM-only, never reads/writes career state or browser storage.
 * Legacy and addon tables are enhanced without changing their event handlers.
 */
export function enhanceDesignSystem(root,language='it'){
  const en=language==='en';
  for(const table of root.querySelectorAll('.data-table')){
    const region=table.closest('.table-scroll');
    if(region){
      if(!region.hasAttribute('role'))region.setAttribute('role','region');
      if(!region.hasAttribute('tabindex'))region.setAttribute('tabindex','0');
      if(!region.hasAttribute('aria-label')&&!region.hasAttribute('aria-labelledby')){
        const heading=region.closest('.panel')?.querySelector('.panel-head h2,h2,h3');
        const name=heading?.textContent?.trim();
        region.setAttribute('aria-label',name||(en?'Data table':'Tabella dati'));
      }
    }
    for(const th of table.querySelectorAll('thead th'))if(!th.hasAttribute('scope'))th.setAttribute('scope','col');
  }
  for(const empty of root.querySelectorAll('.empty-state')){
    if(!empty.hasAttribute('role'))empty.setAttribute('role','status');
  }
}
