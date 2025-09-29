import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Save, RotateCcw, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const AVAILABLE_MODELS = [
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Recommended)" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (Most Capable)" },
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (Fastest)" },
  { value: "openai/gpt-5", label: "GPT-5 (Premium)" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini" },
];

const DEFAULT_PROMPT = `You are a smart categorization assistant for a personal knowledge management system. Your job is to analyze notes and suggest the most appropriate category.

Rules:
1. If the note fits an existing category, return that category name
2. If no existing category fits well, suggest a new meaningful category name
3. Category names should be clear, concise, and descriptive (1-3 words)
4. Return ONLY the category name, nothing else`;

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

export default function Settings() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<AISettings>({
    model: "google/gemini-2.5-flash",
    temperature: 0.3,
    system_prompt: DEFAULT_PROMPT,
  });
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    loadSettings();
    loadCategories();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("ai_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setSettings({
          model: data.model,
          temperature: data.temperature,
          system_prompt: data.system_prompt,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("categories")
        .select(`
          id,
          name,
          notes:notes(count)
        `)
        .eq("user_id", user.id);

      if (error) throw error;

      const categoriesWithCount = data?.map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        note_count: cat.notes[0]?.count || 0,
      })) || [];

      setCategories(categoriesWithCount);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("ai_settings")
        .upsert({
          user_id: user.id,
          model: settings.model,
          temperature: settings.temperature,
          system_prompt: settings.system_prompt,
        });

      if (error) throw error;

      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings({
      model: "google/gemini-2.5-flash",
      temperature: 0.3,
      system_prompt: DEFAULT_PROMPT,
    });
    toast.info("Settings reset to defaults");
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm("Are you sure? This will remove the category from all notes.")) return;

    try {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", categoryId);

      if (error) throw error;

      toast.success("Category deleted");
      loadCategories();
    } catch (error) {
      console.error("Error deleting category:", error);
      toast.error("Failed to delete category");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Configure your AI assistant and manage categories</p>
          </div>
        </div>

        <Tabs defaultValue="ai" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ai">AI Configuration</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="info">How It Works</TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Model</CardTitle>
                <CardDescription>Choose the AI model for note categorization</CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={settings.model}
                  onValueChange={(value) => setSettings({ ...settings, model: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_MODELS.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Temperature: {settings.temperature}</CardTitle>
                <CardDescription>
                  Controls randomness. Lower values (0.0-0.3) are more focused and deterministic.
                  Higher values (0.7-1.0) are more creative.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Slider
                  value={[settings.temperature]}
                  onValueChange={([value]) => setSettings({ ...settings, temperature: value })}
                  min={0}
                  max={1}
                  step={0.1}
                  className="w-full"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Prompt</CardTitle>
                <CardDescription>
                  Customize how the AI categorizes your notes. The AI will see your existing categories.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={settings.system_prompt}
                  onChange={(e) => setSettings({ ...settings, system_prompt: e.target.value })}
                  rows={10}
                  className="font-mono text-sm"
                />
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? "Saving..." : "Save Settings"}
                  </Button>
                  <Button onClick={handleReset} variant="outline">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset to Default
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Categories</CardTitle>
                <CardDescription>Manage your existing categories</CardDescription>
              </CardHeader>
              <CardContent>
                {categories.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No categories yet. Create notes to generate categories automatically.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{category.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {category.note_count} {category.note_count === 1 ? "note" : "notes"}
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteCategory(category.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="info" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>How AI Categorization Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Step 1:</strong> When you create a note (text or voice), the content is sent to the AI.
                  </AlertDescription>
                </Alert>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Step 2:</strong> The AI analyzes your note along with your existing categories.
                  </AlertDescription>
                </Alert>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Step 3:</strong> It either assigns the note to an existing category or creates a new one.
                  </AlertDescription>
                </Alert>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Step 4:</strong> Your note is automatically organized in your second brain!
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>What Data Does the AI See?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">The AI receives:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Your note content</li>
                  <li>List of your existing category names</li>
                  <li>Your custom system prompt (if set)</li>
                </ul>
                <p className="text-sm mt-4">The AI does NOT see:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Content of other notes</li>
                  <li>Any personal information beyond the note</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
