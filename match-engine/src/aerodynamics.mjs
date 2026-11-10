// ME-PHYS-08 — diagnostic speed-dependent aerodynamic drag proxy ONLY.
// Literature-informed shape, not wind-tunnel measurements for a Football Architect ball.
// Hong (2024), Korean Journal of Sport Science 35(2), table 2–3: Euro 2024
// transition around 12 m/s; Cd 0.21 at ~19 m/s and 0.24 at ~32 m/s.
// Values at 0/7/12 m/s are explicit modelling hypotheses, NOT measured knots.
// No gameplay profile, pitch, climate, wind, Magnus or ball-brand choice.
export const SPEED_DRAG_SOURCE =
  'https://kjss.sports.re.kr/v.35/2/392/21';
export const SPEED_DRAG_NODES = Object.freeze([
  Object.freeze({speedMps:0, cd:0.40, evidence:'hypothesis'}),
  Object.freeze({speedMps:7, cd:0.36, evidence:'hypothesis'}),
  Object.freeze({speedMps:12, cd:0.20, evidence:'hypothesis near reported transition'}),
  Object.freeze({speedMps:19, cd:0.21, evidence:'Euro 2024 wind tunnel, ~19 m/s'}),
  Object.freeze({speedMps:32, cd:0.24, evidence:'Euro 2024 wind tunnel, ~32 m/s'}),
  Object.freeze({speedMps:35, cd:0.24, evidence:'bounded extrapolation'})
]);
// Linear interpolation is continuous and bounded, including through the drag crisis.
// Outside measured speeds: clamp endpoints, NEVER extrapolate an unbounded force.
export function speedDependentDragCd(speedMps) {
  if(typeof speedMps!=='number'||!Number.isFinite(speedMps)||speedMps<0)
    throw new RangeError('Invalid speed for experimental Cd(v)');
  if(speedMps>=SPEED_DRAG_NODES.at(-1).speedMps)
    return SPEED_DRAG_NODES.at(-1).cd;
  for(let i=1;i<SPEED_DRAG_NODES.length;i++){
    const high=SPEED_DRAG_NODES[i],low=SPEED_DRAG_NODES[i-1];
    if(speedMps<=high.speedMps){
      const fraction=(speedMps-low.speedMps)/(high.speedMps-low.speedMps);
      return low.cd+(high.cd-low.cd)*fraction;
    }
  }
  throw new Error('Unreachable Cd(v) interpolation state');
}
