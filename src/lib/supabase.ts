import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Creates a Supabase client authenticated with the current Clerk user's JWT.
 * RLS policies enforce user_id scoping automatically.
 *
 * Throws if the Clerk token is unavailable — never falls back to service role.
 * The Clerk JWT template must be named "supabase" (configured in Clerk dashboard).
 */
export async function createClerkSupabaseClient() {
  const { getToken, userId } = await auth();

  if (!userId) {
    throw new Error("User is not signed in");
  }

  let token: string | null = null;
  try {
    token = await getToken({ template: "supabase" });
  } catch (err) {
    console.error("Clerk getToken error:", err);
    throw new Error("Failed to get Supabase JWT from Clerk. Check that a JWT template named 'supabase' exists in the Clerk dashboard.");
  }

  if (!token) {
    console.error("Clerk getToken returned null for template 'supabase'. userId:", userId);
    throw new Error(
      "Clerk returned no token for the 'supabase' JWT template. " +
      "Verify the template exists at: Clerk Dashboard > JWT Templates > 'supabase'"
    );
  }

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
