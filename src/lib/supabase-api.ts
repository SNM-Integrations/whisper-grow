// Cloud API client using Supabase
import { supabase } from "@/integrations/supabase/client";

// Types
export interface Note {
  id: string;
  content: string;
  formatted_content: string | null;
  category_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  employees: number | null;
  revenue: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  stage: string;
  contact_id: string | null;
  company_id: string | null;
  expected_close_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  type: "note" | "conversation";
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  priority: "low" | "medium" | "high";
  due_date: string | null;
  category_id: string | null;
  created_at: string;
  updated_at: string;
}

// ============ NOTES ============
export async function fetchNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("id, content, formatted_content, category_id, created_at, updated_at")
    .order("updated_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching notes:", error);
    return [];
  }
  return data || [];
}

export async function createNote(content: string): Promise<Note | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("notes")
    .insert({ content, user_id: user.id })
    .select()
    .single();
  
  if (error) {
    console.error("Error creating note:", error);
    return null;
  }
  return data;
}

export async function updateNote(id: string, content: string): Promise<Note | null> {
  const { data, error } = await supabase
    .from("notes")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  
  if (error) {
    console.error("Error updating note:", error);
    return null;
  }
  return data;
}

export async function deleteNote(id: string): Promise<boolean> {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) {
    console.error("Error deleting note:", error);
    return false;
  }
  return true;
}

export async function searchNotes(query: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("id, content, formatted_content, category_id, created_at, updated_at")
    .ilike("content", `%${query}%`)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error searching notes:", error);
    return [];
  }
  return data || [];
}

// ============ SEARCH (combined) ============
export async function searchMemory(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  // Search notes
  const notes = await searchNotes(query);
  for (const note of notes) {
    results.push({
      id: note.id,
      content: note.content.slice(0, 200),
      score: 0.8, // Placeholder score for text search
      type: "note",
    });
  }

  // Search messages in conversations
  const { data: messages } = await supabase
    .from("messages")
    .select("id, conversation_id, content")
    .ilike("content", `%${query}%`)
    .limit(10);

  if (messages) {
    for (const msg of messages) {
      results.push({
        id: msg.conversation_id,
        content: msg.content.slice(0, 200),
        score: 0.7,
        type: "conversation",
      });
    }
  }

  return results;
}

// ============ CONVERSATIONS ============
export async function fetchConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .order("updated_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching conversations:", error);
    return [];
  }
  return data || [];
}

export async function createConversation(title?: string): Promise<Conversation | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("conversations")
    .insert({ title: title || "New Chat", user_id: user.id })
    .select()
    .single();
  
  if (error) {
    console.error("Error creating conversation:", error);
    return null;
  }
  return data;
}

export async function deleteConversation(id: string): Promise<boolean> {
  const { error } = await supabase.from("conversations").delete().eq("id", id);
  if (error) {
    console.error("Error deleting conversation:", error);
    return false;
  }
  return true;
}

// ============ MESSAGES ============
export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  
  if (error) {
    console.error("Error fetching messages:", error);
    return [];
  }
  return (data || []).map(m => ({
    ...m,
    role: m.role as "user" | "assistant"
  }));
}

export async function saveMessage(conversationId: string, role: "user" | "assistant", content: string): Promise<Message | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, role, content, user_id: user.id })
    .select()
    .single();
  
  if (error) {
    console.error("Error saving message:", error);
    return null;
  }
  
  // Update conversation's updated_at
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  
  return data ? { ...data, role: data.role as "user" | "assistant" } : null;
}

// ============ CONTACTS ============
export async function fetchContacts(): Promise<Contact[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .order("name", { ascending: true });
  
  if (error) {
    console.error("Error fetching contacts:", error);
    return [];
  }
  return data || [];
}

export async function createContact(contact: Omit<Contact, "id" | "created_at" | "updated_at">): Promise<Contact | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("contacts")
    .insert({ ...contact, user_id: user.id })
    .select()
    .single();
  
  if (error) {
    console.error("Error creating contact:", error);
    return null;
  }
  return data;
}

export async function updateContact(id: string, contact: Partial<Contact>): Promise<Contact | null> {
  const { data, error } = await supabase
    .from("contacts")
    .update({ ...contact, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  
  if (error) {
    console.error("Error updating contact:", error);
    return null;
  }
  return data;
}

export async function deleteContact(id: string): Promise<boolean> {
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) {
    console.error("Error deleting contact:", error);
    return false;
  }
  return true;
}

// ============ COMPANIES ============
export async function fetchCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("name", { ascending: true });
  
  if (error) {
    console.error("Error fetching companies:", error);
    return [];
  }
  return data || [];
}

export async function createCompany(company: Omit<Company, "id" | "created_at" | "updated_at">): Promise<Company | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("companies")
    .insert({ ...company, user_id: user.id })
    .select()
    .single();
  
  if (error) {
    console.error("Error creating company:", error);
    return null;
  }
  return data;
}

export async function updateCompany(id: string, company: Partial<Company>): Promise<Company | null> {
  const { data, error } = await supabase
    .from("companies")
    .update({ ...company, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  
  if (error) {
    console.error("Error updating company:", error);
    return null;
  }
  return data;
}

export async function deleteCompany(id: string): Promise<boolean> {
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) {
    console.error("Error deleting company:", error);
    return false;
  }
  return true;
}

// ============ DEALS ============
export async function fetchDeals(): Promise<Deal[]> {
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching deals:", error);
    return [];
  }
  return data || [];
}

export async function createDeal(deal: Omit<Deal, "id" | "created_at" | "updated_at">): Promise<Deal | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("deals")
    .insert({ ...deal, user_id: user.id })
    .select()
    .single();
  
  if (error) {
    console.error("Error creating deal:", error);
    return null;
  }
  return data;
}

export async function updateDeal(id: string, deal: Partial<Deal>): Promise<Deal | null> {
  const { data, error } = await supabase
    .from("deals")
    .update({ ...deal, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  
  if (error) {
    console.error("Error updating deal:", error);
    return null;
  }
  return data;
}

export async function deleteDeal(id: string): Promise<boolean> {
  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) {
    console.error("Error deleting deal:", error);
    return false;
  }
  return true;
}

// ============ TASKS ============
export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }
  return (data || []).map(t => ({
    ...t,
    priority: t.priority as "low" | "medium" | "high"
  }));
}

export async function createTask(task: Omit<Task, "id" | "created_at" | "updated_at" | "category_id">): Promise<Task | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...task, user_id: user.id })
    .select()
    .single();
  
  if (error) {
    console.error("Error creating task:", error);
    return null;
  }
  return data ? { ...data, priority: data.priority as "low" | "medium" | "high" } : null;
}

export async function updateTask(id: string, task: Partial<Task>): Promise<Task | null> {
  const { data, error } = await supabase
    .from("tasks")
    .update({ ...task, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  
  if (error) {
    console.error("Error updating task:", error);
    return null;
  }
  return data ? { ...data, priority: data.priority as "low" | "medium" | "high" } : null;
}

export async function deleteTask(id: string): Promise<boolean> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) {
    console.error("Error deleting task:", error);
    return false;
  }
  return true;
}

// ============ AI CHAT (Streaming) ============
export async function streamChat({
  messages,
  conversationId,
  onDelta,
  onDone,
}: {
  messages: { role: "user" | "assistant"; content: string }[];
  conversationId?: string;
  onDelta: (deltaText: string) => void;
  onDone: () => void;
}) {
  // Use fallback URL since env var may not be available in deployed builds
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://pccvvqmrwbcdjgkyteqn.supabase.co';
  const CHAT_URL = `${SUPABASE_URL}/functions/v1/chat`;
  console.log("Chat URL:", CHAT_URL);
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.error("No session found - user not authenticated");
    throw new Error("Not authenticated");
  }
  console.log("Session found, user:", session.user.email);

  try {
    console.log("Calling edge function with messages:", messages.length);
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ messages, conversationId }),
    });

    console.log("Response status:", resp.status);

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error("Error response:", errorText);
      throw new Error(errorText || `Chat failed: ${resp.status}`);
    }

    if (!resp.body) {
      console.error("No response body");
      throw new Error("No response body");
    }
    
    console.log("Got response body, starting stream...");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  // Final flush
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
}
