import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FolderOpen, Cloud, RefreshCw, Check, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface DriveFolder {
  id: string;
  name: string;
  mimeType: string;
}

interface GoogleDriveSyncProps {
  projectId: string;
  driveFolderId: string | null;
  driveFolderName: string | null;
  driveLastSyncedAt: string | null;
  onFolderLinked: (folderId: string, folderName: string) => void;
  onSyncComplete: () => void;
}

export const GoogleDriveSync: React.FC<GoogleDriveSyncProps> = ({
  projectId,
  driveFolderId,
  driveFolderName,
  driveLastSyncedAt,
  onFolderLinked,
  onSyncComplete,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: "My Drive" },
  ]);

  const currentFolderId = currentPath[currentPath.length - 1].id;

  useEffect(() => {
    if (dialogOpen) {
      loadFolders();
    }
  }, [dialogOpen, currentFolderId]);

  const loadFolders = async () => {
    setLoading(true);
    setNeedsAuth(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const { data, error } = await supabase.functions.invoke("google-drive", {
        body: { action: "list-folders", parentId: currentFolderId },
      });

      if (error) {
        console.error("Error loading folders:", error);
        toast.error("Failed to load folders");
        return;
      }

      if (data.needsAuth) {
        setNeedsAuth(true);
        return;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setFolders(data.data || []);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to connect to Google Drive");
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = (folder: DriveFolder) => {
    setCurrentPath([...currentPath, { id: folder.id, name: folder.name }]);
  };

  const navigateBack = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1));
  };

  const selectFolder = async (folder: DriveFolder) => {
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          drive_folder_id: folder.id,
          drive_folder_name: folder.name,
        })
        .eq("id", projectId);

      if (error) {
        toast.error("Failed to link folder");
        return;
      }

      onFolderLinked(folder.id, folder.name);
      toast.success(`Linked to "${folder.name}"`);
      setDialogOpen(false);
    } catch (error) {
      toast.error("Failed to link folder");
    }
  };

  const unlinkFolder = async () => {
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          drive_folder_id: null,
          drive_folder_name: null,
          drive_last_synced_at: null,
        })
        .eq("id", projectId);

      if (error) {
        toast.error("Failed to unlink folder");
        return;
      }

      onFolderLinked("", "");
      toast.success("Folder unlinked");
    } catch (error) {
      toast.error("Failed to unlink folder");
    }
  };

  const syncNow = async () => {
    if (!driveFolderId) return;

    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      // Get files from Drive
      const { data: driveData, error: driveError } = await supabase.functions.invoke("google-drive", {
        body: { action: "list-files", folderId: driveFolderId },
      });

      if (driveError || driveData.error) {
        toast.error("Failed to fetch Drive files");
        return;
      }

      const driveFiles = driveData.data || [];

      // Get existing project documents
      const { data: existingDocs } = await supabase
        .from("project_documents")
        .select("id, name, drive_file_id, updated_at")
        .eq("project_id", projectId);

      const existingByDriveId = new Map(
        (existingDocs || [])
          .filter((d: any) => d.drive_file_id)
          .map((d: any) => [d.drive_file_id, d])
      );

      let imported = 0;
      let updated = 0;

      // Import/update files from Drive
      for (const file of driveFiles) {
        // Skip folders
        if (file.mimeType === "application/vnd.google-apps.folder") continue;

        // Only handle Google Docs (text documents) for now
        if (file.mimeType === "application/vnd.google-apps.document") {
          const existing = existingByDriveId.get(file.id);

          // Download content
          const { data: downloadData } = await supabase.functions.invoke("google-drive", {
            body: { action: "download", fileId: file.id, mimeType: file.mimeType },
          });

          if (!downloadData?.data?.content) continue;

          if (existing) {
            // Update existing document
            await supabase
              .from("project_documents")
              .update({
                content: downloadData.data.content,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existing.id);
            updated++;
          } else {
            // Create new document
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase.from("project_documents").insert({
                project_id: projectId,
                user_id: user.id,
                name: file.name.replace(/\.txt$/, ""),
                type: "document",
                content: downloadData.data.content,
                drive_file_id: file.id,
              });
              imported++;
            }
          }
        }
      }

      // Update last synced timestamp
      await supabase
        .from("projects")
        .update({ drive_last_synced_at: new Date().toISOString() })
        .eq("id", projectId);

      toast.success(`Sync complete: ${imported} imported, ${updated} updated`);
      onSyncComplete();
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const formatLastSynced = (date: string | null) => {
    if (!date) return "Never";
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="flex items-center gap-2">
      {driveFolderId ? (
        <>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-sm">
            <Cloud className="h-4 w-4 text-blue-500" />
            <span className="font-medium">{driveFolderName}</span>
            <span className="text-muted-foreground">• {formatLastSynced(driveLastSyncedAt)}</span>
          </div>
          <Button size="sm" variant="outline" onClick={syncNow} disabled={syncing} className="gap-2">
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync
          </Button>
          <Button size="sm" variant="ghost" onClick={unlinkFolder}>
            Unlink
          </Button>
        </>
      ) : (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-2">
              <Cloud className="h-4 w-4" />
              Link Google Drive
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Select Google Drive Folder</DialogTitle>
            </DialogHeader>

            {needsAuth ? (
              <div className="py-8 text-center">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  Google Drive is not connected. Please connect your Google account first.
                </p>
                <Button asChild>
                  <a href="/settings">Go to Settings</a>
                </Button>
              </div>
            ) : (
              <>
                {/* Breadcrumb */}
                <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
                  {currentPath.map((item, index) => (
                    <React.Fragment key={index}>
                      {index > 0 && <ChevronRight className="h-4 w-4" />}
                      <button
                        onClick={() => navigateBack(index)}
                        className={cn(
                          "hover:text-foreground transition-colors",
                          index === currentPath.length - 1 && "text-foreground font-medium"
                        )}
                      >
                        {item.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>

                {/* Folder list */}
                <ScrollArea className="h-64 border rounded-md">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : folders.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No folders found
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {folders.map((folder) => (
                        <div
                          key={folder.id}
                          className="flex items-center gap-2 p-2 rounded-md hover:bg-muted group"
                        >
                          <FolderOpen className="h-5 w-5 text-yellow-500" />
                          <span className="flex-1 truncate">{folder.name}</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigateToFolder(folder)}
                              className="h-7 px-2"
                            >
                              Open
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => selectFolder(folder)}
                              className="h-7 px-2 gap-1"
                            >
                              <Check className="h-3 w-3" />
                              Select
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
