import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, LogOut, Settings, Calendar, CheckSquare, MessageSquare, Video } from 'lucide-react';
import NoteInput from '@/components/NoteInput';
import CalendarView from '@/components/CalendarView';
import TaskList from '@/components/TaskList';
import NotesGrid from '@/components/NotesGrid';
import ObsidianStyleNoteView from '@/components/ObsidianStyleNoteView';
import CategorySidebar from '@/components/CategorySidebar';
import GraphView from '@/components/GraphView';
import VoiceInterface from '@/components/VoiceInterface';
import MeetingMode from '@/components/MeetingMode';

const Dashboard = () => {
  const navigate = useNavigate();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string } | null>(null);
  const [showObsidianView, setShowObsidianView] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showMeetingMode, setShowMeetingMode] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const handleNoteCreated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleCategorySelect = (categoryId: string | null, categoryName?: string) => {
    if (categoryId && categoryName) {
      setSelectedCategory({ id: categoryId, name: categoryName });
      setShowObsidianView(true);
    } else {
      setSelectedCategory(null);
      setShowObsidianView(false);
    }
  };

  const handleCloseObsidianView = () => {
    setShowObsidianView(false);
    setSelectedCategory(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Brain className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Second Brain</h1>
              <p className="text-xs text-muted-foreground">AI-Organized Thoughts</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <Brain className="h-4 w-4" />
              Home
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings')}
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
      <div className="flex-1 container mx-auto px-6 py-8 flex flex-col">
        <div className="flex-1 flex flex-col">
          <Tabs defaultValue="map" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="map" className="flex items-center gap-2">
                <Brain className="w-4 h-4" />
                Brain Map
              </TabsTrigger>
              <TabsTrigger value="input" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Notes
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4" />
                Tasks
              </TabsTrigger>
              <TabsTrigger value="meeting" className="flex items-center gap-2">
                <Video className="w-4 h-4" />
                Meeting
              </TabsTrigger>
            </TabsList>

            <TabsContent value="map" className="flex-1 mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
                <aside className="lg:col-span-1">
                  <CategorySidebar
                    selectedCategory={selectedCategory?.id || null}
                    onCategorySelect={handleCategorySelect}
                    refreshTrigger={refreshTrigger}
                  />
                </aside>
                <main className="lg:col-span-3">
                  {showObsidianView && selectedCategory ? (
                    <ObsidianStyleNoteView
                      categoryId={selectedCategory.id}
                      categoryName={selectedCategory.name}
                      onClose={handleCloseObsidianView}
                      onNoteDeleted={handleNoteCreated}
                    />
                  ) : (
                    <GraphView />
                  )}
                </main>
              </div>
            </TabsContent>

            <TabsContent value="input" className="flex-1 mt-6">
              <div className="max-w-3xl mx-auto space-y-6">
                <NoteInput onNoteCreated={handleNoteCreated} />
                <NotesGrid
                  selectedCategory={selectedCategory?.id || null}
                  refreshTrigger={refreshTrigger}
                  onNoteDeleted={handleNoteCreated}
                />
              </div>
            </TabsContent>

            <TabsContent value="calendar" className="flex-1 mt-6">
              <CalendarView refreshTrigger={refreshTrigger} />
            </TabsContent>

            <TabsContent value="tasks" className="flex-1 mt-6">
              <TaskList refreshTrigger={refreshTrigger} />
            </TabsContent>

            <TabsContent value="meeting" className="flex-1 mt-6 h-full">
              {showMeetingMode ? (
                <MeetingMode onClose={() => setShowMeetingMode(false)} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Button onClick={() => setShowMeetingMode(true)} size="lg">
                    <Video className="w-5 h-5 mr-2" />
                    Start Meeting Mode
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {!showMeetingMode && <VoiceInterface onSpeakingChange={setIsSpeaking} />}
    </div>
  );
};

export default Dashboard;