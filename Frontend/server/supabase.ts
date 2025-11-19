import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

export function getAdminSupabase(): SupabaseClient | null {
	const url = process.env.SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !serviceKey) return null;
	if (adminClient) return adminClient;
	adminClient = createClient(url, serviceKey, {
		auth: { persistSession: false, autoRefreshToken: false },
	});
	return adminClient;
}

export type { SupabaseClient };




