import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FileText, MessageSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchMemory, type SearchResult } from "@/lib/supabase-api";

interface SearchPanelProps {
  onSelectNote?: (id: string) => void;
  onSelectConversation?: (id: string) => void;
}

const SearchPanel: React.FC<SearchPanelProps> = ({
  onSelectNote,
  onSelectConversation,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setHasSearched(true);
    const data = await searchMemory(query);
    setResults(data);
    setIsSearching(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Semantic Search
        </h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search your memory..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} disabled={isSearching || !query.trim()}>
            {isSearching ? "..." : "Search"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Uses AI to find semantically similar content in your notes and conversations.
        </p>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isSearching ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Searching...
            </div>
          ) : !hasSearched ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Enter a query to search your memory
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No results found. Try a different query.
            </div>
          ) : (
            results.map((result, index) => (
              <button
                key={`${result.type}-${result.id}-${index}`}
                onClick={() => {
                  if (result.type === "note" && onSelectNote) {
                    onSelectNote(result.id);
                  } else if (result.type === "conversation" && onSelectConversation) {
                    onSelectConversation(result.id);
                  }
                }}
                className={cn(
                  "w-full text-left p-3 rounded-lg hover:bg-accent transition-colors"
                )}
              >
                <div className="flex items-start gap-2">
                  {result.type === "note" ? (
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase text-muted-foreground">
                        {result.type}
                      </span>
                      <span className="text-xs text-primary">
                        {Math.round(result.score * 100)}% match
                      </span>
                    </div>
                    <p className="text-sm mt-1 line-clamp-3">
                      {result.content}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default SearchPanel;
