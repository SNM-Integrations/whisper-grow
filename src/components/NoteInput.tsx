import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Type, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import VoiceRecorder from "./VoiceRecorder";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface NoteInputProps {
  onNoteCreated: () => void;
}

const NoteInput = ({ onNoteCreated }: NoteInputProps) => {
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const [noteText, setNoteText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!noteText.trim()) {
      toast.error("Please enter some text");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get AI categorization
      const { data: categoryData, error: categoryError } = await supabase.functions.invoke(
        'categorize-note',
        {
          body: { noteContent: noteText, userId: user.id }
        }
      );

      if (categoryError) throw categoryError;

      // Create the note
      const { data: newNote, error: noteError } = await supabase
        .from('notes')
        .insert({
          content: noteText,
          category_id: categoryData.categoryId,
          user_id: user.id
        })
        .select()
        .single();

      if (noteError) throw noteError;

      // Generate embedding for the note (fire and forget)
      if (newNote) {
        supabase.functions.invoke('generate-embeddings', {
          body: { noteId: newNote.id, content: noteText }
        }).catch(err => console.error('Embedding generation failed:', err));
      }

      toast.success(`Note added to ${categoryData.categoryName}`);
      setNoteText("");
      onNoteCreated();
    } catch (error) {
      console.error("Error creating note:", error);
      toast.error("Failed to create note");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTranscriptComplete = async (text: string) => {
    setNoteText(text);
    setInputMode("text");
    
    // Automatically save the transcribed note
    if (!text.trim()) {
      toast.error("No text transcribed");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get AI categorization
      const { data: categoryData, error: categoryError } = await supabase.functions.invoke(
        'categorize-note',
        {
          body: { noteContent: text, userId: user.id }
        }
      );

      if (categoryError) throw categoryError;

      // Create the note
      const { data: newNote, error: noteError } = await supabase
        .from('notes')
        .insert({
          content: text,
          category_id: categoryData.categoryId,
          user_id: user.id
        })
        .select()
        .single();

      if (noteError) throw noteError;

      // Generate embedding for the note (fire and forget)
      if (newNote) {
        supabase.functions.invoke('generate-embeddings', {
          body: { noteId: newNote.id, content: text }
        }).catch(err => console.error('Embedding generation failed:', err));
      }

      toast.success(`Note added to ${categoryData.categoryName}`);
      setNoteText("");
      onNoteCreated();
    } catch (error) {
      console.error("Error creating note:", error);
      toast.error("Failed to create note");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-6 shadow-soft border-border/50 bg-card/80 backdrop-blur">
      <div className="flex gap-2 mb-4">
        <Button
          variant={inputMode === "text" ? "default" : "outline"}
          size="sm"
          onClick={() => setInputMode("text")}
          className="flex-1"
        >
          <Type className="h-4 w-4 mr-2" />
          Text
        </Button>
        <Button
          variant={inputMode === "voice" ? "default" : "outline"}
          size="sm"
          onClick={() => setInputMode("voice")}
          className="flex-1"
        >
          <Mic className="h-4 w-4 mr-2" />
          Voice
        </Button>
      </div>

      {inputMode === "text" ? (
        <div className="space-y-4">
          <Textarea
            placeholder="What's on your mind?"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="min-h-[120px] resize-none border-border/50 focus:border-primary transition-colors"
          />
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !noteText.trim()}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? "Saving..." : "Save Thought"}
          </Button>
        </div>
      ) : (
        <div className="py-8">
          <VoiceRecorder onTranscriptComplete={handleTranscriptComplete} />
        </div>
      )}
    </Card>
  );
};

export default NoteInput;