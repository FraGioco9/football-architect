import { parseWorldV1, type WorldV1 } from './types.ts';

/** Whitelisted anonymous projection; operator/session fields never cross this boundary. */
export function projectWorld(world: WorldV1): WorldV1 {
  return parseWorldV1(world);
}
