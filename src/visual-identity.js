// QOL05.14 — pure presentation helpers. No storage, game state or browser dependencies.
const DEFAULT_PRIMARY='#42d7ac';
const DEFAULT_SECONDARY='#225449';
const CHANNEL=(hex)=>hex.match(/[0-9a-f]{2}/gi)?.map(pair=>parseInt(pair,16))??[0,0,0];
export function safeColor(value,fallback=DEFAULT_PRIMARY){
  if(typeof value!=='string')return fallback;
  const s=value.trim();
  if(/^#[\da-f]{3}$/i.test(s))return '#'+[...s.slice(1)].map(x=>x+x).join('').toLowerCase();
  if(/^#[\da-f]{6}$/i.test(s))return s.toLowerCase();
  return fallback;
}
const luminance=(hex)=>{
  const rgb=CHANNEL(safeColor(hex)).map(v=>{const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
};
export function contrastRatio(a,b){
  const x=luminance(a),y=luminance(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
export function readableInk(background){
  return contrastRatio(background,'#081720')>=contrastRatio(background,'#f4fff9')?'#081720':'#f4fff9';
}
export function clubPalette(club){
  const raw=Array.isArray(club?.colors)?club.colors:[];
  const primary=safeColor(raw[0]);
  const secondary=safeColor(raw[1],DEFAULT_SECONDARY);
  const ink=readableInk(primary);
  // The inner monogram uses a fixed dark backing, independently of club colors.
  return {primary,secondary,ink,monogram:'#f0fff9'};
}
export function monogram(value){
  const tokens=String(value??'').trim().split(/\s+/u).filter(Boolean);
  if(!tokens.length)return '–';
  const first=Array.from(tokens[0])[0];
  const last=Array.from(tokens.at(-1))[0];
  return (first+(tokens.length>1?last:'')).toLocaleUpperCase().slice(0,2);
}
export function overallTier(value){
  const n=Number(value);
  if(!Number.isFinite(n))return 'low';
  return n>=78?'high':n>=68?'mid':'low';
}
export function conditionTier(value){
  const n=Number(value);
  return !Number.isFinite(n)||n<50?'low':n<75?'mid':'high';
}
