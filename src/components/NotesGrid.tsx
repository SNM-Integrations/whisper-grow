import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import NoteDialog from "./NoteDialog";

interface Note {
  id: string;
  content: string;
  formatted_content: string | null;
  created_at: string;
  note_type: string;
  categories: {
    name: string;
  } | null;
}

interface NotesGridProps {
  selectedCategory: string | null;
  refreshTrigger: number;
  onNoteDeleted: () => void;
}

const NotesGrid = ({ selectedCategory, refreshTrigger, onNoteDeleted }: NotesGridProps) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, [selectedCategory, refreshTrigger]);

  const fetchNotes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
      .from('notes')
      .select(`
        id,
        content,
        formatted_content,
        note_type,
        created_at,
        categories (name)
      `)
      .eq('user_id', user.id)
      .eq('note_type', 'original')
      .order('created_at', { ascending: false });

    if (selectedCategory) {
      query = query.eq('category_id', selectedCategory);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching notes:", error);
      return;
    }

    setNotes(data as Note[]);
  };

  const handleDelete = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      toast.success("Note deleted");
      onNoteDeleted();
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Failed to delete note");
    }
  };

  const handleViewNote = (note: Note) => {
    setSelectedNote(note);
    setDialogOpen(true);
  };

  if (notes.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        <p>No thoughts captured yet. Start by adding one above!</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {notes.map((note) => (
          <Card
            key={note.id}
            className="p-6 shadow-soft border-border/50 bg-card/80 backdrop-blur hover:shadow-glow transition-all cursor-pointer"
            onClick={() => handleViewNote(note)}
          >
            <div className="flex justify-between items-start mb-3">
              <Badge variant="secondary" className="text-xs">
                {note.categories?.name || "Uncategorized"}
              </Badge>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewNote(note);
                  }}
                  className="h-8 w-8 p-0 hover:bg-accent"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(note.id);
                  }}
                  className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-sm leading-relaxed mb-3 line-clamp-3">
              {note.formatted_content || note.content}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(note.created_at), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </Card>
        ))}
      </div>

      <NoteDialog 
        note={selectedNote}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
};

export default NotesGrid;