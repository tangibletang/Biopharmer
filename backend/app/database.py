"""
Database connection utilities.

Uses psycopg2 directly for raw SQL (needed for pgvector's <=> operator).
The Supabase client is kept for auth-scoped writes if needed by the seed.
"""

import os
import contextlib
from typing import Generator
from urllib.parse import urlparse, unquote

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.environ["DATABASE_URL"]


def _parse_dsn(url: str) -> dict:
    """
    Parse a postgres:// URL into psycopg2 keyword args.

    Handles passwords with special characters (@, !, $, etc.) that break
    Python's urlparse — we split on the LAST '@' which is always the
    credentials/host boundary regardless of what's in the password.
    """
    # Strip scheme
    rest = url.removeprefix("postgresql://").removeprefix("postgres://")
    # Split credentials from host on the LAST '@'
    last_at = rest.rfind("@")
    credentials = rest[:last_at]
    hostpart    = rest[last_at + 1:]
    # credentials = "user:password"
    colon = credentials.index(":")
    user     = unquote(credentials[:colon])
    password = unquote(credentials[colon + 1:])
    # hostpart = "host:port/dbname"
    host_port, dbname = hostpart.split("/", 1)
    host, port_str = host_port.rsplit(":", 1)
    return {
        "host":     host,
        "port":     int(port_str),
        "dbname":   dbname,
        "user":     user,
        "password": password,
        "sslmode":  "require",
    }


@contextlib.contextmanager
def get_conn() -> Generator[psycopg2.extensions.connection, None, None]:
    """Yield a psycopg2 connection, committing on success and rolling back on error."""
    conn = psycopg2.connect(**_parse_dsn(DATABASE_URL))
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def fetch_one(sql: str, params: tuple = ()) -> dict | None:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            return dict(row) if row else None


def fetch_all(sql: str, params: tuple = ()) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]
