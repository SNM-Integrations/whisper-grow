import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, FileText, Search, Trash2, FolderSync } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchNotes, deleteNote, type Note } from "@/lib/supabase-api";
import NoteEditor from "./NoteEditor";
import GoogleDriveNotesSync from "./GoogleDriveNotesSync";

interface NotesPanelProps {
  onClose?: () => void;
}

const NotesPanel: React.FC<NotesPanelProps> = ({ onClose }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    setIsLoading(true);
    const data = await fetchNotes();
    setNotes(data);
    setIsLoading(false);
  };

  const handleSearch = async () => {
    // Search is now done client-side via filteredNotes
    // Could add server-side search later with Supabase full-text search
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (await deleteNote(id)) {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedNote?.id === id) {
        setSelectedNote(null);
      }
    }
  };

  const handleSave = () => {
    loadNotes();
    setSelectedNote(null);
    setIsCreating(false);
  };

  // Extract title from first line of content or use placeholder
  const getTitle = (note: Note) => {
    const firstLine = note.content.split('\n')[0].trim();
    return firstLine.length > 50 ? firstLine.slice(0, 50) + '...' : firstLine || 'Untitled';
  };

  const filteredNotes = search
    ? notes.filter(
        (n) =>
          n.content.toLowerCase().includes(search.toLowerCase())
      )
    : notes;

  // Show editor when creating or editing
  if (isCreating || selectedNote) {
    return (
      <NoteEditor
        note={selectedNote}
        onSave={handleSave}
        onCancel={() => {
          setSelectedNote(null);
          setIsCreating(false);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Notes
          </h2>
          <div className="flex items-center gap-2">
            <GoogleDriveNotesSync onSyncComplete={loadNotes} />
            <Button size="sm" onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9"
          />
        </div>
      </div>

      {/* Notes list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Loading notes...
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              {search ? "No notes found" : "No notes yet. Create one!"}
            </div>
          ) : (
            filteredNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => setSelectedNote(note)}
                className={cn(
                  "w-full text-left p-3 rounded-lg hover:bg-accent transition-colors group"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate text-sm font-medium">
                        {getTitle(note)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {note.content}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={(e) => handleDelete(note.id, e)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default NotesPanel;
