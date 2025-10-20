import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, RotateCcw, Trash2, Info, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
// Removed useNavigate - using window.location for back nav
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface AISettings {
  model: string;
  temperature: number;
  system_prompt: string;
}

interface Category {
  id: string;
  name: string;
  note_count?: number;
}

interface AIKnowledgeStats {
  totalNotes: number;
  embeddingsCount: number;
  topCategories: { name: string; count: number }[];
}

interface GoogleConnectionStatus {
  connected: boolean;
  email?: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
  isExpired?: boolean;
  needsRefresh?: boolean;
  message?: string;
}

const DEFAULT_SETTINGS: AISettings = {
  model: 'google/gemini-2.5-flash',
  temperature: 0.3,
  system_prompt: `You are an intelligent categorization assistant for a personal knowledge management system. Your role is to analyze notes and suggest the most semantically appropriate category based on the user's existing knowledge structure and patterns.

CONTEXT UNDERSTANDING:
- You will receive the user's existing categories
- You will see similar notes the user has written before (with their categories)
- Use this context to understand the user's categorization preferences and knowledge structure
- The similar notes show what the user considers related content

HIERARCHICAL CATEGORIZATION:
- You can suggest hierarchical categories using " > " separator
- Format: "Parent Category > Child Category"
- Examples: "Personal Development > Morning Routines", "Work > Project Ideas", "Health > Fitness Goals"
- Use hierarchy when the note fits a specific subcategory of a broader topic
- Keep hierarchy to max 2 levels (Parent > Child)

CATEGORIZATION PRINCIPLES:

1. CONSISTENCY FIRST
   - Strongly prefer existing categories when the note's core concept aligns with them
   - Look at how similar past notes were categorized as a guide
   - Maintain the user's established taxonomy and naming conventions
   - Don't create variations of existing categories (e.g., avoid "JavaScript Tips" if "JavaScript" exists)

2. SEMANTIC MATCHING
   - Focus on the note's primary topic or intent, not just keywords
   - Consider the broader domain or field the note belongs to
   - Match based on conceptual similarity, not surface-level text matching
   - A note about "React hooks" belongs in "React" or "Frontend > React", not "Hooks"

3. WHEN TO CREATE NEW CATEGORIES
   Only create a new category when:
   - The note covers a genuinely distinct topic not represented by existing categories
   - The concept is substantial enough to warrant its own category (not a one-off topic)
   - The new category would be useful for organizing future related notes
   - Similar past notes show this is a recurring theme without a category

4. CATEGORY NAMING BEST PRACTICES
   - Use 1-3 words maximum per level
   - Choose broad, reusable names over hyper-specific ones
   - Prefer established domain terminology (e.g., "Machine Learning" over "AI Stuff")
   - Use singular form unless the category is inherently plural (e.g., "Recipe" not "Recipes")
   - Be descriptive but concise (e.g., "Home Improvement" not "House Projects And Fixes")
   - Capitalize properly (title case)

5. DECISION-MAKING HIERARCHY
   a) If similar notes exist with categories → strongly consider those categories
   b) If multiple existing categories fit → choose the most specific relevant one
   c) If topic fits as subcategory of existing category → use "Parent > Child" format
   d) If no existing category fits well → evaluate if this is a recurring topic
   e) If truly novel and likely recurring → create a clear, reusable category name

CRITICAL OUTPUT REQUIREMENT:
- Return ONLY the category name (or hierarchical path)
- No explanations, no punctuation, no additional text
- Just the category name exactly as it should appear
- Use " > " to separate parent and child categories

Examples of good categorization thinking:
- Note about "setting up Docker containers" → "DevOps" (if exists) or "DevOps > Docker" (if DevOps exists)
- Note about "morning routine ideas" → "Personal Development > Morning Routines" (if Personal Development exists)
- Note about "fixing kitchen sink" → "Home Improvement > Kitchen" (if Home Improvement exists)
- Note about a specific book insight → "Books" or "Reading" rather than the book's title`
};

const Settings = () => {
  // Removed navigate - using window.location for back nav
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [knowledgeStats, setKnowledgeStats] = useState<AIKnowledgeStats>({
    totalNotes: 0,
    embeddingsCount: 0,
    topCategories: []
  });
  const [googleConnection, setGoogleConnection] = useState<GoogleConnectionStatus>({ connected: false });
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchCategories();
    fetchKnowledgeStats();
    checkGoogleConnection();
    handleOAuthCallback();
  }, []);

  const checkGoogleConnection = async () => {
    setIsCheckingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-google-connection');
      
      if (error) throw error;
      
      setGoogleConnection(data || { connected: false });
    } catch (error) {
      console.error('Error checking Google connection:', error);
      setGoogleConnection({ connected: false, message: 'Failed to check connection status' });
    } finally {
      setIsCheckingConnection(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('google_auth_tokens')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Disconnected from Google Calendar');
      setGoogleConnection({ connected: false });
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect from Google Calendar');
    }
  };

  const handleOAuthCallback = async () => {
    // Check if we're returning from Google OAuth
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const scope = params.get('scope');
    
    // Google OAuth callback includes both 'code' and 'scope' parameters
    if (code && scope?.includes('calendar')) {
      try {
        setIsConnecting(true);
        toast.info('Connecting to Google Calendar...');
        
        // Get the current origin
        const origin = window.location.origin;
        
        // Send the code to our backend to exchange for tokens
        const { data, error } = await supabase.functions.invoke('google-auth-callback', {
          body: { code, origin }
        });
        
        if (error) throw error;
        if (!data?.success) throw new Error('Failed to complete OAuth callback');
        
        toast.success('Successfully connected to Google Calendar!');
        
        // Refresh connection status
        await checkGoogleConnection();
        
        // Clean up URL
        window.history.replaceState({}, '', '/settings');
      } catch (error) {
        console.error('OAuth callback error:', error);
        const errorMsg = error instanceof Error ? error.message : 'Failed to connect Google Calendar';
        toast.error(errorMsg);
        window.history.replaceState({}, '', '/settings');
      } finally {
        setIsConnecting(false);
      }
    }
  };

  const fetchSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings({
          model: data.model,
          temperature: data.temperature,
          system_prompt: data.system_prompt
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('categories')
        .select(`
          id,
          name,
          notes:notes(count)
        `)
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;

      const categoriesWithCount = data?.map(cat => ({
        id: cat.id,
        name: cat.name,
        note_count: cat.notes?.[0]?.count || 0
      })) || [];

      setCategories(categoriesWithCount);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchKnowledgeStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get total notes count
      const { count: notesCount } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Get embeddings count by directly querying note_embeddings joined with notes
      const { data: embeddings } = await supabase
        .from('note_embeddings')
        .select('note_id, notes!inner(user_id)')
        .eq('notes.user_id', user.id);
      
      const embeddingsCount = embeddings?.length || 0;

      // Get top categories
      const { data: topCats } = await supabase
        .from('categories')
        .select(`
          name,
          notes:notes(count)
        `)
        .eq('user_id', user.id)
        .order('notes(count)', { ascending: false })
        .limit(5);

      const topCategories = topCats?.map(cat => ({
        name: cat.name,
        count: cat.notes?.[0]?.count || 0
      })).filter(cat => cat.count > 0) || [];

      setKnowledgeStats({
        totalNotes: notesCount || 0,
        embeddingsCount: embeddingsCount || 0,
        topCategories
      });
    } catch (error) {
      console.error('Error fetching knowledge stats:', error);
    }
  };

  const handleBackfillEmbeddings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      toast.info('Starting to backfill embeddings...');

      // Get all note IDs with embeddings
      const { data: existingEmbeddings } = await supabase
        .from('note_embeddings')
        .select('note_id');
      
      const embeddedNoteIds = new Set(existingEmbeddings?.map(e => e.note_id) || []);
      
      // Get all notes
      const { data: allNotes } = await supabase
        .from('notes')
        .select('id, content')
        .eq('user_id', user.id);
      
      // Filter notes without embeddings
      const notesWithoutEmbeddings = allNotes?.filter(note => !embeddedNoteIds.has(note.id)) || [];

      if (!notesWithoutEmbeddings || notesWithoutEmbeddings.length === 0) {
        toast.success('All notes already have embeddings!');
        return;
      }

      // Generate embeddings for each note
      let processed = 0;
      let success = 0;
      let failed = 0;
      for (const note of notesWithoutEmbeddings) {
        const { data, error } = await supabase.functions.invoke('generate-embeddings', {
          body: { noteId: note.id, content: note.content }
        });
        processed++;

        if (error || !data?.success) {
          failed++;
          console.error('Embedding generation failed for note', note.id, error || data);
        } else {
          success++;
        }
        
        if (processed % 5 === 0) {
          toast.info(`Processed ${processed}/${notesWithoutEmbeddings.length} notes (${success} ok, ${failed} failed)`);
        }
      }

      if (failed > 0) {
        toast.error(`Embeddings completed: ${success} succeeded, ${failed} failed`);
      } else {
        toast.success(`Successfully generated embeddings for ${success} notes!`);
      }
      fetchKnowledgeStats();
    } catch (error) {
      console.error('Error backfilling embeddings:', error);
      toast.error('Failed to backfill embeddings');
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('ai_settings')
        .upsert({
          user_id: user.id,
          model: settings.model,
          temperature: settings.temperature,
          system_prompt: settings.system_prompt
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    toast.info('Settings reset to defaults');
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;

      toast.success(`Category "${categoryName}" deleted`);
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary flex items-center justify-center">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => (window.location.href = "/")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">Configure your AI assistant and manage categories</p>
        </div>

        <Tabs defaultValue="ai" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="ai">AI Configuration</TabsTrigger>
            <TabsTrigger value="knowledge">AI Knowledge</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="google">Google Calendar</TabsTrigger>
            <TabsTrigger value="info">How It Works</TabsTrigger>
          </TabsList>

          {/* AI Configuration Tab */}
          <TabsContent value="ai" className="space-y-6">
            <Card className="p-6 shadow-soft border-border/50 bg-card/80 backdrop-blur">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="model">AI Model</Label>
                  <Select
                    value={settings.model}
                    onValueChange={(value) => setSettings({ ...settings, model: value })}
                  >
                    <SelectTrigger id="model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</SelectItem>
                      <SelectItem value="google/gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Faster)</SelectItem>
                      <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro (Most Capable)</SelectItem>
                      <SelectItem value="openai/gpt-5-nano">GPT-5 Nano (Fast)</SelectItem>
                      <SelectItem value="openai/gpt-5-mini">GPT-5 Mini (Balanced)</SelectItem>
                      <SelectItem value="openai/gpt-5">GPT-5 (Most Accurate)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Choose the AI model for categorizing your notes</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature: {settings.temperature}</Label>
                  <Slider
                    id="temperature"
                    min={0}
                    max={1}
                    step={0.1}
                    value={[settings.temperature]}
                    onValueChange={(value) => setSettings({ ...settings, temperature: value[0] })}
                    className="py-4"
                  />
                  <p className="text-xs text-muted-foreground">
                    Lower values (0.0-0.3) are more focused and deterministic. Higher values (0.7-1.0) are more creative.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prompt">System Prompt</Label>
                  <Textarea
                    id="prompt"
                    value={settings.system_prompt}
                    onChange={(e) => setSettings({ ...settings, system_prompt: e.target.value })}
                    className="min-h-[200px] font-mono text-sm"
                    placeholder="Enter your custom system prompt..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Customize how the AI should categorize your notes
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                    className="flex-1"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save Settings'}
                  </Button>
                  <Button
                    onClick={handleResetSettings}
                    variant="outline"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset to Default
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* AI Knowledge Tab */}
          <TabsContent value="knowledge" className="space-y-6">
            <Card className="p-6 shadow-soft border-border/50 bg-card/80 backdrop-blur">
              <h3 className="text-lg font-semibold mb-6">AI Learning Progress</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="p-4 bg-primary/5 border-primary/20">
                  <div className="text-sm text-muted-foreground mb-1">Total Notes</div>
                  <div className="text-3xl font-bold text-primary">{knowledgeStats.totalNotes}</div>
                </Card>
                
                <Card className="p-4 bg-secondary/5 border-secondary/20">
                  <div className="text-sm text-muted-foreground mb-1">Notes with AI Learning</div>
                  <div className="text-3xl font-bold text-secondary">{knowledgeStats.embeddingsCount}</div>
                </Card>
                
                <Card className="p-4 bg-accent/5 border-accent/20">
                  <div className="text-sm text-muted-foreground mb-1">Learning Coverage</div>
                  <div className="text-3xl font-bold text-accent">
                    {knowledgeStats.totalNotes > 0 
                      ? Math.round((knowledgeStats.embeddingsCount / knowledgeStats.totalNotes) * 100)
                      : 0}%
                  </div>
                </Card>
              </div>

              {knowledgeStats.embeddingsCount < knowledgeStats.totalNotes && (
                <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-border/50">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">Improve AI Intelligence</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Some of your notes haven't been analyzed yet. Click below to enable AI learning for all your notes.
                      </p>
                      <Button onClick={handleBackfillEmbeddings} variant="outline" size="sm">
                        Analyze All Notes
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {knowledgeStats.topCategories.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Your Top Interests</h4>
                  <div className="space-y-2">
                    {knowledgeStats.topCategories.map((cat, index) => (
                      <div key={cat.name} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{cat.name}</div>
                          <div className="text-sm text-muted-foreground">{cat.count} notes</div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {knowledgeStats.totalNotes > 0 
                            ? Math.round((cat.count / knowledgeStats.totalNotes) * 100)
                            : 0}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {knowledgeStats.totalNotes === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Start adding notes to see AI learning progress!</p>
                </div>
              )}
            </Card>

            <Card className="p-6 shadow-soft border-border/50 bg-card/80 backdrop-blur">
              <h3 className="text-lg font-semibold mb-3">How AI Learning Works</h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Smart Categorization:</strong> When you create a note, the AI analyzes similar notes you've written before to suggest the most relevant category.
                </p>
                <p>
                  <strong className="text-foreground">Context Awareness:</strong> The more notes you add, the better the AI understands your interests and communication style.
                </p>
                <p>
                  <strong className="text-foreground">Privacy First:</strong> All your data stays in your secure database. The AI never stores or shares your notes.
                </p>
              </div>
            </Card>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-4">
            <Card className="p-6 shadow-soft border-border/50 bg-card/80 backdrop-blur">
              <h3 className="text-lg font-semibold mb-4">Your Categories</h3>
              {categories.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No categories yet. Create your first note to get started!
                </p>
              ) : (
                <div className="space-y-2">
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{category.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {category.note_count} {category.note_count === 1 ? 'note' : 'notes'}
                        </span>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Category</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{category.name}"? This will not delete the notes in this category.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteCategory(category.id, category.name)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Google Calendar Tab */}
          <TabsContent value="google" className="space-y-6">
            {/* Connection Status */}
            <Card className="p-6 shadow-soft border-border/50 bg-card/80 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Connection Status</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={checkGoogleConnection}
                  disabled={isCheckingConnection}
                >
                  <RefreshCw className={`h-4 w-4 ${isCheckingConnection ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {isCheckingConnection ? (
                <div className="text-center py-4 text-muted-foreground">
                  Checking connection...
                </div>
              ) : googleConnection.connected ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-green-700 dark:text-green-400">Connected to Google Calendar</p>
                      {googleConnection.email && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Account: {googleConnection.email}
                        </p>
                      )}
                      {googleConnection.createdAt && (
                        <p className="text-sm text-muted-foreground">
                          Connected: {new Date(googleConnection.createdAt).toLocaleDateString()}
                        </p>
                      )}
                      {googleConnection.isExpired && (
                        <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                          ⚠️ Token expired - please reconnect
                        </p>
                      )}
                      {googleConnection.needsRefresh && !googleConnection.isExpired && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Token will be refreshed on next sync
                        </p>
                      )}
                    </div>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full">
                        Disconnect Google Calendar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect Google Calendar</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to disconnect your Google Calendar? This will remove your access tokens. You can reconnect anytime.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDisconnectGoogle}>
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border/50">
                    <XCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Not Connected</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Connect your Google Calendar to sync events automatically
                      </p>
                    </div>
                  </div>

                  <Button 
                    onClick={async () => {
                      try {
                        setIsConnecting(true);
                        // Get the current origin
                        const origin = window.location.origin;
                        
                        // Get Google OAuth URL from backend
                        const { data, error } = await supabase.functions.invoke('get-google-oauth-url', {
                          body: { origin }
                        });
                        
                        if (error) throw error;
                        if (!data?.authUrl) throw new Error('Failed to get OAuth URL');
                        
                        // Redirect to Google OAuth
                        window.location.href = data.authUrl;
                      } catch (error) {
                        console.error('OAuth error:', error);
                        const errorMsg = error instanceof Error ? error.message : 'Failed to initiate Google connection';
                        toast.error(errorMsg);
                        setIsConnecting(false);
                      }
                    }}
                    className="w-full"
                    disabled={isConnecting}
                  >
                    {isConnecting ? 'Connecting...' : 'Connect Google Calendar'}
                  </Button>
                </div>
              )}
            </Card>

            {/* Sync Options */}
            {googleConnection.connected && (
              <Card className="p-6 shadow-soft border-border/50 bg-card/80 backdrop-blur">
                <h3 className="text-lg font-semibold mb-4">Sync Options</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Manually sync your events with Google Calendar:
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={async () => {
                      try {
                        setIsSyncing(true);
                        toast.info('Pulling events from Google Calendar...');
                        const { error } = await supabase.functions.invoke('sync-from-google-calendar');
                        if (error) throw error;
                        toast.success('Events synced from Google Calendar');
                      } catch (error) {
                        console.error('Sync error:', error);
                        const errorMsg = error instanceof Error ? error.message : 'Failed to sync from Google Calendar';
                        toast.error(errorMsg);
                      } finally {
                        setIsSyncing(false);
                      }
                    }}
                    variant="outline"
                    className="flex-1"
                    disabled={isSyncing || googleConnection.isExpired}
                  >
                    {isSyncing ? 'Syncing...' : 'Pull from Google'}
                  </Button>
                </div>
                {googleConnection.isExpired && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                    Please reconnect to sync events
                  </p>
                )}
              </Card>
            )}

            {/* Information Card */}
            <Card className="p-6 shadow-soft border-border/50 bg-card/80 backdrop-blur">
              <h3 className="text-lg font-semibold mb-4">How It Works</h3>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li>Connect your Google account to enable calendar sync</li>
                <li>Use "Pull from Google" to import events from Google Calendar</li>
                <li>Events are stored in your local calendar</li>
                <li>Your connection is secure and can be disconnected anytime</li>
              </ul>
            </Card>
          </TabsContent>

          {/* How It Works Tab */}
          <TabsContent value="info" className="space-y-4">
            <Card className="p-6 shadow-soft border-border/50 bg-card/80 backdrop-blur">
              <div className="flex items-start gap-3 mb-4">
                <Info className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">How AI Categorization Works</h3>
                  <p className="text-muted-foreground mb-4">
                    Your Second Brain uses AI to automatically organize your notes into meaningful categories.
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold mb-2">The Process:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                    <li>You create a note (text or voice)</li>
                    <li>The AI analyzes your note content</li>
                    <li>It looks at your existing categories</li>
                    <li>It either assigns an existing category or creates a new one</li>
                    <li>Your note is automatically organized</li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">What the AI Sees:</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Your note content</li>
                    <li>All your existing category names</li>
                    <li>The system prompt and rules you've configured</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Customization:</h4>
                  <p className="text-muted-foreground">
                    You can customize the AI's behavior by adjusting the model, temperature, and system prompt in the AI Configuration tab.
                    This allows you to fine-tune how categories are created and assigned.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;