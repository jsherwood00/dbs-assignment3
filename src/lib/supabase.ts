import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Creates a Supabase client authenticated with the current Clerk user's JWT.
 * RLS policies enforce user_id scoping automatically — no manual WHERE filtering needed.
 * Call this in every API route handler (not at module scope, since the token is per-request).
 */
export async function createClerkSupabaseClient() {
  const { getToken } = await auth();
  const token = await getToken({ template: "supabase" });

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

/**
 * Service role client — bypasses RLS entirely.
 * Only use for admin operations that genuinely need to bypass user scoping.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
