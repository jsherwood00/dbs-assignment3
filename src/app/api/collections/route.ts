import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClerkSupabaseClient } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = await createClerkSupabaseClient();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Authentication error"; return NextResponse.json({ error: msg }, { status: 503 });
  }

  const { data: collections, error: colErr } = await supabase
    .from("collections")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (colErr) {
    console.error("Supabase collections GET error:", colErr);
    return NextResponse.json({ error: colErr.message }, { status: 500 });
  }

  const { data: assignments, error: assignErr } = await supabase
    .from("collection_fonts")
    .select("*")
    .eq("user_id", userId);

  if (assignErr) {
    return NextResponse.json({ error: assignErr.message }, { status: 500 });
  }

  return NextResponse.json({ collections: collections || [], assignments: assignments || [] });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = await createClerkSupabaseClient();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Authentication error"; return NextResponse.json({ error: msg }, { status: 503 });
  }

  const body = await req.json();
  const { name, description, fontFamilies } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { data: collection, error: colErr } = await supabase
    .from("collections")
    .insert({ user_id: userId, name, description: description || null })
    .select()
    .single();

  if (colErr) {
    return NextResponse.json({ error: colErr.message }, { status: 500 });
  }

  if (fontFamilies && fontFamilies.length > 0) {
    const rows = fontFamilies.map((family: string) => ({
      user_id: userId,
      collection_id: collection.id,
      font_family: family,
    }));
    await supabase.from("collection_fonts").insert(rows);
  }

  return NextResponse.json({ collection }, { status: 201 });
}
