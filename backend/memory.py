"""
Memory abstraction layer for Second Brain.

Provides semantic search over notes, documents, and conversation chunks.

Supports two backends:
- LOCAL: ChromaDB (file-based, zero config)
- CLOUD: PostgreSQL with pgvector

Usage:
    from memory import get_memory, init_memory

    # Initialize on startup
    init_memory()

    # Use in endpoints
    mem = get_memory()
    mem.add_note(note_id, title, content)
    results = mem.search("what did I say about...")
"""

from abc import ABC, abstractmethod
from typing import Optional
from datetime import datetime
import json
import hashlib

from config import Config


class MemoryStore(ABC):
    """Abstract base class for memory/vector operations."""

    @abstractmethod
    def init(self) -> None:
        """Initialize the memory store."""
        pass

    @abstractmethod
    def add_note(self, note_id: str, title: str, content: str, metadata: Optional[dict] = None) -> None:
        """Add or update a note in the memory store."""
        pass

    @abstractmethod
    def add_memory_chunk(self, chunk_id: str, text: str, source_type: str, metadata: Optional[dict] = None) -> None:
        """Add a memory chunk (from conversation, doc, etc.)."""
        pass

    @abstractmethod
    def search(self, query: str, n_results: int = 5, filter_type: Optional[str] = None) -> list[dict]:
        """Search for relevant memories. Returns list of {id, text, score, metadata}."""
        pass

    @abstractmethod
    def get_note(self, note_id: str) -> Optional[dict]:
        """Get a specific note by ID."""
        pass

    @abstractmethod
    def list_notes(self) -> list[dict]:
        """List all notes."""
        pass

    @abstractmethod
    def delete_note(self, note_id: str) -> bool:
        """Delete a note."""
        pass

    @abstractmethod
    def delete_memory_chunk(self, chunk_id: str) -> bool:
        """Delete a memory chunk."""
        pass


class ChromaMemoryStore(MemoryStore):
    """ChromaDB-based memory store for local mode."""

    def __init__(self, persist_path: str):
        self.persist_path = persist_path
        self._client = None
        self._notes_collection = None
        self._chunks_collection = None

    def _get_client(self):
        """Lazy-load ChromaDB client."""
        if self._client is None:
            try:
                import chromadb
                # Use new persistent client API (ChromaDB 0.4+)
                self._client = chromadb.PersistentClient(path=self.persist_path)
            except ImportError:
                raise ImportError("chromadb required for local memory. Install with: pip install chromadb")
        return self._client

    def _get_collections(self):
        """Get or create collections."""
        if self._notes_collection is None:
            client = self._get_client()
            self._notes_collection = client.get_or_create_collection(
                name="notes",
                metadata={"description": "User notes and documents"}
            )
            self._chunks_collection = client.get_or_create_collection(
                name="memory_chunks",
                metadata={"description": "Conversation and document chunks"}
            )
        return self._notes_collection, self._chunks_collection

    def init(self) -> None:
        """Initialize collections."""
        self._get_collections()

    def add_note(self, note_id: str, title: str, content: str, metadata: Optional[dict] = None) -> None:
        """Add or update a note."""
        notes_col, _ = self._get_collections()

        meta = metadata or {}
        meta["title"] = title
        meta["type"] = "note"
        meta["updated_at"] = datetime.now().isoformat()

        # Combine title and content for embedding
        full_text = f"{title}\n\n{content}"

        # Upsert (add or update)
        notes_col.upsert(
            ids=[note_id],
            documents=[full_text],
            metadatas=[meta]
        )

    def add_memory_chunk(self, chunk_id: str, text: str, source_type: str, metadata: Optional[dict] = None) -> None:
        """Add a memory chunk."""
        _, chunks_col = self._get_collections()

        meta = metadata or {}
        meta["source_type"] = source_type
        meta["created_at"] = datetime.now().isoformat()

        chunks_col.upsert(
            ids=[chunk_id],
            documents=[text],
            metadatas=[meta]
        )

    def search(self, query: str, n_results: int = 5, filter_type: Optional[str] = None) -> list[dict]:
        """Search across notes and chunks."""
        notes_col, chunks_col = self._get_collections()
        results = []

        # Search notes
        where_filter = {"type": filter_type} if filter_type else None

        try:
            notes_results = notes_col.query(
                query_texts=[query],
                n_results=min(n_results, 10),
                where=where_filter
            )

            for i, doc_id in enumerate(notes_results["ids"][0]):
                results.append({
                    "id": doc_id,
                    "text": notes_results["documents"][0][i],
                    "score": notes_results["distances"][0][i] if "distances" in notes_results else 0,
                    "metadata": notes_results["metadatas"][0][i],
                    "source": "notes"
                })
        except Exception:
            pass  # Collection might be empty

        # Search chunks if no type filter or type is chunk-related
        if not filter_type or filter_type in ["conversation", "document", "web"]:
            try:
                chunk_where = {"source_type": filter_type} if filter_type else None
                chunk_results = chunks_col.query(
                    query_texts=[query],
                    n_results=min(n_results, 10),
                    where=chunk_where
                )

                for i, doc_id in enumerate(chunk_results["ids"][0]):
                    results.append({
                        "id": doc_id,
                        "text": chunk_results["documents"][0][i],
                        "score": chunk_results["distances"][0][i] if "distances" in chunk_results else 0,
                        "metadata": chunk_results["metadatas"][0][i],
                        "source": "chunks"
                    })
            except Exception:
                pass

        # Sort by score (lower distance = better match in ChromaDB)
        results.sort(key=lambda x: x["score"])
        return results[:n_results]

    def get_note(self, note_id: str) -> Optional[dict]:
        """Get a specific note."""
        notes_col, _ = self._get_collections()

        try:
            result = notes_col.get(ids=[note_id])
            if result["ids"]:
                return {
                    "id": result["ids"][0],
                    "content": result["documents"][0],
                    "metadata": result["metadatas"][0]
                }
        except Exception:
            pass
        return None

    def list_notes(self) -> list[dict]:
        """List all notes."""
        notes_col, _ = self._get_collections()

        try:
            result = notes_col.get()
            notes = []
            for i, note_id in enumerate(result["ids"]):
                meta = result["metadatas"][i]
                notes.append({
                    "id": note_id,
                    "title": meta.get("title", "Untitled"),
                    "updated_at": meta.get("updated_at"),
                    "preview": result["documents"][i][:100] + "..." if len(result["documents"][i]) > 100 else result["documents"][i]
                })
            return sorted(notes, key=lambda x: x.get("updated_at", ""), reverse=True)
        except Exception:
            return []

    def delete_note(self, note_id: str) -> bool:
        """Delete a note."""
        notes_col, _ = self._get_collections()
        try:
            notes_col.delete(ids=[note_id])
            return True
        except Exception:
            return False

    def delete_memory_chunk(self, chunk_id: str) -> bool:
        """Delete a memory chunk."""
        _, chunks_col = self._get_collections()
        try:
            chunks_col.delete(ids=[chunk_id])
            return True
        except Exception:
            return False


class PgVectorMemoryStore(MemoryStore):
    """PostgreSQL + pgvector memory store for cloud mode."""

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

    def init(self) -> None:
        """Create tables and enable pgvector."""
        pool = self._get_pool()
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                # Enable pgvector extension
                cur.execute("CREATE EXTENSION IF NOT EXISTS vector")

                # Notes table with embeddings
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS notes (
                        id TEXT PRIMARY KEY,
                        title TEXT,
                        content TEXT NOT NULL,
                        embedding vector(384),
                        metadata JSONB,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)

                # Memory chunks table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS memory_chunks (
                        id TEXT PRIMARY KEY,
                        text TEXT NOT NULL,
                        source_type TEXT NOT NULL,
                        embedding vector(384),
                        metadata JSONB,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)

                # Create indexes for vector similarity search
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS notes_embedding_idx
                    ON notes USING ivfflat (embedding vector_cosine_ops)
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS chunks_embedding_idx
                    ON memory_chunks USING ivfflat (embedding vector_cosine_ops)
                """)

            conn.commit()
        finally:
            pool.putconn(conn)

    def _get_embedding(self, text: str) -> list[float]:
        """Get embedding for text. Uses a simple hash-based approach for now.
        In production, use sentence-transformers or OpenAI embeddings."""
        # Placeholder: In production, use actual embedding model
        # For now, return a deterministic pseudo-embedding based on hash
        import hashlib
        hash_bytes = hashlib.sha384(text.encode()).digest()
        # Convert to 384-dim float vector normalized between -1 and 1
        embedding = [(b - 128) / 128.0 for b in hash_bytes]
        return embedding

    def add_note(self, note_id: str, title: str, content: str, metadata: Optional[dict] = None) -> None:
        """Add or update a note."""
        pool = self._get_pool()
        conn = pool.getconn()
        try:
            full_text = f"{title}\n\n{content}"
            embedding = self._get_embedding(full_text)

            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO notes (id, title, content, embedding, metadata, updated_at)
                    VALUES (%s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        title = EXCLUDED.title,
                        content = EXCLUDED.content,
                        embedding = EXCLUDED.embedding,
                        metadata = EXCLUDED.metadata,
                        updated_at = NOW()
                """, (note_id, title, content, embedding, json.dumps(metadata or {})))
            conn.commit()
        finally:
            pool.putconn(conn)

    def add_memory_chunk(self, chunk_id: str, text: str, source_type: str, metadata: Optional[dict] = None) -> None:
        """Add a memory chunk."""
        pool = self._get_pool()
        conn = pool.getconn()
        try:
            embedding = self._get_embedding(text)

            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO memory_chunks (id, text, source_type, embedding, metadata)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        text = EXCLUDED.text,
                        source_type = EXCLUDED.source_type,
                        embedding = EXCLUDED.embedding,
                        metadata = EXCLUDED.metadata
                """, (chunk_id, text, source_type, embedding, json.dumps(metadata or {})))
            conn.commit()
        finally:
            pool.putconn(conn)

    def search(self, query: str, n_results: int = 5, filter_type: Optional[str] = None) -> list[dict]:
        """Search using vector similarity."""
        pool = self._get_pool()
        conn = pool.getconn()
        results = []

        try:
            query_embedding = self._get_embedding(query)

            with conn.cursor() as cur:
                # Search notes
                if not filter_type or filter_type == "note":
                    cur.execute("""
                        SELECT id, title || E'\n\n' || content as text,
                               1 - (embedding <=> %s::vector) as score,
                               metadata
                        FROM notes
                        ORDER BY embedding <=> %s::vector
                        LIMIT %s
                    """, (query_embedding, query_embedding, n_results))

                    for row in cur.fetchall():
                        results.append({
                            "id": row[0],
                            "text": row[1],
                            "score": row[2],
                            "metadata": row[3],
                            "source": "notes"
                        })

                # Search chunks
                if not filter_type or filter_type in ["conversation", "document", "web"]:
                    where_clause = "WHERE source_type = %s" if filter_type else ""
                    params = [query_embedding, query_embedding]
                    if filter_type:
                        params.insert(0, filter_type)
                    params.append(n_results)

                    cur.execute(f"""
                        SELECT id, text,
                               1 - (embedding <=> %s::vector) as score,
                               metadata
                        FROM memory_chunks
                        {where_clause}
                        ORDER BY embedding <=> %s::vector
                        LIMIT %s
                    """, params)

                    for row in cur.fetchall():
                        results.append({
                            "id": row[0],
                            "text": row[1],
                            "score": row[2],
                            "metadata": row[3],
                            "source": "chunks"
                        })
        finally:
            pool.putconn(conn)

        # Sort by score (higher = better match)
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:n_results]

    def get_note(self, note_id: str) -> Optional[dict]:
        """Get a specific note."""
        pool = self._get_pool()
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, title, content, metadata, updated_at FROM notes WHERE id = %s",
                    (note_id,)
                )
                row = cur.fetchone()
                if row:
                    return {
                        "id": row[0],
                        "title": row[1],
                        "content": row[2],
                        "metadata": row[3],
                        "updated_at": row[4].isoformat() if row[4] else None
                    }
        finally:
            pool.putconn(conn)
        return None

    def list_notes(self) -> list[dict]:
        """List all notes."""
        pool = self._get_pool()
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, title, LEFT(content, 100) as preview, updated_at
                    FROM notes
                    ORDER BY updated_at DESC
                """)
                return [
                    {
                        "id": row[0],
                        "title": row[1],
                        "preview": row[2] + "..." if len(row[2]) >= 100 else row[2],
                        "updated_at": row[3].isoformat() if row[3] else None
                    }
                    for row in cur.fetchall()
                ]
        finally:
            pool.putconn(conn)

    def delete_note(self, note_id: str) -> bool:
        """Delete a note."""
        pool = self._get_pool()
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM notes WHERE id = %s", (note_id,))
                deleted = cur.rowcount > 0
            conn.commit()
            return deleted
        finally:
            pool.putconn(conn)

    def delete_memory_chunk(self, chunk_id: str) -> bool:
        """Delete a memory chunk."""
        pool = self._get_pool()
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM memory_chunks WHERE id = %s", (chunk_id,))
                deleted = cur.rowcount > 0
            conn.commit()
            return deleted
        finally:
            pool.putconn(conn)


# Singleton instance
_memory_store: Optional[MemoryStore] = None


def get_memory() -> MemoryStore:
    """Get the memory store instance."""
    global _memory_store
    if _memory_store is None:
        if Config.is_local():
            from pathlib import Path
            persist_path = str(Path(Config.SQLITE_PATH).parent / "chroma_db")
            _memory_store = ChromaMemoryStore(persist_path)
        else:
            _memory_store = PgVectorMemoryStore(Config.DATABASE_URL)
    return _memory_store


def init_memory() -> None:
    """Initialize the memory store."""
    mem = get_memory()
    mem.init()
