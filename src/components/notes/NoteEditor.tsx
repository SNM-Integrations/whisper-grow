import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import { createNote, updateNote, type Note } from "@/lib/api";

interface NoteEditorProps {
  note: Note | null;
  onSave: () => void;
  onCancel: () => void;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ note, onSave, onCancel }) => {
  const [title, setTitle] = useState(note?.title || "");
  const [content, setContent] = useState(note?.content || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return;
    
    setIsSaving(true);
    const result = note
      ? await updateNote(note.id, title || "Untitled", content)
      : await createNote(title || "Untitled", content);
    
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
      <div className="flex-1 p-4 space-y-4 overflow-auto">
        <Input
          placeholder="Note title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="font-medium"
        />
        <Textarea
          placeholder="Write your note..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 min-h-[200px] resize-none"
        />
      </div>
    </div>
  );
};

export default NoteEditor;
