#!/usr/bin/env python3
"""Prepare a *local, offline* generated-player transfer bundle from a Wrangler D1 SQL export.

No network, Cloudflare credentials or remote database operations are used.
This does not import anything into Preview; remote DB writes require separate approval.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys


def _require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def _json(raw: str, label: str):
    try:
        return json.loads(raw)
    except (ValueError, TypeError) as exc:
        raise ValueError(f"Invalid JSON in {label}") from exc


def load_local_bundle(export_path: Path, expected_count: int) -> dict:
    """Read a Wrangler --local SQL export into a disposable SQLite memory database."""
    _require(1 <= expected_count <= 1000, "Expected player count must be 1..1000")
    _require(export_path.is_file(), "Local D1 SQL backup not found")
    _require(export_path.stat().st_size <= 100_000_000, "SQL backup is unexpectedly large")
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    try:
        try:
            connection.executescript(export_path.read_text(encoding="utf-8"))
        except (sqlite3.Error, UnicodeError) as exc:
            raise ValueError("Unable to open the local D1 SQL export") from exc
        tables = {row[0] for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table'")}
        _require({"world_state", "generated_players", "player_generation_drafts"} <= tables,
                 "Local D1 does not contain the required player tables")
        columns = list(connection.execute("PRAGMA table_info(generated_players)"))
        _require(any(row["name"] == "id" and row["type"].upper() == "INTEGER"
                     and row["pk"] == 1 for row in columns),
                 "Apply local migration 0021: footballer IDs must be INTEGER PRIMARY KEY")
        world = connection.execute(
            "SELECT generation,season_number FROM world_state WHERE id=1").fetchone()
        _require(world is not None, "No current local sporting world")
        rows = connection.execute(
            "SELECT id,batch_id,world_generation,entry_season,payload_json,created_at "
            "FROM generated_players ORDER BY id").fetchall()
        _require(len(rows) == expected_count,
                 f"Player count mismatch: expected {expected_count}, found {len(rows)}")
        _require([r["id"] for r in rows] == list(range(1, expected_count + 1)),
                 "Expected contiguous player IDs starting at 1: inspect the local database")
        players = []
        batch_counts: dict[str, int] = {}
        for row in rows:
            ident = row["id"]
            _require(type(ident) is int and ident > 0, "Invalid numeric player ID")
            _require(row["world_generation"] == world["generation"],
                     "Existing players belong to a different world generation")
            _require(type(row["entry_season"]) is int and row["entry_season"] >= 0,
                     "Invalid entry season")
            payload = _json(row["payload_json"], f"player {ident}")
            _require(isinstance(payload, dict) and type(payload.get("id")) is int
                     and payload["id"] == ident,
                     f"Player {ident}: payload ID does not match database ID")
            _require(type(row["created_at"]) is int and row["created_at"] > 0,
                     f"Player {ident}: invalid creation timestamp")
            batch = row["batch_id"]
            _require(isinstance(batch, str) and batch, "Missing generating batch")
            batch_counts[batch] = batch_counts.get(batch, 0) + 1
            players.append({"id": ident, "batch_id": batch,
                            "entry_season": row["entry_season"],
                            "created_at": row["created_at"], "payload": payload})
        batches = []
        for batch_id in sorted(batch_counts):
            draft = connection.execute(
                "SELECT id,world_generation,season_number,account_id,options_json,"
                "candidates_json,count,seed,status,created_at,expires_at,committed_at "
                "FROM player_generation_drafts WHERE id=?", (batch_id,)).fetchone()
            _require(draft is not None and draft["status"] == "committed",
                     "Player batch missing or not committed")
            _require(draft["world_generation"] == world["generation"],
                     "Player batch has a different world generation")
            _require(draft["count"] == batch_counts[batch_id],
                     "Player count differs from the committed batch receipt")
            candidates = _json(draft["candidates_json"], "batch candidates")
            options = _json(draft["options_json"], "batch options")
            _require(isinstance(candidates, list) and len(candidates) == draft["count"]
                     and all(isinstance(c, dict) and "id" not in c for c in candidates),
                     "Legacy player IDs remain in batch candidates; apply migration 0021")
            _require(isinstance(options, dict), "Invalid batch options")
            batches.append({
                "id": batch_id, "account_id": draft["account_id"],
                "count": draft["count"], "seed": draft["seed"],
                "created_at": draft["created_at"], "expires_at": draft["expires_at"],
                "committed_at": draft["committed_at"],
                "options": options, "candidates": candidates
            })
        bundle = {
            "format": "football-architect-local-player-transfer-v1",
            "source": {"pool": "local", "world_generation": world["generation"],
                       "season_number": world["season_number"]},
            "player_count": len(players), "batch_count": len(batches),
            "batches": batches, "players": players,
            "remote_import_authorized": False
        }
        canonical = json.dumps(bundle, sort_keys=True, ensure_ascii=False,
                               separators=(",", ":")).encode("utf-8")
        bundle["sha256"] = hashlib.sha256(canonical).hexdigest()
        return bundle
    finally:
        connection.close()


def write_bundle(bundle: dict, destination: Path) -> None:
    """Create, never overwrite, a private operator-only local file."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(destination, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            json.dump(bundle, output, ensure_ascii=False, sort_keys=True, indent=2)
            output.write("\n")
    except BaseException:
        destination.unlink(missing_ok=True)
        raise


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True,
                        help="Wrangler local-only D1 SQL export")
    parser.add_argument("--expected-count", type=int, required=True)
    parser.add_argument("--output", type=Path, help="Private JSON transfer bundle path")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    if args.dry_run == (args.output is not None):
        parser.error("Choose exactly one of --dry-run or --output")
    try:
        bundle = load_local_bundle(args.source, args.expected_count)
        if args.output is not None:
            write_bundle(bundle, args.output)
        print(json.dumps({"players": bundle["player_count"],
                          "batches": bundle["batch_count"],
                          "numeric_ids": "1.." + str(bundle["player_count"]),
                          "bundle_written": args.output is not None,
                          "remote_import_authorized": False,
                          "remote_database_modified": False}, sort_keys=True))
        return 0
    except (ValueError, sqlite3.Error, OSError) as exc:
        print(f"Local player transfer preparation refused: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
