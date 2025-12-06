import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Server, Brain, Database } from "lucide-react";

const Settings = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => (window.location.href = "/")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Chat
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Configure your Second Brain assistant
          </p>
        </div>

        <div className="grid gap-6">
          {/* Backend Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Backend Service
              </CardTitle>
              <CardDescription>
                Local Python backend running Gemma via Ollama
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">API Endpoint</span>
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    http://localhost:8000
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Model</span>
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    gemma3:4b via Ollama
                  </code>
                </div>
                <p className="text-xs text-muted-foreground">
                  Start the backend with: cd backend && python main.py
                </p>
              </div>
            </CardContent>
          </Card>

          {/* AI Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Configuration
              </CardTitle>
              <CardDescription>
                Customize how your AI assistant behaves
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                AI configuration will be available once the backend is connected.
              </p>
            </CardContent>
          </Card>

          {/* Data & Storage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data & Storage
              </CardTitle>
              <CardDescription>
                Your data is stored locally in SQLite
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Database</span>
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    backend/brain.db
                  </code>
                </div>
                <p className="text-xs text-muted-foreground">
                  All conversations and notes are stored locally on your machine.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
