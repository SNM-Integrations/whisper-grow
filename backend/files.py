"""
File operations abstraction layer for Second Brain.

Provides safe file operations within a designated workspace.

Supports two modes:
- LOCAL: Direct file system access within workspace folder
- CLOUD: Cloud storage (S3, etc.) - future implementation

Usage:
    from files import get_file_manager

    fm = get_file_manager()
    files = fm.list_files("notes/")
    content = fm.read_file("notes/meeting.md")
    fm.write_file("notes/new.md", "# My Note")
"""

from abc import ABC, abstractmethod
from typing import Optional
from datetime import datetime
from pathlib import Path
import os
import fnmatch

from config import Config


class FileManager(ABC):
    """Abstract base class for file operations."""

    @abstractmethod
    def list_files(self, path: str = "", pattern: str = "*") -> list[dict]:
        """List files in a directory. Returns list of {name, path, type, size, modified}."""
        pass

    @abstractmethod
    def read_file(self, path: str) -> Optional[str]:
        """Read a file's contents. Returns None if file doesn't exist."""
        pass

    @abstractmethod
    def write_file(self, path: str, content: str) -> dict:
        """Write content to a file. Creates parent directories if needed."""
        pass

    @abstractmethod
    def append_file(self, path: str, content: str) -> dict:
        """Append content to a file."""
        pass

    @abstractmethod
    def delete_file(self, path: str) -> bool:
        """Delete a file. Returns True if deleted."""
        pass

    @abstractmethod
    def search_files(self, query: str, path: str = "", file_pattern: str = "*") -> list[dict]:
        """Search for files containing query text. Returns list of {path, matches}."""
        pass

    @abstractmethod
    def file_exists(self, path: str) -> bool:
        """Check if a file exists."""
        pass

    @abstractmethod
    def create_folder(self, path: str) -> dict:
        """Create a folder (and parent directories)."""
        pass


class LocalFileManager(FileManager):
    """Local file system manager with workspace sandboxing."""

    def __init__(self, workspace_path: str):
        self.workspace = Path(workspace_path).resolve()
        # Create workspace if it doesn't exist
        self.workspace.mkdir(parents=True, exist_ok=True)

    def _safe_path(self, path: str) -> Path:
        """Resolve path within workspace, preventing directory traversal."""
        # Normalize and resolve the path
        clean_path = path.lstrip("/\\")
        full_path = (self.workspace / clean_path).resolve()

        # Ensure it's within workspace (prevent ../ attacks)
        if not str(full_path).startswith(str(self.workspace)):
            raise ValueError(f"Path '{path}' is outside workspace")

        return full_path

    def list_files(self, path: str = "", pattern: str = "*") -> list[dict]:
        """List files in a directory."""
        try:
            dir_path = self._safe_path(path)

            if not dir_path.exists():
                return []

            if not dir_path.is_dir():
                return []

            results = []
            for item in dir_path.iterdir():
                if not fnmatch.fnmatch(item.name, pattern):
                    continue

                stat = item.stat()
                rel_path = str(item.relative_to(self.workspace))

                results.append({
                    "name": item.name,
                    "path": rel_path.replace("\\", "/"),
                    "type": "folder" if item.is_dir() else "file",
                    "size": stat.st_size if item.is_file() else None,
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                })

            # Sort: folders first, then by name
            results.sort(key=lambda x: (x["type"] != "folder", x["name"].lower()))
            return results

        except ValueError as e:
            raise e
        except Exception:
            return []

    def read_file(self, path: str) -> Optional[str]:
        """Read a file's contents."""
        try:
            file_path = self._safe_path(path)

            if not file_path.exists() or not file_path.is_file():
                return None

            return file_path.read_text(encoding="utf-8")

        except ValueError as e:
            raise e
        except Exception:
            return None

    def write_file(self, path: str, content: str) -> dict:
        """Write content to a file."""
        try:
            file_path = self._safe_path(path)

            # Create parent directories
            file_path.parent.mkdir(parents=True, exist_ok=True)

            # Write file
            file_path.write_text(content, encoding="utf-8")

            return {
                "path": path,
                "size": len(content),
                "created": not file_path.exists(),
                "modified": datetime.now().isoformat(),
            }

        except ValueError as e:
            raise e
        except Exception as e:
            raise RuntimeError(f"Failed to write file: {e}")

    def append_file(self, path: str, content: str) -> dict:
        """Append content to a file."""
        try:
            file_path = self._safe_path(path)

            # Create parent directories
            file_path.parent.mkdir(parents=True, exist_ok=True)

            # Append to file
            with open(file_path, "a", encoding="utf-8") as f:
                f.write(content)

            stat = file_path.stat()
            return {
                "path": path,
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            }

        except ValueError as e:
            raise e
        except Exception as e:
            raise RuntimeError(f"Failed to append to file: {e}")

    def delete_file(self, path: str) -> bool:
        """Delete a file."""
        try:
            file_path = self._safe_path(path)

            if not file_path.exists():
                return False

            if file_path.is_file():
                file_path.unlink()
                return True
            elif file_path.is_dir():
                # Only delete empty directories for safety
                if not any(file_path.iterdir()):
                    file_path.rmdir()
                    return True
                else:
                    raise ValueError("Cannot delete non-empty directory")

            return False

        except ValueError as e:
            raise e
        except Exception:
            return False

    def search_files(self, query: str, path: str = "", file_pattern: str = "*") -> list[dict]:
        """Search for files containing query text."""
        try:
            search_path = self._safe_path(path)

            if not search_path.exists():
                return []

            results = []
            query_lower = query.lower()

            # Walk through directory
            for root, dirs, files in os.walk(search_path):
                for filename in files:
                    if not fnmatch.fnmatch(filename, file_pattern):
                        continue

                    file_path = Path(root) / filename
                    rel_path = str(file_path.relative_to(self.workspace))

                    try:
                        content = file_path.read_text(encoding="utf-8")
                        content_lower = content.lower()

                        if query_lower in content_lower:
                            # Find matching lines
                            matches = []
                            for i, line in enumerate(content.split("\n"), 1):
                                if query_lower in line.lower():
                                    matches.append({
                                        "line": i,
                                        "text": line.strip()[:200],  # Limit line length
                                    })
                                    if len(matches) >= 5:  # Limit matches per file
                                        break

                            results.append({
                                "path": rel_path.replace("\\", "/"),
                                "name": filename,
                                "matches": matches,
                                "match_count": len(matches),
                            })

                    except Exception:
                        continue  # Skip files that can't be read

                    if len(results) >= 20:  # Limit total results
                        break

            # Sort by number of matches
            results.sort(key=lambda x: x["match_count"], reverse=True)
            return results

        except ValueError as e:
            raise e
        except Exception:
            return []

    def file_exists(self, path: str) -> bool:
        """Check if a file exists."""
        try:
            file_path = self._safe_path(path)
            return file_path.exists()
        except Exception:
            return False

    def create_folder(self, path: str) -> dict:
        """Create a folder."""
        try:
            folder_path = self._safe_path(path)
            folder_path.mkdir(parents=True, exist_ok=True)

            return {
                "path": path,
                "created": True,
            }

        except ValueError as e:
            raise e
        except Exception as e:
            raise RuntimeError(f"Failed to create folder: {e}")


class CloudFileManager(FileManager):
    """Cloud storage file manager (S3, etc.) - placeholder for future."""

    def __init__(self, config: dict):
        self.config = config
        # TODO: Implement cloud storage (S3, GCS, etc.)
        raise NotImplementedError("Cloud file storage not yet implemented")

    def list_files(self, path: str = "", pattern: str = "*") -> list[dict]:
        raise NotImplementedError()

    def read_file(self, path: str) -> Optional[str]:
        raise NotImplementedError()

    def write_file(self, path: str, content: str) -> dict:
        raise NotImplementedError()

    def append_file(self, path: str, content: str) -> dict:
        raise NotImplementedError()

    def delete_file(self, path: str) -> bool:
        raise NotImplementedError()

    def search_files(self, query: str, path: str = "", file_pattern: str = "*") -> list[dict]:
        raise NotImplementedError()

    def file_exists(self, path: str) -> bool:
        raise NotImplementedError()

    def create_folder(self, path: str) -> dict:
        raise NotImplementedError()


# Singleton instance
_file_manager: Optional[FileManager] = None


def get_file_manager() -> FileManager:
    """Get the file manager instance."""
    global _file_manager
    if _file_manager is None:
        if Config.is_local():
            # Use workspace folder next to the database
            workspace = Path(Config.SQLITE_PATH).parent / "workspace"
            _file_manager = LocalFileManager(str(workspace))
        else:
            # Cloud mode - not yet implemented
            raise NotImplementedError("Cloud file storage not yet implemented")
    return _file_manager
