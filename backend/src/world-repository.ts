import { ApiError } from './errors.ts';
import { parseWorldV1, type WorldV1 } from './types.ts';

export interface WorldDatabase {
  prepare(sql: string): { first<T>(): Promise<T | null> };
}

interface WorldRow {
  schema_version: number;
  generation: string;
  revision: number;
  season_number: number;
  day: number;
  phase: string;
}

/** Read the durable singleton; never initialize from a request or local browser state. */
export async function readWorld(db: WorldDatabase | null | undefined): Promise<WorldV1> {
  if (!db || typeof db.prepare !== 'function')
    throw new ApiError(503, 'world_unavailable');
  try {
    const row = await db.prepare(
      'SELECT schema_version, generation, revision, season_number, day, phase FROM world_state WHERE id = 1'
    ).first<WorldRow>();
    if (!row) throw new ApiError(503, 'world_unavailable');
    return parseWorldV1({
      schemaVersion: row.schema_version,
      generation: row.generation,
      revision: row.revision,
      seasonNumber: row.season_number,
      day: row.day,
      phase: row.phase,
    });
  } catch {
    // Storage errors and malformed rows are deliberately indistinguishable publicly.
    throw new ApiError(503, 'world_unavailable');
  }
}
