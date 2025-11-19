import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
	const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
	const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
	if (!url || !anonKey) return null;
	if (supabaseClient) return supabaseClient;
	supabaseClient = createClient(url, anonKey, {
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: false,
	});
	return supabaseClient;
}

export type { SupabaseClient };




