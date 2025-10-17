import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Brain, Mic, Type } from "lucide-react";
import VoiceRecorder from "@/components/VoiceRecorder";

const Home = () => {
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const [noteText, setNoteText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!noteText.trim()) {
      toast.error("Please enter some content");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Insert the note
      const { data: note, error: noteError } = await supabase
        .from("notes")
        .insert([{ content: noteText, user_id: user.id }])
        .select()
        .single();

      if (noteError) throw noteError;

      // Call categorize-note function
      const { data: { session } } = await supabase.auth.getSession();
      const categoryResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/categorize-note`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ noteContent: noteText }),
        }
      );

      if (categoryResponse.ok) {
        const { categoryId } = await categoryResponse.json();
        await supabase
          .from("notes")
          .update({ category_id: categoryId })
          .eq("id", note.id);
      }

      // Generate embeddings
      const embeddingResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-embeddings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ noteId: note.id }),
        }
      );

      // Auto-link notes
      if (embeddingResponse.ok) {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-link-notes`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({ noteId: note.id }),
          }
        );
      }

      toast.success("Thought saved!");
      setNoteText("");
      
      // Navigate to dashboard after saving
      setTimeout(() => navigate("/dashboard"), 500);
    } catch (error: any) {
      console.error("Error saving note:", error);
      toast.error(error.message || "Failed to save thought");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTranscriptComplete = async (transcript: string) => {
    if (!transcript.trim()) {
      toast.error("No transcript available");
      return;
    }

    // Auto-save in background
    toast.info("Processing and saving...");
    setIsSubmitting(true);
    setNoteText(transcript);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Insert the note
      const { data: note, error: noteError } = await supabase
        .from("notes")
        .insert([{ content: transcript, user_id: user.id }])
        .select()
        .single();

      if (noteError) throw noteError;

      // Call categorize-note function
      const { data: { session } } = await supabase.auth.getSession();
      const categoryResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/categorize-note`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ noteContent: transcript }),
        }
      );

      if (categoryResponse.ok) {
        const { categoryId } = await categoryResponse.json();
        await supabase
          .from("notes")
          .update({ category_id: categoryId })
          .eq("id", note.id);
      }

      // Generate embeddings
      const embeddingResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-embeddings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ noteId: note.id }),
        }
      );

      // Auto-link notes
      if (embeddingResponse.ok) {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-link-notes`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({ noteId: note.id }),
          }
        );
      }

      toast.success("Thought saved!");
      setNoteText("");
      
      // Navigate to dashboard after saving
      setTimeout(() => navigate("/dashboard"), 500);
    } catch (error: any) {
      console.error("Error saving note:", error);
      toast.error(error.message || "Failed to save thought");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--gradient-subtle)" }}>
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
            <Brain className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Second Brain
          </h1>
          <p className="text-muted-foreground">Capture your thoughts instantly</p>
        </div>

        <Card className="p-8 shadow-soft border-border/50 bg-card/80 backdrop-blur">
          <div className="flex gap-2 mb-6">
            <Button
              variant={inputMode === "text" ? "default" : "outline"}
              onClick={() => setInputMode("text")}
              className="flex-1"
            >
              <Type className="mr-2 h-4 w-4" />
              Text
            </Button>
            <Button
              variant={inputMode === "voice" ? "default" : "outline"}
              onClick={() => setInputMode("voice")}
              className="flex-1"
            >
              <Mic className="mr-2 h-4 w-4" />
              Voice
            </Button>
          </div>

          {inputMode === "text" ? (
            <div className="space-y-4">
              <Textarea
                placeholder="What's on your mind?"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="min-h-[200px] text-lg"
                autoFocus
              />
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !noteText.trim()}
                className="w-full h-12 text-lg"
              >
                {isSubmitting ? "Saving..." : "Save Thought"}
              </Button>
            </div>
          ) : (
            <VoiceRecorder onTranscriptComplete={handleTranscriptComplete} />
          )}

          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="w-full mt-4"
          >
            View Dashboard
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default Home;
