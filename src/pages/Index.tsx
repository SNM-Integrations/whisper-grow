import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Send, 
  Mic, 
  Settings, 
  Plus, 
  MessageSquare, 
  FileText, 
  Search, 
  Copy, 
  Check,
  Calendar,
  Users,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  sendMessage, 
  fetchConversations, 
  fetchConversation, 
  checkHealth,
  type Conversation 
} from "@/lib/api";
import NotesPanel from "@/components/notes/NotesPanel";
import SearchPanel from "@/components/search/SearchPanel";
import { CalendarView } from "@/components/calendar/CalendarView";
import { ContactsList } from "@/components/crm/ContactsList";
import { DealsPipeline } from "@/components/crm/DealsPipeline";
import { CompaniesList } from "@/components/crm/CompaniesList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

type MainTab = "chat" | "calendar" | "crm" | "tasks" | "notes" | "search";

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeTab, setActiveTab] = useState<MainTab>("chat");
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [crmSubTab, setCrmSubTab] = useState<"contacts" | "deals" | "companies">("contacts");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    checkBackendHealth();
    loadConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const checkBackendHealth = async () => {
    const health = await checkHealth();
    setBackendStatus(health ? "connected" : "disconnected");
  };

  const loadConversations = async () => {
    const data = await fetchConversations();
    setConversations(data);
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
      const data = await sendMessage(userMessage.content, conversationId);
      
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setConversationId(data.conversation_id);
      loadConversations();
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
      const data = await fetchConversation(id);
      setConversationId(id);
      setMessages(
        data.messages.map((m: any) => ({
          id: crypto.randomUUID(),
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp),
        }))
      );
    } catch {
      // Handle error
    }
  };

  const copyToClipboard = async (text: string, messageId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSearchSelectConversation = (id: string) => {
    loadConversation(id);
    setActiveTab("chat");
  };

  const handleTabChange = (tab: MainTab) => {
    if (tab === "chat") {
      setChatPanelOpen(false);
    }
    setActiveTab(tab);
  };

  // When on a non-chat tab, show chat as side panel
  const showChatAsSidePanel = activeTab !== "chat" && chatPanelOpen;

  return (
    <div className="flex h-screen bg-background">
      {/* Left Navigation Bar */}
      <div className="w-16 border-r border-border bg-card/50 flex flex-col items-center py-4 gap-2">
        <Button
          variant={activeTab === "chat" ? "secondary" : "ghost"}
          size="icon"
          onClick={() => handleTabChange("chat")}
          className="h-12 w-12"
          title="Chat"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
        <Button
          variant={activeTab === "calendar" ? "secondary" : "ghost"}
          size="icon"
          onClick={() => handleTabChange("calendar")}
          className="h-12 w-12"
          title="Calendar"
        >
          <Calendar className="h-5 w-5" />
        </Button>
        <Button
          variant={activeTab === "crm" ? "secondary" : "ghost"}
          size="icon"
          onClick={() => handleTabChange("crm")}
          className="h-12 w-12"
          title="CRM"
        >
          <Users className="h-5 w-5" />
        </Button>
        <Button
          variant={activeTab === "tasks" ? "secondary" : "ghost"}
          size="icon"
          onClick={() => handleTabChange("tasks")}
          className="h-12 w-12"
          title="Tasks"
        >
          <CheckSquare className="h-5 w-5" />
        </Button>
        <Button
          variant={activeTab === "notes" ? "secondary" : "ghost"}
          size="icon"
          onClick={() => handleTabChange("notes")}
          className="h-12 w-12"
          title="Notes"
        >
          <FileText className="h-5 w-5" />
        </Button>
        <Button
          variant={activeTab === "search" ? "secondary" : "ghost"}
          size="icon"
          onClick={() => handleTabChange("search")}
          className="h-12 w-12"
          title="Search"
        >
          <Search className="h-5 w-5" />
        </Button>
        
        <div className="flex-1" />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => (window.location.href = "/settings")}
          className="h-12 w-12"
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center px-4 gap-4">
          <h1 className="font-semibold capitalize">{activeTab === "crm" ? "CRM" : activeTab}</h1>
          
          {/* Chat toggle button when not on chat tab */}
          {activeTab !== "chat" && (
            <Button
              variant={chatPanelOpen ? "secondary" : "outline"}
              size="sm"
              onClick={() => setChatPanelOpen(!chatPanelOpen)}
              className="ml-auto gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              {chatPanelOpen ? "Hide Chat" : "Show Chat"}
            </Button>
          )}
          
          {activeTab === "chat" && (
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
          )}
        </header>

        {/* Content with optional chat side panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Tab Content */}
          <div className={cn(
            "flex-1 flex flex-col overflow-hidden transition-all duration-300",
            showChatAsSidePanel && "mr-0"
          )}>
            {/* Chat Tab */}
            {activeTab === "chat" && (
              <div className="flex flex-1 overflow-hidden">
                {/* Conversation History Sidebar */}
                <div className="w-64 border-r border-border flex flex-col">
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
                            <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
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
                </div>

                {/* Chat Messages */}
                <div className="flex-1 flex flex-col">
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
                              "max-w-[80%] rounded-2xl px-4 py-3 group relative",
                              message.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            )}
                          >
                            <p className="whitespace-pre-wrap">{message.content}</p>
                            
                            {message.role === "assistant" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="absolute -right-10 top-1 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => copyToClipboard(message.content, message.id)}
                              >
                                {copiedId === message.id ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}

                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="bg-muted rounded-2xl px-4 py-3">
                            <div className="flex gap-1">
                              <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" />
                              <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:100ms]" />
                              <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:200ms]" />
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
            )}

            {/* Calendar Tab */}
            {activeTab === "calendar" && (
              <div className="flex-1 p-4 overflow-auto">
                <CalendarView />
              </div>
            )}

            {/* CRM Tab */}
            {activeTab === "crm" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <Tabs value={crmSubTab} onValueChange={(v) => setCrmSubTab(v as any)} className="flex-1 flex flex-col">
                  <div className="px-4 pt-2">
                    <TabsList>
                      <TabsTrigger value="contacts">Contacts</TabsTrigger>
                      <TabsTrigger value="deals">Deals</TabsTrigger>
                      <TabsTrigger value="companies">Companies</TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="contacts" className="flex-1 overflow-auto mt-0">
                    <ContactsList />
                  </TabsContent>
                  <TabsContent value="deals" className="flex-1 overflow-auto mt-0">
                    <DealsPipeline />
                  </TabsContent>
                  <TabsContent value="companies" className="flex-1 overflow-auto mt-0">
                    <CompaniesList />
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Tasks Tab */}
            {activeTab === "tasks" && (
              <div className="flex-1 p-4 flex items-center justify-center">
                <div className="text-center">
                  <CheckSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Tasks</h2>
                  <p className="text-muted-foreground">Task management coming soon</p>
                </div>
              </div>
            )}

            {/* Notes Tab */}
            {activeTab === "notes" && (
              <div className="flex-1 overflow-hidden">
                <NotesPanel />
              </div>
            )}

            {/* Search Tab */}
            {activeTab === "search" && (
              <div className="flex-1 overflow-hidden">
                <SearchPanel onSelectConversation={handleSearchSelectConversation} />
              </div>
            )}
          </div>

          {/* Collapsible Chat Side Panel */}
          {showChatAsSidePanel && (
            <div className="w-96 border-l border-border flex flex-col bg-card/50">
              <div className="h-12 border-b border-border flex items-center px-3 gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="font-medium text-sm">Chat</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-8 w-8"
                  onClick={() => setChatPanelOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No messages yet
                    </p>
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
                          "max-w-[85%] rounded-xl px-3 py-2 text-sm",
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
                      <div className="bg-muted rounded-xl px-3 py-2">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce" />
                          <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce [animation-delay:100ms]" />
                          <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce [animation-delay:200ms]" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              
              <div className="border-t border-border p-3">
                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message..."
                    className="min-h-[40px] max-h-[100px] resize-none text-sm"
                    rows={1}
                  />
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
