import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createClient(runtimeUrl?: string, runtimePublishableKey?: string) {
  const url = runtimeUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = runtimePublishableKey || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Falta configurar la conexión con Supabase.");
  }

  return createSupabaseClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
