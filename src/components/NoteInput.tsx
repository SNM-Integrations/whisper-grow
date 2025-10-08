import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Type, Send, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import ConversationalInterface from "./ConversationalInterface";
import AudioUpload from "./AudioUpload";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface NoteInputProps {
  onNoteCreated: () => void;
}

const NoteInput = ({ onNoteCreated }: NoteInputProps) => {
  const [inputMode, setInputMode] = useState<"text" | "conversation" | "upload">("text");
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

      // First, use AI to classify the input
      const { data: smartData, error: smartError } = await supabase.functions.invoke(
        'process-smart-input',
        { body: { text: noteText } }
      );

      if (smartError) {
        console.error('Smart input processing failed:', smartError);
        // Fall back to regular note creation
        await createNote(noteText);
        return;
      }

      console.log('AI classified input as:', smartData.type, smartData.data);

      // Route based on AI classification
      if (smartData.type === 'EVENT') {
        await createCalendarEvent(smartData.data);
      } else if (smartData.type === 'TASK') {
        await createTask(smartData.data);
      } else {
        await createNote(smartData.data.content, smartData.data.category);
      }
    } catch (error) {
      console.error("Error processing input:", error);
      toast.error("Failed to save");
    } finally {
      setIsSubmitting(false);
    }
  };

  const createNote = async (content: string, suggestedCategory?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Get AI categorization
    const { data: categoryData, error: categoryError } = await supabase.functions.invoke(
      'categorize-note',
      { body: { noteContent: content, userId: user.id } }
    );

    if (categoryError) throw categoryError;

    // Create the note
    const { data: newNote, error: noteError } = await supabase
      .from('notes')
      .insert({
        content: content,
        category_id: categoryData.categoryId,
        user_id: user.id
      })
      .select()
      .single();

    if (noteError) throw noteError;

      // Generate embedding and auto-link (fire and forget)
      if (newNote) {
        const { data: { session } } = await supabase.auth.getSession();
        
        // Generate embeddings
        const embeddingResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-embeddings`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({ noteId: newNote.id }),
          }
        );

        // Auto-link notes if embedding was successful
        if (embeddingResponse.ok) {
          fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-link-notes`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session?.access_token}`,
              },
              body: JSON.stringify({ noteId: newNote.id }),
            }
          ).catch(err => console.error('Auto-linking failed:', err));
        }
      }

    toast.success(`Note added to ${categoryData.categoryName}`);
    setNoteText("");
    onNoteCreated();
  };

  const createCalendarEvent = async (eventData: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Construct date-time from extracted data
    const startDate = new Date(eventData.date);
    if (eventData.time) {
      const [hours, minutes] = eventData.time.split(':');
      startDate.setHours(parseInt(hours), parseInt(minutes), 0);
    } else {
      startDate.setHours(9, 0, 0); // Default to 9 AM
    }

    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + (eventData.duration_minutes || 60));

    const { error } = await supabase
      .from('calendar_events')
      .insert({
        user_id: user.id,
        title: eventData.title,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        location: eventData.location,
      });

    if (error) throw error;

    toast.success(`Calendar event "${eventData.title}" created`);
    setNoteText("");
    onNoteCreated();
  };

  const createTask = async (taskData: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        title: taskData.title,
        description: taskData.description,
        due_date: taskData.due_date ? new Date(taskData.due_date).toISOString() : null,
        priority: taskData.priority || 'medium',
      });

    if (error) throw error;

    toast.success(`Task "${taskData.title}" created`);
    setNoteText("");
    onNoteCreated();
  };

  const handleTranscriptComplete = async (text: string) => {
    if (!text.trim()) {
      toast.error("No text transcribed");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: { session } } = await supabase.auth.getSession();

      // Step 1: Format the transcript
      const { data: formatData, error: formatError } = await supabase.functions.invoke(
        'format-transcript',
        { body: { rawTranscript: text } }
      );

      if (formatError) throw formatError;
      const formattedText = formatData.formattedText || text;

      // Step 2: Extract topics from formatted text
      const { data: topicsData, error: topicsError } = await supabase.functions.invoke(
        'extract-topics',
        { body: { noteContent: formattedText } }
      );

      if (topicsError) throw topicsError;
      const extractedTopics = topicsData.topics || [];

      // Step 3a: Create original note with full transcript
      const { data: categoryData, error: categoryError } = await supabase.functions.invoke(
        'categorize-note',
        { body: { noteContent: formattedText, userId: user.id } }
      );

      if (categoryError) throw categoryError;

      const { data: originalNote, error: originalError } = await supabase
        .from('notes')
        .insert({
          content: text,
          formatted_content: formattedText,
          category_id: categoryData.categoryId,
          user_id: user.id,
          note_type: 'original'
        })
        .select()
        .single();

      if (originalError) throw originalError;

      // Generate embedding for original note
      fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-embeddings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ noteId: originalNote.id }),
        }
      ).catch(err => console.error('Embedding failed:', err));

      // Step 3b: Create extracted topic notes if any exist
      if (extractedTopics.length > 0) {
        for (const topic of extractedTopics) {
          const { data: topicCategory } = await supabase.functions.invoke(
            'categorize-note',
            { body: { noteContent: topic.excerpt, userId: user.id } }
          );

          if (topicCategory) {
            const { data: topicNote } = await supabase
              .from('notes')
              .insert({
                content: topic.excerpt,
                formatted_content: topic.excerpt,
                category_id: topicCategory.categoryId,
                user_id: user.id,
                note_type: 'extracted',
                parent_note_id: originalNote.id
              })
              .select()
              .single();

            if (topicNote) {
              // Generate embedding for each topic
              fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-embeddings`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session?.access_token}`,
                  },
                  body: JSON.stringify({ noteId: topicNote.id }),
                }
              ).catch(err => console.error('Embedding failed:', err));
            }
          }
        }

        toast.success(`Note saved with ${extractedTopics.length} topic${extractedTopics.length > 1 ? 's' : ''} extracted`);
      } else {
        toast.success(`Note added to ${categoryData.categoryName}`);
      }

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
          variant={inputMode === "conversation" ? "default" : "outline"}
          size="sm"
          onClick={() => setInputMode("conversation")}
          className="flex-1"
        >
          <Mic className="h-4 w-4 mr-2" />
          AI Conversation
        </Button>
        <Button
          variant={inputMode === "upload" ? "default" : "outline"}
          size="sm"
          onClick={() => setInputMode("upload")}
          className="flex-1"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload
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
      ) : inputMode === "conversation" ? (
        <div className="py-8">
          <ConversationalInterface onNoteCreated={onNoteCreated} />
        </div>
      ) : (
        <div className="py-8">
          <AudioUpload onTranscriptComplete={handleTranscriptComplete} />
        </div>
      )}
    </Card>
  );
};

export default NoteInput;