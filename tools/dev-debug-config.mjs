// DEV-only control ranges. Not a real-world clock, Season 1 manifest, or publication asset.
// The local debug launcher exclusively imports this file.
export const DEBUG_CONTROL_LIMITS=Object.freeze({
 season:Object.freeze({min:0,max:4,step:1}),
 worldDay:Object.freeze({min:1,max:56,step:1}),
 matchdays:Object.freeze({min:0,max:30,step:1}),
});
