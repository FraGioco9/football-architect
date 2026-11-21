/**
 * #577 Match scoreboard presentation configuration.
 * Edit one competition entry to select its OWN manifest-approved HEX values.
 * Brand colours are never sourced from club kits or match payloads.
 * Logo assets are opt-in: do not add a path until its approved SVG exists.
 */
import {competitionLogoUrl} from './public-image-urls.mjs';
export const scoreboardThemes=Object.freeze({
 'BR-1':{surface:'primary',ink:'ivory',accent:'secondary',logoVariant:'compact'},
 'BR-2':{surface:'primary',ink:'ivory',accent:'secondary',logoVariant:'compact'},
 'DE-1':{surface:'primary',ink:'ivory',accent:'secondary',logoVariant:'compact'},
 'DE-2':{surface:'primary',ink:'ivory',accent:'secondary',logoVariant:'compact'},
 'ENG-1':{surface:'primary',ink:'ivory',accent:'secondary',logoVariant:'compact'},
 'ENG-2':{surface:'primary',ink:'ivory',accent:'secondary',logoVariant:'compact'},
 'ES-1':{surface:'primary',ink:'ivory',accent:'secondary',logoVariant:'compact'},
 'ES-2':{surface:'primary',ink:'ivory',accent:'secondary',logoVariant:'compact'},
 'FR-1':{surface:'primary',ink:'ivory',accent:'secondary',logoVariant:'compact'},
 'FR-2':{surface:'primary',ink:'ivory',accent:'secondary',logoVariant:'compact'},
 'IT-1':{surface:'primary',ink:'ivory',accent:'secondary',logoVariant:'compact'},
 'IT-2':{surface:'primary',ink:'ivory',accent:'secondary',logoVariant:'compact'},
 'NL-1':{surface:'primary',ink:'ivory',accent:'secondary',logoVariant:'compact'},
 'NL-2':{surface:'primary',ink:'ivory',accent:'secondary',logoVariant:'compact'},
 'PT-1':{surface:'primary',ink:'ivory',accent:'secondary',logoVariant:'compact'},
 'PT-2':{surface:'primary',ink:'ivory',accent:'secondary',logoVariant:'compact'},
 // No dedicated approved international palette/logo assets yet.
 'int-1':{surface:'neutral',ink:'ivory',accent:'ivory',logoVariant:null},
 'int-2':{surface:'neutral',ink:'ivory',accent:'ivory',logoVariant:null}
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
 const url=choice.logoVariant==='compact'||choice.logoVariant==='primary'
  ?competitionLogoUrl(competition.id,choice.logoVariant):null;
 const logoAsset=url?url.slice(1):null;
 return {backgroundHex,foregroundHex,accentHex,logoAsset,kind:'competition'};
}

/**
 * Parser-time branding from the same approved primary palette used by the
 * hydrated scoreboard. Only known domestic IDs receive competition colours.
 * International competitions remain neutral until branding is approved.
 */
export function resolveFirstPaintMatchTheme(competitionId){
 if(typeof competitionId!=='string'||!Object.hasOwn(approvedPrimary,competitionId))return null;
 const hydrated=resolveScoreboardTheme({id:competitionId,
  primaryHex:approvedPrimary[competitionId],secondaryHex:'#243039',ivoryHex:'#F5F1E8'});
 return hydrated.kind==='competition'?Object.freeze({
  backgroundHex:hydrated.backgroundHex,foregroundHex:hydrated.foregroundHex,
  accentHex:hydrated.accentHex}):null;
}
