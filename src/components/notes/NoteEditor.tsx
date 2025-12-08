import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import { createNote, updateNote, type Note } from "@/lib/supabase-api";

interface NoteEditorProps {
  note: Note | null;
  onSave: () => void;
  onCancel: () => void;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ note, onSave, onCancel }) => {
  const [content, setContent] = useState(note?.content || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return;

    setIsSaving(true);
    const result = note
      ? await updateNote(note.id, content)
      : await createNote(content);

    setIsSaving(false);
    if (result) {
      onSave();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="font-semibold text-sm">
          {note ? "Edit Note" : "New Note"}
        </span>
        <Button
          size="sm"
          className="ml-auto"
          onClick={handleSave}
          disabled={isSaving || !content.trim()}
        >
          <Save className="h-4 w-4 mr-1" />
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Editor */}
      <div className="flex-1 p-4 overflow-auto">
        <Textarea
          placeholder="Write your note... (first line becomes the title)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 min-h-[300px] resize-none"
        />
      </div>
    </div>
  );
};

export default NoteEditor;
