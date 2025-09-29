-- Create ai_settings table for user-specific AI configuration
CREATE TABLE public.ai_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.3,
  system_prompt TEXT NOT NULL DEFAULT 'You are a smart categorization assistant for a personal knowledge management system. Your job is to analyze notes and suggest the most appropriate category.

Rules:
1. If the note fits an existing category, return that category name
2. If no existing category fits well, suggest a new meaningful category name
3. Category names should be clear, concise, and descriptive (1-3 words)
4. Return ONLY the category name, nothing else',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own AI settings" 
ON public.ai_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own AI settings" 
ON public.ai_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI settings" 
ON public.ai_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AI settings" 
ON public.ai_settings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_ai_settings_updated_at
BEFORE UPDATE ON public.ai_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();