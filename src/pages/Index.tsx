import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Mic, Settings, Plus, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  updatedAt: Date;
}

const API_BASE = "http://localhost:8000";

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [backendStatus, setBackendStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check backend health on mount
  useEffect(() => {
    checkBackendHealth();
    fetchConversations();
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const checkBackendHealth = async () => {
    try {
      const response = await fetch(`${API_BASE}/health`);
      if (response.ok) {
        setBackendStatus("connected");
      } else {
        setBackendStatus("disconnected");
      }
    } catch {
      setBackendStatus("disconnected");
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await fetch(`${API_BASE}/conversations`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch {
      // Backend not available yet
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          conversation_id: conversationId,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setConversationId(data.conversation_id);
      fetchConversations();
    } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I couldn't connect to the brain service. Make sure the backend is running at localhost:8000.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(null);
  };

  const loadConversation = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/conversations/${id}`);
      if (response.ok) {
        const data = await response.json();
        setConversationId(id);
        setMessages(
          data.messages.map((m: any) => ({
            id: crypto.randomUUID(),
            role: m.role,
            content: m.content,
            timestamp: new Date(m.timestamp),
          }))
        );
      }
    } catch {
      // Handle error
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={cn(
          "border-r border-border bg-card/50 flex flex-col transition-all duration-300",
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
        )}
      >
        <div className="p-4 border-b border-border">
          <Button
            onClick={startNewConversation}
            className="w-full justify-start gap-2"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg hover:bg-accent transition-colors",
                  conversationId === conv.id && "bg-accent"
                )}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate text-sm">{conv.title}</span>
                </div>
              </button>
            ))}
            {conversations.length === 0 && (
              <p className="text-sm text-muted-foreground p-3">
                No conversations yet
              </p>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => (window.location.href = "/settings")}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center px-4 gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold">Second Brain</h1>
          <div className="ml-auto flex items-center gap-2">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                backendStatus === "connected" && "bg-green-500",
                backendStatus === "disconnected" && "bg-red-500",
                backendStatus === "checking" && "bg-yellow-500 animate-pulse"
              )}
            />
            <span className="text-xs text-muted-foreground">
              {backendStatus === "connected" && "Connected"}
              {backendStatus === "disconnected" && "Backend offline"}
              {backendStatus === "checking" && "Checking..."}
            </span>
          </div>
        </header>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.length === 0 && (
              <div className="text-center py-20">
                <h2 className="text-2xl font-bold mb-2">Welcome to your Second Brain</h2>
                <p className="text-muted-foreground">
                  Start a conversation with your AI assistant.
                </p>
                {backendStatus === "disconnected" && (
                  <p className="text-sm text-destructive mt-4">
                    Backend not running. Start it with: cd backend && python main.py
                  </p>
                )}
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce delay-100" />
                    <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t border-border p-4">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message your second brain..."
              className="min-h-[52px] max-h-[200px] resize-none"
              rows={1}
            />
            <div className="flex flex-col gap-2">
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" disabled>
                <Mic className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
