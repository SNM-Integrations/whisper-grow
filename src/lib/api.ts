// Backend API client
// Base URL for the local brain service

export const API_BASE = "http://localhost:8000";

// Types
export interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  message_count: number;
  last_message: string;
  updated_at: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  type: "note" | "conversation";
}

// Health check
export async function checkHealth(): Promise<{ status: string; model: string } | null> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (response.ok) {
      return response.json();
    }
    return null;
  } catch {
    return null;
  }
}

// Chat
export async function sendMessage(message: string, conversationId?: string | null) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
    }),
  });
  if (!response.ok) throw new Error("Failed to send message");
  return response.json();
}

// Conversations
export async function fetchConversations(): Promise<Conversation[]> {
  try {
    const response = await fetch(`${API_BASE}/conversations`);
    if (response.ok) {
      const data = await response.json();
      return data.conversations || [];
    }
    return [];
  } catch {
    return [];
  }
}

export async function fetchConversation(id: string) {
  const response = await fetch(`${API_BASE}/conversations/${id}`);
  if (!response.ok) throw new Error("Failed to fetch conversation");
  return response.json();
}

export async function deleteConversation(id: string) {
  const response = await fetch(`${API_BASE}/conversations/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete conversation");
  return response.json();
}

// Notes
export async function fetchNotes(search?: string): Promise<Note[]> {
  try {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const response = await fetch(`${API_BASE}/notes?${params}`);
    if (response.ok) {
      const data = await response.json();
      return data.notes || [];
    }
    return [];
  } catch {
    return [];
  }
}

export async function fetchNote(id: string): Promise<Note | null> {
  try {
    const response = await fetch(`${API_BASE}/notes/${id}`);
    if (response.ok) {
      return response.json();
    }
    return null;
  } catch {
    return null;
  }
}

export async function createNote(title: string, content: string): Promise<Note | null> {
  try {
    const response = await fetch(`${API_BASE}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    if (response.ok) {
      return response.json();
    }
    return null;
  } catch {
    return null;
  }
}

export async function updateNote(id: string, title: string, content: string): Promise<Note | null> {
  try {
    const response = await fetch(`${API_BASE}/notes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    if (response.ok) {
      return response.json();
    }
    return null;
  } catch {
    return null;
  }
}

export async function deleteNote(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/notes/${id}`, {
      method: "DELETE",
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Memory/Semantic Search
export async function searchMemory(query: string): Promise<SearchResult[]> {
  try {
    const response = await fetch(`${API_BASE}/memory/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (response.ok) {
      const data = await response.json();
      return data.results || [];
    }
    return [];
  } catch {
    return [];
  }
}
