/**
 * #577 Match scoreboard presentation configuration.
 * Edit one competition entry to select its OWN manifest-approved HEX values.
 * Brand colours are never sourced from club kits or match payloads.
 * Logo assets are opt-in: do not add a path until its approved SVG exists.
 */
export const scoreboardThemes=Object.freeze({
 'BR-1':{surface:'primary',ink:'ivory',accent:'secondary',logoAsset:'assets/divisions/br-1-liga-das-associacoes/compact.svg'},
 'BR-2':{surface:'primary',ink:'ivory',accent:'secondary',logoAsset:'assets/divisions/br-2-liga-das-regioes/compact.svg'},
 'DE-1':{surface:'primary',ink:'ivory',accent:'secondary',logoAsset:'assets/divisions/de-1-meisterliga/compact.svg'},
 'DE-2':{surface:'primary',ink:'ivory',accent:'secondary',logoAsset:'assets/divisions/de-2-vereinsliga/compact.svg'},
 'ENG-1':{surface:'primary',ink:'ivory',accent:'secondary',logoAsset:'assets/divisions/eng-1-crown-league/compact.svg'},
 'ENG-2':{surface:'primary',ink:'ivory',accent:'secondary',logoAsset:'assets/divisions/eng-2-shield-league/compact.svg'},
 'ES-1':{surface:'primary',ink:'ivory',accent:'secondary',logoAsset:'assets/divisions/es-1-liga-de-la-union/compact.svg'},
 'ES-2':{surface:'primary',ink:'ivory',accent:'secondary',logoAsset:'assets/divisions/es-2-liga-de-las-regiones/compact.svg'},
 'FR-1':{surface:'primary',ink:'ivory',accent:'secondary',logoAsset:'assets/divisions/fr-1-ligue-des-societes/compact.svg'},
 'FR-2':{surface:'primary',ink:'ivory',accent:'secondary',logoAsset:'assets/divisions/fr-2-ligue-des-regions/compact.svg'},
 'IT-1':{surface:'primary',ink:'ivory',accent:'secondary',logoAsset:'assets/divisions/it-1-lega-federale/compact.svg'},
 'IT-2':{surface:'primary',ink:'ivory',accent:'secondary',logoAsset:'assets/divisions/it-2-lega-delle-citta/compact.svg'},
 'NL-1':{surface:'primary',ink:'ivory',accent:'secondary',logoAsset:'assets/divisions/nl-1-oranjeliga/compact.svg'},
 'NL-2':{surface:'primary',ink:'ivory',accent:'secondary',logoAsset:'assets/divisions/nl-2-bondsklasse/compact.svg'},
 'PT-1':{surface:'primary',ink:'ivory',accent:'secondary',logoAsset:'assets/divisions/pt-1-liga-lusitana/compact.svg'},
 'PT-2':{surface:'primary',ink:'ivory',accent:'secondary',logoAsset:'assets/divisions/pt-2-liga-atlantica/compact.svg'},
 // No dedicated approved international palette/logo assets yet.
 'int-1':{surface:'neutral',ink:'ivory',accent:'ivory',logoAsset:null},
 'int-2':{surface:'neutral',ink:'ivory',accent:'ivory',logoAsset:null}
});
const approvedPrimary=Object.freeze({
 'BR-1':'#225B4C','BR-2':'#4B7651',
 'DE-1':'#4A5063','DE-2':'#6A6571',
 'ENG-1':'#214D75','ENG-2':'#4A6480',
 'ES-1':'#913D48','ES-2':'#9C594A',
 'FR-1':'#414E87','FR-2':'#66628D',
 'IT-1':'#155F50','IT-2':'#41746A',
 'NL-1':'#8B5129','NL-2':'#88683C',
 'PT-1':'#745064','PT-2':'#675F7D'
});
// Canonical, already-published and integrity-verified DIV-ASSET compact/primary SVGs.
const approvedDivisionSlugs=Object.freeze({
 'BR-1':'br-1-liga-das-associacoes',
 'BR-2':'br-2-liga-das-regioes',
 'DE-1':'de-1-meisterliga',
 'DE-2':'de-2-vereinsliga',
 'ENG-1':'eng-1-crown-league',
 'ENG-2':'eng-2-shield-league',
 'ES-1':'es-1-liga-de-la-union',
 'ES-2':'es-2-liga-de-las-regiones',
 'FR-1':'fr-1-ligue-des-societes',
 'FR-2':'fr-2-ligue-des-regions',
 'IT-1':'it-1-lega-federale',
 'IT-2':'it-2-lega-delle-citta',
 'NL-1':'nl-1-oranjeliga',
 'NL-2':'nl-2-bondsklasse',
 'PT-1':'pt-1-liga-lusitana',
 'PT-2':'pt-2-liga-atlantica'
});
const validHex=/^#[0-9A-F]{6}$/;
const neutral=Object.freeze({backgroundHex:'#243039',foregroundHex:'#F5F1E8',accentHex:'#F5F1E8',logoAsset:null,kind:'neutral'});
const luminance=hex=>{
 const values=[1,3,5].map(i=>Number.parseInt(hex.slice(i,i+2),16)/255)
  .map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
 return values[0]*0.2126+values[1]*0.7152+values[2]*0.0722;
};
export function contrastRatio(a,b){
 if(!validHex.test(a)||!validHex.test(b))return 0;
 const x=luminance(a),y=luminance(b);
 return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
export function resolveScoreboardTheme(competition){
 if(!competition||typeof competition.id!=='string'||!Object.hasOwn(scoreboardThemes,competition.id))return neutral;
 const choice=scoreboardThemes[competition.id];
 // Each nation exposes a primary, secondary and ivory approved in the manifest.
 // In the absence of an approved palette, use the shared neutral surface only.
 const palette={primary:competition.primaryHex,secondary:competition.secondaryHex,ivory:competition.ivoryHex};
 // Do not trust presentation colours from a remote payload if they differ
 // from the approved, versioned competition brand palette.
 if(competition.primaryHex!==approvedPrimary[competition.id]||
    competition.secondaryHex!=='#243039'||competition.ivoryHex!=='#F5F1E8')return neutral;
 if(!Object.values(palette).every(hex=>typeof hex==='string'&&validHex.test(hex)))return neutral;
 const pick=key=>Object.hasOwn(palette,key)?palette[key]:null;
 const backgroundHex=pick(choice.surface),foregroundHex=pick(choice.ink),accentHex=pick(choice.accent);
 if(!backgroundHex||!foregroundHex||!accentHex||contrastRatio(backgroundHex,foregroundHex)<4.5)return neutral;
 // The logo must match one of the two published, integrity-verified SVGs
 // for this exact division. Configured compact by default for small scoreboards.
 const slug=approvedDivisionSlugs[competition.id];
 const approvedBase=slug?'assets/divisions/'+slug+'/':null;
 const logoAsset=approvedBase&&
  (choice.logoAsset===approvedBase+'compact.svg'||choice.logoAsset===approvedBase+'primary.svg')
  ?choice.logoAsset:null;
 return {backgroundHex,foregroundHex,accentHex,logoAsset,kind:'competition'};
}
