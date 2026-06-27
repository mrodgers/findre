import aiosqlite
import json
import hashlib
import time
from pathlib import Path
from typing import Optional, Any

DB_PATH = Path(__file__).parent.parent / "data" / "cache.db"


async def init_db():
    DB_PATH.parent.mkdir(exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS search_cache (
                key TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_at REAL NOT NULL,
                ttl_seconds INTEGER NOT NULL DEFAULT 3600
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS interactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                property_id TEXT NOT NULL,
                action TEXT NOT NULL,
                created_at REAL NOT NULL
            )
        """)
        await db.commit()


def make_cache_key(prefix: str, data: Any) -> str:
    content = json.dumps(data, sort_keys=True)
    return f"{prefix}:{hashlib.md5(content.encode()).hexdigest()}"


async def cache_get(key: str) -> Optional[Any]:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT data, created_at, ttl_seconds FROM search_cache WHERE key = ?",
            (key,)
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                return None
            data, created_at, ttl = row
            if time.time() - created_at > ttl:
                await db.execute("DELETE FROM search_cache WHERE key = ?", (key,))
                await db.commit()
                return None
            return json.loads(data)


async def cache_set(key: str, data: Any, ttl_seconds: int = 3600):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO search_cache (key, data, created_at, ttl_seconds) VALUES (?, ?, ?, ?)",
            (key, json.dumps(data), time.time(), ttl_seconds)
        )
        await db.commit()


async def config_get(key: str) -> Optional[str]:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT value FROM config WHERE key = ?", (key,)) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else None


async def config_set(key: str, value: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
            (key, value)
        )
        await db.commit()


async def record_interaction(session_id: str, property_id: str, action: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO interactions (session_id, property_id, action, created_at) VALUES (?, ?, ?, ?)",
            (session_id, property_id, action, time.time())
        )
        await db.commit()
