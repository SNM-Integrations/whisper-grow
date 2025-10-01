import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Note {
  id: string;
  content: string;
  formatted_content: string | null;
  created_at: string;
  note_type: string;
  parent_note_id: string | null;
  categories: {
    name: string;
  } | null;
}

interface ParentNote {
  content: string;
  formatted_content: string | null;
}

interface ObsidianStyleNoteViewProps {
  categoryId: string;
  categoryName: string;
  onClose: () => void;
  onNoteDeleted: () => void;
}

const ObsidianStyleNoteView = ({ categoryId, categoryName, onClose, onNoteDeleted }: ObsidianStyleNoteViewProps) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [parentNote, setParentNote] = useState<ParentNote | null>(null);

  useEffect(() => {
    fetchNotes();
  }, [categoryId]);

  useEffect(() => {
    fetchParentNote();
  }, [currentIndex, notes]);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First, get all subcategory IDs
      const { data: subcategories } = await supabase
        .from('categories')
        .select('id')
        .eq('parent_id', categoryId);

      const categoryIds = [categoryId, ...(subcategories?.map(c => c.id) || [])];

      // Fetch notes from this category and all subcategories
      const { data, error } = await supabase
        .from('notes')
        .select(`
          id,
          content,
          formatted_content,
          created_at,
          note_type,
          parent_note_id,
          categories (name)
        `)
        .eq('user_id', user.id)
        .in('category_id', categoryIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setNotes(data as Note[]);
    } catch (error) {
      console.error("Error fetching notes:", error);
      toast.error("Failed to load notes");
    } finally {
      setLoading(false);
    }
  };

  const fetchParentNote = async () => {
    const currentNote = notes[currentIndex];
    if (!currentNote?.parent_note_id) {
      setParentNote(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notes')
        .select('content, formatted_content')
        .eq('id', currentNote.parent_note_id)
        .single();

      if (error) throw error;
      setParentNote(data);
    } catch (error) {
      console.error("Error fetching parent note:", error);
      setParentNote(null);
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      toast.success("Note deleted");
      fetchNotes();
      onNoteDeleted();
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Failed to delete note");
    }
  };

  const currentNote = notes[currentIndex];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading notes...</p>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <p className="text-muted-foreground mb-4">No notes in this category yet</p>
        <Button onClick={onClose} variant="outline">
          Back to Graph
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Back to Graph
            </Button>
            <div className="h-4 w-px bg-border" />
            <Badge variant="secondary" className="text-sm">
              {categoryName}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {notes.length} {notes.length === 1 ? 'note' : 'notes'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {notes.length > 1 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {currentIndex + 1} / {notes.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentIndex(Math.min(notes.length - 1, currentIndex + 1))}
                  disabled={currentIndex === notes.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            <div className="h-4 w-px bg-border ml-2" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDelete(currentNote.id)}
              className="gap-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="px-6 py-12">
          <Card className="p-12 bg-card border-border shadow-lg">
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline">
                  {currentNote.categories?.name || "Uncategorized"}
                </Badge>
                {currentNote.note_type === 'extracted' && (
                  <Badge variant="secondary">Extracted Topic</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(currentNote.created_at), "EEEE, MMMM d, yyyy 'at' h:mm a")}
              </p>
            </div>

            <div className="prose prose-lg dark:prose-invert max-w-none">
              {currentNote.note_type === 'extracted' && (
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-4">Extracted Topic</h3>
                  <div className="text-lg leading-relaxed whitespace-pre-wrap mb-8 p-4 bg-accent/10 rounded-lg border-l-4 border-primary">
                    {currentNote.formatted_content || currentNote.content}
                  </div>
                  
                  {parentNote && (
                    <>
                      <h3 className="text-xl font-semibold mb-4 mt-12">Full Original Transcript</h3>
                      <div className="text-base leading-relaxed whitespace-pre-wrap text-muted-foreground">
                        {parentNote.formatted_content || parentNote.content}
                      </div>
                    </>
                  )}
                </div>
              )}
              
              {currentNote.note_type !== 'extracted' && (
                <div className="text-lg leading-relaxed whitespace-pre-wrap">
                  {currentNote.formatted_content || currentNote.content}
                </div>
              )}
            </div>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
};

export default ObsidianStyleNoteView;
