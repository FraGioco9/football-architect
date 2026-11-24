export interface MarketValueInput {age:number;career_status:string;primary_position:string;secondary_positions:readonly string[];attributes:Readonly<Record<string,number>>}
export function rawPlayerMarketValueArc(input:MarketValueInput):number|null;
export function calculatePlayerMarketValueArc(input:MarketValueInput):number|null;
export const MARKET_VALUE_CONFIG:Readonly<{version:string}&Record<string,unknown>>;

export function rawDestinationSalaryReferenceArc(input:MarketValueInput,expectedAnnualRewardsArc:number):number|null;
