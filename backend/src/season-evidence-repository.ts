/** Season-scoped D1 reads shared by public and protected consumers.
 * Rows are evidence, never sporting authority by themselves: callers still
 * validate generation, canonical hashes, counts and current world revision.
 * This module deliberately does not mutate or open transactions.
 */
import type { Database } from './database.ts';

export interface SeasonDayOutcomeRow {
  day: number;
  generation: string;
  calendar_hash: string;
  simulation_version: string;
  outcome_hash: string;
  outcome_json: string;
}

export interface SeasonKnockoutTieRow {
  generation: string;
  competition_id: string;
  phase_id: string;
  tie_id: string;
  plan_hash: string;
  plan_json: string;
}

export interface SeasonArchiveSummaryRow {
  generation: string;
  archive_hash: string;
  summary_hash: string;
  summary_json: string;
}

export interface SeasonCloseReceiptRow {
  status: string;
  receipt_hash: string | null;
}

/** The composite primary key (season_number, day) supplies this ordering. */
export async function readSeasonDayOutcomes(db: Database, seasonNumber: number): Promise<SeasonDayOutcomeRow[]> {
  return (await db.prepare('SELECT day,generation,calendar_hash,simulation_version,outcome_hash,outcome_json FROM season_day_outcomes WHERE season_number=? ORDER BY day')
    .bind(seasonNumber).all<SeasonDayOutcomeRow>()).results;
}

/** The composite primary key supplies competition/phase/tie ordering. */
export async function readSeasonKnockoutTies(db: Database, seasonNumber: number): Promise<SeasonKnockoutTieRow[]> {
  return (await db.prepare('SELECT generation,competition_id,phase_id,tie_id,plan_hash,plan_json FROM season_knockout_ties WHERE season_number=? ORDER BY competition_id,phase_id,tie_id')
    .bind(seasonNumber).all<SeasonKnockoutTieRow>()).results;
}

export function readSeasonCalendarHash(db: Database, seasonNumber: number): Promise<{calendar_hash: string} | null> {
  return db.prepare('SELECT calendar_hash FROM season_calendars WHERE season_number=?')
    .bind(seasonNumber).first<{calendar_hash: string}>();
}

export async function countSeasonDayOutcomes(db: Database, seasonNumber: number): Promise<number> {
  const row = await db.prepare('SELECT count(*) AS n FROM season_day_outcomes WHERE season_number=?')
    .bind(seasonNumber).first<{n: number}>();
  return row?.n ?? 0;
}

export function readSeasonArchiveSummary(db: Database, seasonNumber: number): Promise<SeasonArchiveSummaryRow | null> {
  return db.prepare('SELECT generation,archive_hash,summary_hash,summary_json FROM season_archive_summaries WHERE season_number=?')
    .bind(seasonNumber).first<SeasonArchiveSummaryRow>();
}

export function readSeasonCloseReceipt(db: Database, seasonNumber: number): Promise<SeasonCloseReceiptRow | null> {
  return db.prepare("SELECT status,receipt_hash FROM season_admin_events WHERE season_number=? AND event_id='season:close' AND kind='close-season'")
    .bind(seasonNumber).first<SeasonCloseReceiptRow>();
}
