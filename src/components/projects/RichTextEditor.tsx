import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => Promise<void>;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ content, onChange }) => {
  const [value, setValue] = useState(content);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setValue(content);
    setHasChanges(false);
  }, [content]);

  const handleChange = (newValue: string) => {
    setValue(newValue);
    setHasChanges(newValue !== content);
  };

  const handleSave = useCallback(async () => {
    if (!hasChanges) return;
    
    setSaving(true);
    try {
      await onChange(value);
      setHasChanges(false);
      toast.success("Document saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [value, hasChanges, onChange]);

  // Auto-save on Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  // Simple markdown helpers
  const insertMarkdown = (prefix: string, suffix: string = "") => {
    const textarea = document.getElementById("rich-editor") as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end);
    
    handleChange(newText);
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/50">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => insertMarkdown("**", "**")}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => insertMarkdown("*", "*")}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => insertMarkdown("# ")}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => insertMarkdown("## ")}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => insertMarkdown("- ")}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => insertMarkdown("1. ")}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        
        <div className="flex-1" />
        
        <span className={cn(
          "text-xs px-2",
          hasChanges ? "text-amber-500" : "text-muted-foreground"
        )}>
          {hasChanges ? "Unsaved changes" : "Saved"}
        </span>
        
        <Button 
          size="sm" 
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Editor */}
      <Textarea
        id="rich-editor"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="flex-1 resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
        placeholder="Start writing... (Supports Markdown)"
      />
    </div>
  );
};
