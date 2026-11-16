/** Versioned approved competition colours, independent of match data. */
export interface ScoreboardTheme {
 readonly backgroundHex:string;
 readonly foregroundHex:string;
 readonly accentHex:string;
 readonly logoAsset:string|null;
 readonly kind:'competition'|'neutral';
}
export const scoreboardThemes:Readonly<Record<string,{
 readonly surface:string;readonly ink:string;readonly accent:string;readonly logoAsset:string|null
}>>;
export function contrastRatio(a:string,b:string):number;
export function resolveScoreboardTheme(competition:unknown):ScoreboardTheme;
export function resolveFirstPaintMatchTheme(competitionId:unknown):Readonly<Pick<ScoreboardTheme,
 'backgroundHex'|'foregroundHex'|'accentHex'>>|null;
