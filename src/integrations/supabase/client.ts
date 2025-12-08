// Supabase client with fallback configuration
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Fallback values for when env vars aren't loaded (Lovable Cloud manages these)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://pccvvqmrwbcdjgkyteqn.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjY3Z2cW1yd2JjZGpna3l0ZXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNjA5MTEsImV4cCI6MjA3NDczNjkxMX0.HngLS21nH4WPlBD3rkuwisjtrLDT5IWl2KLWw-Qpo7c';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
