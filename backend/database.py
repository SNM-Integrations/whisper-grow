"""
Database abstraction layer.

Supports two backends:
- LOCAL: SQLite (file-based, zero config)
- CLOUD: PostgreSQL (connection string from DATABASE_URL)

Usage:
    from database import get_db, init_db

    # Initialize on startup
    init_db()

    # Use in endpoints
    db = get_db()
    db.save_conversation(...)
"""

import sqlite3
import json
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional
from contextlib import contextmanager

from config import Config


class Database(ABC):
    """Abstract base class for database operations."""

    @abstractmethod
    def init(self) -> None:
        """Initialize database schema."""
        pass

    @abstractmethod
    def save_message(self, conversation_id: str, role: str, content: str) -> None:
        """Save a message to a conversation."""
        pass

    @abstractmethod
    def get_conversation(self, conversation_id: str) -> Optional[dict]:
        """Get a conversation with all messages."""
        pass

    @abstractmethod
    def list_conversations(self) -> list[dict]:
        """List all conversations."""
        pass

    @abstractmethod
    def delete_conversation(self, conversation_id: str) -> bool:
        """Delete a conversation. Returns True if deleted."""
        pass

    @abstractmethod
    def create_conversation(self, conversation_id: str, title: Optional[str] = None) -> None:
        """Create a new conversation."""
        pass


class SQLiteDatabase(Database):
    """SQLite database for local mode."""

    def __init__(self, db_path: str):
        self.db_path = db_path

    @contextmanager
    def _get_conn(self):
        """Get a database connection with context manager."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def init(self) -> None:
        """Create tables if they don't exist."""
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
                )
            """)

            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_messages_conversation
                ON messages(conversation_id)
            """)

            # Notes table for future use
            conn.execute("""
                CREATE TABLE IF NOT EXISTS notes (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)

    def create_conversation(self, conversation_id: str, title: Optional[str] = None) -> None:
        """Create a new conversation."""
        now = datetime.now().isoformat()
        with self._get_conn() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (conversation_id, title or "New Conversation", now, now)
            )

    def save_message(self, conversation_id: str, role: str, content: str) -> None:
        """Save a message to a conversation."""
        now = datetime.now().isoformat()

        with self._get_conn() as conn:
            # Ensure conversation exists
            conn.execute(
                "INSERT OR IGNORE INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (conversation_id, "New Conversation", now, now)
            )

            # Add message
            conn.execute(
                "INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)",
                (conversation_id, role, content, now)
            )

            # Update conversation timestamp and title (use first user message as title)
            if role == "user":
                conn.execute(
                    """UPDATE conversations
                       SET updated_at = ?,
                           title = CASE WHEN title = 'New Conversation' THEN ? ELSE title END
                       WHERE id = ?""",
                    (now, content[:50] + "..." if len(content) > 50 else content, conversation_id)
                )
            else:
                conn.execute(
                    "UPDATE conversations SET updated_at = ? WHERE id = ?",
                    (now, conversation_id)
                )

    def get_conversation(self, conversation_id: str) -> Optional[dict]:
        """Get a conversation with all messages."""
        with self._get_conn() as conn:
            conv = conn.execute(
                "SELECT * FROM conversations WHERE id = ?",
                (conversation_id,)
            ).fetchone()

            if not conv:
                return None

            messages = conn.execute(
                "SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id",
                (conversation_id,)
            ).fetchall()

            return {
                "id": conv["id"],
                "title": conv["title"],
                "messages": [
                    {"role": m["role"], "content": m["content"], "timestamp": m["created_at"]}
                    for m in messages
                ],
                "created_at": conv["created_at"],
                "updated_at": conv["updated_at"],
            }

    def list_conversations(self) -> list[dict]:
        """List all conversations with last message preview."""
        with self._get_conn() as conn:
            conversations = conn.execute(
                """SELECT c.*,
                          (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) as last_message,
                          (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
                   FROM conversations c
                   ORDER BY c.updated_at DESC"""
            ).fetchall()

            return [
                {
                    "id": c["id"],
                    "title": c["title"],
                    "last_message": c["last_message"][:100] if c["last_message"] else None,
                    "message_count": c["message_count"],
                    "updated_at": c["updated_at"],
                }
                for c in conversations
            ]

    def delete_conversation(self, conversation_id: str) -> bool:
        """Delete a conversation and its messages."""
        with self._get_conn() as conn:
            cursor = conn.execute(
                "DELETE FROM conversations WHERE id = ?",
                (conversation_id,)
            )
            conn.execute(
                "DELETE FROM messages WHERE conversation_id = ?",
                (conversation_id,)
            )
            return cursor.rowcount > 0


class PostgresDatabase(Database):
    """PostgreSQL database for cloud mode."""

    def __init__(self, database_url: str):
        self.database_url = database_url
        self._pool = None

    def _get_pool(self):
        """Get or create connection pool."""
        if self._pool is None:
            try:
                import psycopg2
                from psycopg2 import pool
                self._pool = pool.SimpleConnectionPool(1, 10, self.database_url)
            except ImportError:
                raise ImportError("psycopg2 required for PostgreSQL. Install with: pip install psycopg2-binary")
        return self._pool

    @contextmanager
    def _get_conn(self):
        """Get a database connection from pool."""
        pool = self._get_pool()
        conn = pool.getconn()
        try:
            yield conn
            conn.commit()
        finally:
            pool.putconn(conn)

    def init(self) -> None:
        """Create tables if they don't exist."""
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS conversations (
                        id TEXT PRIMARY KEY,
                        title TEXT,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS messages (
                        id SERIAL PRIMARY KEY,
                        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                        role TEXT NOT NULL,
                        content TEXT NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)

                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_messages_conversation
                    ON messages(conversation_id)
                """)

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS notes (
                        id TEXT PRIMARY KEY,
                        title TEXT,
                        content TEXT NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)

    def create_conversation(self, conversation_id: str, title: Optional[str] = None) -> None:
        """Create a new conversation."""
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO conversations (id, title) VALUES (%s, %s)
                       ON CONFLICT (id) DO NOTHING""",
                    (conversation_id, title or "New Conversation")
                )

    def save_message(self, conversation_id: str, role: str, content: str) -> None:
        """Save a message to a conversation."""
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                # Ensure conversation exists
                cur.execute(
                    """INSERT INTO conversations (id, title) VALUES (%s, %s)
                       ON CONFLICT (id) DO NOTHING""",
                    (conversation_id, "New Conversation")
                )

                # Add message
                cur.execute(
                    "INSERT INTO messages (conversation_id, role, content) VALUES (%s, %s, %s)",
                    (conversation_id, role, content)
                )

                # Update conversation
                title_update = content[:50] + "..." if len(content) > 50 else content
                if role == "user":
                    cur.execute(
                        """UPDATE conversations
                           SET updated_at = NOW(),
                               title = CASE WHEN title = 'New Conversation' THEN %s ELSE title END
                           WHERE id = %s""",
                        (title_update, conversation_id)
                    )
                else:
                    cur.execute(
                        "UPDATE conversations SET updated_at = NOW() WHERE id = %s",
                        (conversation_id,)
                    )

    def get_conversation(self, conversation_id: str) -> Optional[dict]:
        """Get a conversation with all messages."""
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, title, created_at, updated_at FROM conversations WHERE id = %s",
                    (conversation_id,)
                )
                conv = cur.fetchone()

                if not conv:
                    return None

                cur.execute(
                    "SELECT role, content, created_at FROM messages WHERE conversation_id = %s ORDER BY id",
                    (conversation_id,)
                )
                messages = cur.fetchall()

                return {
                    "id": conv[0],
                    "title": conv[1],
                    "messages": [
                        {"role": m[0], "content": m[1], "timestamp": m[2].isoformat()}
                        for m in messages
                    ],
                    "created_at": conv[2].isoformat(),
                    "updated_at": conv[3].isoformat(),
                }

    def list_conversations(self) -> list[dict]:
        """List all conversations."""
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT c.id, c.title, c.updated_at,
                           (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1),
                           (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id)
                    FROM conversations c
                    ORDER BY c.updated_at DESC
                """)
                conversations = cur.fetchall()

                return [
                    {
                        "id": c[0],
                        "title": c[1],
                        "updated_at": c[2].isoformat(),
                        "last_message": c[3][:100] if c[3] else None,
                        "message_count": c[4],
                    }
                    for c in conversations
                ]

    def delete_conversation(self, conversation_id: str) -> bool:
        """Delete a conversation (messages cascade)."""
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM conversations WHERE id = %s",
                    (conversation_id,)
                )
                return cur.rowcount > 0


# Singleton instance
_database: Optional[Database] = None


def get_db() -> Database:
    """Get the database instance."""
    global _database
    if _database is None:
        if Config.is_local():
            _database = SQLiteDatabase(Config.SQLITE_PATH)
        else:
            _database = PostgresDatabase(Config.DATABASE_URL)
    return _database


def init_db() -> None:
    """Initialize the database schema."""
    db = get_db()
    db.init()
