"""Persistence helpers for Option A research sessions (Postgres)."""

from __future__ import annotations

import json
from typing import Any

import psycopg2.extras

from app.database import fetch_all, fetch_one, get_conn


def create_session(question: str, config: dict[str, Any]) -> str:
    row = fetch_one(
        """
        INSERT INTO research_sessions (question, config)
        VALUES (%s, %s::jsonb)
        RETURNING id::text AS id
        """,
        (question, json.dumps(config)),
    )
    assert row is not None
    return row["id"]


def update_session(
    session_id: str,
    *,
    status: str | None = None,
    error_message: str | None = None,
    final_output: dict[str, Any] | None = None,
) -> None:
    parts: list[str] = ["updated_at = now()"]
    params: list[Any] = []
    if status is not None:
        parts.append("status = %s")
        params.append(status)
    if error_message is not None:
        parts.append("error_message = %s")
        params.append(error_message)
    if final_output is not None:
        parts.append("final_output = %s::jsonb")
        params.append(json.dumps(final_output))
    params.append(session_id)
    sql = f"UPDATE research_sessions SET {', '.join(parts)} WHERE id = %s::uuid"
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(params))


def create_thread(session_id: str, label: str, sort_order: int) -> str:
    row = fetch_one(
        """
        INSERT INTO research_threads (session_id, label, sort_order)
        VALUES (%s::uuid, %s, %s)
        RETURNING id::text AS id
        """,
        (session_id, label, sort_order),
    )
    assert row is not None
    return row["id"]


def insert_message(
    thread_id: str,
    role: str,
    content: str,
    *,
    agent_name: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    meta = json.dumps(metadata or {})
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO research_messages (thread_id, role, agent_name, content, metadata)
                VALUES (%s::uuid, %s, %s, %s, %s::jsonb)
                """,
                (thread_id, role, agent_name, content, meta),
            )


def get_session_row(session_id: str) -> dict | None:
    return fetch_one(
        """
        SELECT id::text AS id, question, status, config, error_message, final_output,
               created_at, updated_at
        FROM research_sessions
        WHERE id = %s::uuid
        """,
        (session_id,),
    )


def get_session_detail(session_id: str) -> dict | None:
    """Session + threads + messages for GET /api/research/sessions/{id}."""
    s = get_session_row(session_id)
    if not s:
        return None
    threads_raw = fetch_all(
        """
        SELECT id::text AS id, label, status, sort_order, created_at
        FROM research_threads
        WHERE session_id = %s::uuid
        ORDER BY sort_order ASC, created_at ASC
        """,
        (session_id,),
    )
    threads: list[dict] = []
    for t in threads_raw:
        tid = t["id"]
        msgs = fetch_all(
            """
            SELECT role, agent_name, content, metadata, created_at
            FROM research_messages
            WHERE thread_id = %s::uuid
            ORDER BY created_at ASC, id ASC
            """,
            (tid,),
        )
        threads.append({**t, "messages": msgs})
    return {**s, "threads": threads}
