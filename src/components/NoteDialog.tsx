import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface NoteDialogProps {
  note: Note | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NoteDialog = ({ note, open, onOpenChange }: NoteDialogProps) => {
  if (!note) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] bg-card">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="flex-1">Note Details</DialogTitle>
            <Badge variant="secondary">
              {note.categories?.name || "Uncategorized"}
            </Badge>
          </div>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-base leading-relaxed whitespace-pre-wrap">
                {note.formatted_content || note.content}
              </p>
            </div>
            
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Created: {format(new Date(note.created_at), "MMMM d, yyyy 'at' h:mm a")}
              </p>
              {note.note_type === 'extracted' && (
                <Badge variant="outline" className="mt-2">
                  Extracted Topic
                </Badge>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default NoteDialog;
