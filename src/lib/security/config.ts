// Server-only consumer facade. Validation remains lazy and canonical.
export { getSupabaseServerConfig, SupabaseConfigurationError, SUPABASE_URL_ENV, SUPABASE_ANON_KEY_ENV } from "../supabase/config.ts";
export type { SupabaseServerConfig } from "../supabase/config.ts";
