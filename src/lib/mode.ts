import { supabaseConfigured } from "@/lib/supabase/config";

/** Browser-storage demo mode: on whenever Supabase isn't configured. */
export const isDemoMode = !supabaseConfigured;
