import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FolderSync, Folder, ChevronRight, Loader2, Unlink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GoogleDriveNotesSyncProps {
  onSyncComplete?: () => void;
}

interface DriveFolder {
  id: string;
  name: string;
}

// Store folder link in localStorage for now (could move to user settings table later)
const DRIVE_FOLDER_KEY = "notes_drive_folder";

const GoogleDriveNotesSync: React.FC<GoogleDriveNotesSyncProps> = ({ onSyncComplete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<DriveFolder[]>([]);
  const [linkedFolder, setLinkedFolder] = useState<DriveFolder | null>(null);
  const [hasGoogleAuth, setHasGoogleAuth] = useState(false);

  useEffect(() => {
    checkGoogleAuth();
    loadLinkedFolder();
    
    // Check for OAuth success callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("google_auth") === "success") {
      toast.success("Google Drive connected successfully!");
      setHasGoogleAuth(true);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const loadLinkedFolder = () => {
    const stored = localStorage.getItem(DRIVE_FOLDER_KEY);
    if (stored) {
      setLinkedFolder(JSON.parse(stored));
    }
  };

  const checkGoogleAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("google_auth_tokens")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    setHasGoogleAuth(!!data);
  };

  const connectGoogle = async () => {
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-oauth", {
        method: "POST",
        body: {},
      });

      if (error) throw error;

      if (data?.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.authUrl;
      }
    } catch (error: any) {
      console.error("Failed to start OAuth:", error);
      toast.error("Failed to connect Google: " + error.message);
      setIsConnecting(false);
    }
  };

  const loadFolders = async (folderId: string | null = null) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive", {
        body: { action: "list-folders", parentId: folderId },
      });

      if (error) throw error;
      
      if (data?.needsAuth) {
        setHasGoogleAuth(false);
        toast.error("Please connect Google Drive first");
        return;
      }
      
      setFolders(data?.data || []);
      setCurrentFolderId(folderId);
    } catch (error: any) {
      toast.error("Failed to load folders: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToFolder = (folder: DriveFolder) => {
    setFolderPath([...folderPath, folder]);
    loadFolders(folder.id);
  };

  const navigateBack = () => {
    const newPath = [...folderPath];
    newPath.pop();
    setFolderPath(newPath);
    loadFolders(newPath.length > 0 ? newPath[newPath.length - 1].id : null);
  };

  const linkFolder = (folder: DriveFolder) => {
    setLinkedFolder(folder);
    localStorage.setItem(DRIVE_FOLDER_KEY, JSON.stringify(folder));
    setIsOpen(false);
    toast.success(`Linked to folder: ${folder.name}`);
  };

  const unlinkFolder = () => {
    setLinkedFolder(null);
    localStorage.removeItem(DRIVE_FOLDER_KEY);
    toast.success("Folder unlinked");
  };

  const syncNotes = async () => {
    if (!linkedFolder) {
      toast.error("No folder linked");
      return;
    }

    setIsSyncing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get files from Drive folder
      const { data: filesData, error: filesError } = await supabase.functions.invoke("google-drive", {
        body: { action: "list-files", folderId: linkedFolder.id },
      });

      if (filesError) throw filesError;
      
      if (filesData?.needsAuth) {
        setHasGoogleAuth(false);
        toast.error("Please reconnect Google Drive");
        return;
      }

      const files = filesData?.data || [];
      let synced = 0;

      for (const file of files) {
        // Only sync Google Docs and text files
        if (!file.mimeType.includes("document") && !file.mimeType.includes("text")) {
          continue;
        }

        // Download file content
        const { data: downloadData, error: downloadError } = await supabase.functions.invoke("google-drive", {
          body: { action: "download", fileId: file.id, mimeType: file.mimeType },
        });

        if (downloadError) {
          console.error(`Failed to download ${file.name}:`, downloadError);
          continue;
        }

        const content = `# ${file.name}\n\n${downloadData?.data?.content || ""}`;

        // Check if note already exists (by searching for title in first line)
        const { data: existingNotes } = await supabase
          .from("notes")
          .select("id, content")
          .eq("user_id", user.id)
          .ilike("content", `# ${file.name}%`);

        if (existingNotes && existingNotes.length > 0) {
          // Update existing note
          await supabase
            .from("notes")
            .update({ content, updated_at: new Date().toISOString() })
            .eq("id", existingNotes[0].id);
        } else {
          // Create new note
          await supabase.from("notes").insert({
            user_id: user.id,
            content,
            visibility: "personal",
          });
        }

        synced++;
      }

      toast.success(`Synced ${synced} notes from Google Drive`);
      onSyncComplete?.();
    } catch (error: any) {
      toast.error("Sync failed: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!hasGoogleAuth) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={connectGoogle}
        disabled={isConnecting}
      >
        {isConnecting ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <FolderSync className="h-4 w-4 mr-1" />
        )}
        Connect Google
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {linkedFolder ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={syncNotes}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <FolderSync className="h-4 w-4 mr-1" />
            )}
            Sync
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => loadFolders()}
              >
                {linkedFolder.name}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change Drive Folder</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Current:</span>
                  <span className="font-medium text-foreground">{linkedFolder.name}</span>
                  <Button variant="ghost" size="sm" onClick={unlinkFolder}>
                    <Unlink className="h-3 w-3" />
                  </Button>
                </div>
                
                {folderPath.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={navigateBack}>
                    ← Back
                  </Button>
                )}

                <ScrollArea className="h-64 border rounded-md">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : folders.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      No folders found
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {folders.map((folder) => (
                        <div
                          key={folder.id}
                          className="flex items-center justify-between p-2 rounded hover:bg-accent"
                        >
                          <button
                            className="flex items-center gap-2 flex-1"
                            onClick={() => navigateToFolder(folder)}
                          >
                            <Folder className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{folder.name}</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                          </button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => linkFolder(folder)}
                          >
                            Select
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadFolders()}
            >
              <FolderSync className="h-4 w-4 mr-1" />
              Link Drive
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select Drive Folder for Notes</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {folderPath.length > 0 && (
                <Button variant="ghost" size="sm" onClick={navigateBack}>
                  ← Back
                </Button>
              )}

              <ScrollArea className="h-64 border rounded-md">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : folders.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No folders found
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {folders.map((folder) => (
                      <div
                        key={folder.id}
                        className="flex items-center justify-between p-2 rounded hover:bg-accent"
                      >
                        <button
                          className="flex items-center gap-2 flex-1"
                          onClick={() => navigateToFolder(folder)}
                        >
                          <Folder className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{folder.name}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                        </button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => linkFolder(folder)}
                        >
                          Select
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default GoogleDriveNotesSync;
