import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FolderOpen, ChevronRight, ChevronDown } from "lucide-react";

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  note_count?: number;
  children?: Category[];
}

interface CategorySidebarProps {
  selectedCategory: string | null;
  onCategorySelect: (categoryId: string | null) => void;
  refreshTrigger: number;
}

const CategorySidebar = ({ selectedCategory, onCategorySelect, refreshTrigger }: CategorySidebarProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

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
        parent_id,
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
      parent_id: cat.parent_id,
      note_count: cat.notes[0]?.count || 0
    }));

    // Build hierarchical structure
    const categoryMap = new Map<string, Category>();
    categoriesWithCount.forEach((cat: Category) => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    const rootCategories: Category[] = [];
    categoriesWithCount.forEach((cat: Category) => {
      const category = categoryMap.get(cat.id)!;
      if (cat.parent_id) {
        const parent = categoryMap.get(cat.parent_id);
        if (parent) {
          parent.children!.push(category);
        }
      } else {
        rootCategories.push(category);
      }
    });

    setCategories(rootCategories);
  };

  const toggleExpanded = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const renderCategory = (category: Category, level: number = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id);
    const isSelected = selectedCategory === category.id;

    return (
      <div key={category.id}>
        <button
          onClick={() => onCategorySelect(category.id)}
          className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-2 ${
            isSelected
              ? "bg-primary text-primary-foreground shadow-soft"
              : "hover:bg-accent"
          }`}
          style={{ paddingLeft: `${16 + level * 24}px` }}
        >
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(category.id);
              }}
              className="hover:bg-accent/50 rounded p-0.5"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
          <div className="flex justify-between items-center flex-1">
            <span className="font-medium">{category.name}</span>
            <Badge variant="secondary">{category.note_count}</Badge>
          </div>
        </button>

        {hasChildren && isExpanded && (
          <div className="mt-1">
            {category.children!.map(child => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const totalNotes = categories.reduce((sum, cat) => {
    const countCategory = (c: Category): number => {
      let count = c.note_count || 0;
      if (c.children) {
        count += c.children.reduce((s, child) => s + countCategory(child), 0);
      }
      return count;
    };
    return sum + countCategory(cat);
  }, 0);

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
              <Badge variant="secondary">{totalNotes}</Badge>
            </div>
          </button>

          {categories.map((category) => renderCategory(category))}
        </div>
      </ScrollArea>
    </Card>
  );
};

export default CategorySidebar;
