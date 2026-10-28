/** Versioned durable world identity. The database, not the browser, owns this state. */
export type WorldPhase = 'unstarted' | 'preparing' | 'active' | 'closed';
export type WorldV1 = Readonly<{
  schemaVersion: 1;
  generation: string;
  revision: number;
  seasonNumber: number;
  day: number;
  phase: WorldPhase;
}>;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Fail closed on malformed storage: never generate a fallback world on reads. */
export function parseWorldV1(value: unknown): WorldV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new TypeError('invalid_world');
  const v = value as Record<string, unknown>;
  const integer = (x: unknown) => typeof x === 'number' && Number.isSafeInteger(x);
  if (v.schemaVersion !== 1 || typeof v.generation !== 'string' || !UUID_V4.test(v.generation) ||
      !integer(v.revision) || (v.revision as number) < 0 ||
      !integer(v.seasonNumber) || (v.seasonNumber as number) < 0 ||
      !integer(v.day) || (v.day as number) < 0 || (v.day as number) > 56 ||
      !['unstarted','preparing','active','closed'].includes(String(v.phase)))
    throw new TypeError('invalid_world');
  if (v.phase === 'unstarted' && (v.seasonNumber !== 0 || v.day !== 0 || v.revision !== 0))
    throw new TypeError('invalid_world');
  if (v.phase !== 'unstarted' && v.seasonNumber === 0)
    throw new TypeError('invalid_world');
  if (v.phase === 'preparing' && v.day !== 0)
    throw new TypeError('invalid_world');
  if (v.phase === 'active' && (v.day as number) < 1)
    throw new TypeError('invalid_world');
  if (v.phase === 'closed' && v.day !== 56)
    throw new TypeError('invalid_world');
  return { schemaVersion: 1, generation: v.generation, revision: v.revision as number,
    seasonNumber: v.seasonNumber as number, day: v.day as number, phase: v.phase as WorldPhase };
}
