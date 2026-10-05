import {adapters as AB} from './adapters/a-b.mjs';
import {adapters as CD} from './adapters/c-d.mjs';
import {adapters as EG} from './adapters/e-g.mjs';
import {adapters as HI} from './adapters/h-i.mjs';

export const adapters={...AB,...CD,...EG,...HI};

export function validateAdapterRegistry(manifest){
  const declared=manifest.checks.map(x=>x.code);
  const implemented=Object.keys(adapters).sort();
  const missing=declared.filter(code=>typeof adapters[code]!=='function');
  const extra=implemented.filter(code=>!declared.includes(code));
  return {
    declared:declared.length,
    implemented:implemented.length,
    missing,
    extra,
    ok:declared.length===43&&implemented.length===43&&missing.length===0&&extra.length===0
  };
}
