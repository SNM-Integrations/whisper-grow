import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, Brain, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NoteInput from "@/components/NoteInput";
import CategorySidebar from "@/components/CategorySidebar";
import NotesGrid from "@/components/NotesGrid";
import GraphView from "@/components/GraphView";
import Calendar from "@/components/Calendar";
import TaskList from "@/components/TaskList";
import GoogleCalendarConnect from "@/components/GoogleCalendarConnect";

const Dashboard = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleNoteCreated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary">
      {/* Header */}
      <header className="border-b border-border bg-card backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Brain className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Second Brain
              </h1>
              <p className="text-xs text-muted-foreground">AI-Organized Thoughts</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/settings")}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <Tabs defaultValue="map" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="map">Brain Map</TabsTrigger>
            <TabsTrigger value="input">Save Thought</TabsTrigger>
            <TabsTrigger value="calendar">Calendar & Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="map" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Sidebar */}
              <aside className="lg:col-span-1">
                <CategorySidebar
                  selectedCategory={selectedCategory}
                  onCategorySelect={setSelectedCategory}
                  refreshTrigger={refreshTrigger}
                />
              </aside>

              {/* Main Area - Brain Map */}
              <main className="lg:col-span-3">
                <GraphView />
              </main>
            </div>
          </TabsContent>

          <TabsContent value="input" className="mt-0">
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Input Card */}
              <NoteInput onNoteCreated={handleNoteCreated} />

              {/* Notes Grid */}
              <NotesGrid
                selectedCategory={selectedCategory}
                refreshTrigger={refreshTrigger}
                onNoteDeleted={handleNoteCreated}
              />
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="mt-0">
            <div className="space-y-6">
              {/* Google Calendar Connection */}
              <GoogleCalendarConnect />

              {/* Split View: Calendar (60%) | Tasks (40%) */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3">
                  <Calendar />
                </div>
                <div className="lg:col-span-2">
                  <TaskList />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;