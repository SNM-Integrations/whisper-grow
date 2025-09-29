import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FolderOpen } from "lucide-react";

interface Category {
  id: string;
  name: string;
  note_count?: number;
}

interface CategorySidebarProps {
  selectedCategory: string | null;
  onCategorySelect: (categoryId: string | null) => void;
  refreshTrigger: number;
}

const CategorySidebar = ({ selectedCategory, onCategorySelect, refreshTrigger }: CategorySidebarProps) => {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchCategories();
  }, [refreshTrigger]);

  const fetchCategories = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('categories')
      .select(`
        id,
        name,
        notes (count)
      `)
      .eq('user_id', user.id)
      .order('name');

    if (error) {
      console.error("Error fetching categories:", error);
      return;
    }

    const categoriesWithCount = data.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      note_count: cat.notes[0]?.count || 0
    }));

    setCategories(categoriesWithCount);
  };

  return (
    <Card className="h-full p-6 shadow-soft border-border/50 bg-card/80 backdrop-blur">
      <div className="flex items-center gap-2 mb-4">
        <FolderOpen className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Categories</h2>
      </div>
      
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-2">
          <button
            onClick={() => onCategorySelect(null)}
            className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
              selectedCategory === null
                ? "bg-primary text-primary-foreground shadow-soft"
                : "hover:bg-accent"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="font-medium">All Notes</span>
              <Badge variant="secondary">
                {categories.reduce((sum, cat) => sum + (cat.note_count || 0), 0)}
              </Badge>
            </div>
          </button>

          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => onCategorySelect(category.id)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                selectedCategory === category.id
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "hover:bg-accent"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium">{category.name}</span>
                <Badge variant="secondary">{category.note_count}</Badge>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};

export default CategorySidebar;