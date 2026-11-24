#!/usr/bin/env python3
"""#532: read-only, synthetic SQLite profiling. Never opens a project or remote DB."""
import argparse
import json
import math
import sqlite3
import statistics
import sys
import time


def run_case(db, sql, params, repeats):
    db.execute(sql, params).fetchall()  # warmup
    timings = []
    for _ in range(repeats):
        start = time.perf_counter()
        db.execute(sql, params).fetchall()
        timings.append(1000 * (time.perf_counter() - start))
    timings.sort()
    return {
        "median_ms": round(statistics.median(timings), 3),
        "p95_ms": round(timings[math.ceil(0.95 * len(timings)) - 1], 3),
        "query_plan": [r[3] for r in db.execute("EXPLAIN QUERY PLAN " + sql, params)],
    }


def measure(count, repeats):
    db = sqlite3.connect(":memory:")
    db.execute("CREATE TABLE generated_players("
               "id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id TEXT, world_generation TEXT, "
               "entry_season INTEGER, payload_json TEXT, created_at INTEGER)")
    db.execute("CREATE INDEX generated_players_world ON generated_players(world_generation,entry_season,batch_id)")
    db.execute("CREATE INDEX generated_players_batch ON generated_players(batch_id)")
    db.execute("CREATE TABLE world_state(id INTEGER PRIMARY KEY,generation TEXT,season_number INTEGER,day INTEGER,phase TEXT)")
    db.execute("INSERT INTO world_state VALUES(1,'generation',1,1,'active')")
    db.execute("CREATE TABLE player_signed_contracts(id INTEGER PRIMARY KEY,player_id INTEGER,club_key TEXT,world_generation TEXT,start_tick INTEGER,scheduled_end_tick INTEGER,closed_tick INTEGER)")
    db.execute("CREATE UNIQUE INDEX player_signed_contracts_current ON player_signed_contracts(player_id) WHERE closed_tick IS NULL")
    db.execute("CREATE INDEX player_signed_contracts_club ON player_signed_contracts(club_key,player_id) WHERE closed_tick IS NULL")
    countries = ("ITA", "ENG", "FRA", "GER", "ESP")
    rows = []
    for i in range(1, count + 1):
        payload = json.dumps({
            "display_name": "Player " + str(i), "nationality": countries[i % len(countries)],
            "age": 18 + i % 19, "primary_position": "CM", "career_status": "active",
            "attributes": {"passing": i % 100, "shooting": (i * 3) % 100, "vision": (i * 7) % 100},
        }, separators=(",", ":"))
        rows.append((i, "batch", "generation", 0, payload, 1730000000))
    db.executemany("INSERT INTO generated_players VALUES (?,?,?,?,?,?)", rows)
    db.execute("INSERT INTO player_signed_contracts SELECT id,id,'IT-'||((id%32)+1),'generation',0,56,NULL FROM generated_players WHERE id%5<>0")
    db.commit()
    # Keep the relation in step with effective-player-contracts.mjs.
    join = ("SELECT p.id,p.payload_json,a.club_key FROM generated_players p LEFT JOIN ("
            "SELECT c.player_id,c.club_key,c.id AS contract_id FROM player_signed_contracts c "
            "JOIN world_state w ON w.id=1 AND w.generation=c.world_generation "
            "JOIN generated_players g ON g.id=c.player_id "
            "WHERE json_extract(g.payload_json,'$.career_status')='active' "
            "AND c.start_tick<=((w.season_number-1)*56+MAX(w.day,1)-1) "
            "AND c.scheduled_end_tick>((w.season_number-1)*56+MAX(w.day,1)-1) "
            "AND (c.closed_tick IS NULL OR c.closed_tick>((w.season_number-1)*56+MAX(w.day,1)-1))"
            ") a ON a.player_id=p.id")
    cases = {
        "count_all": ("SELECT COUNT(*) FROM generated_players", ()),
        "count_nationality": (
            "SELECT COUNT(*) FROM generated_players WHERE json_extract(payload_json,'$.nationality')=?", ("ITA",)),
        "count_two_skills": (
            "SELECT COUNT(*) FROM generated_players WHERE "
            "json_extract(payload_json,'$.attributes.passing')>=? AND "
            "json_extract(payload_json,'$.attributes.vision')>=?", (70, 70)),
        "first_id": (join + " ORDER BY id DESC LIMIT ? OFFSET ?", (50, 0)),
        "deep_id": (join + " ORDER BY id DESC LIMIT ? OFFSET ?", (50, max(0, count - 50))),
        "age_sort": (
            join + " ORDER BY json_extract(payload_json,'$.age') COLLATE NOCASE DESC,id ASC LIMIT ? OFFSET ?",
            (50, 0)),
        "nationality_age_sort": (
            join + " WHERE json_extract(payload_json,'$.nationality')=? "
            "ORDER BY json_extract(payload_json,'$.age') COLLATE NOCASE DESC,id ASC LIMIT ? OFFSET ?",
            ("ITA", 50, 0)),
    }
    results = {key: run_case(db, sql, params, repeats) for key, (sql, params) in cases.items()}
    db.close()
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sizes", default="1000,10000,50000", help="Comma-separated positive synthetic row counts")
    parser.add_argument("--repeats", type=int, default=13, help="Timed iterations per query after warmup")
    args = parser.parse_args()
    try:
        sizes = [int(s) for s in args.sizes.split(",")]
    except ValueError:
        parser.error("sizes must contain comma-separated integers")
    if not sizes or len(sizes) > 5 or any(s < 50 or s > 100000 for s in sizes) or not (3 <= args.repeats <= 100):
        parser.error("up to 5 sizes in [50, 100000] and repeats in [3, 100] are supported")
    output = {"mode": "in-memory synthetic SQLite; NOT Cloudflare D1",
              "sqlite": sqlite3.sqlite_version, "python": sys.version.split()[0],
              "repeats": args.repeats,
              "results": {str(size): measure(size, args.repeats) for size in sizes}}
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
