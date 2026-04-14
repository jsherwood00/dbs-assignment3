import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClerkSupabaseClient } from "@/lib/supabase";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  const { error } = await supabase
    .from("saved_fonts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, string | null> = {};

  if ("note" in body) updates.note = body.note;
  if ("collection" in body) updates.collection = body.collection;

  const { data, error } = await supabase
    .from("saved_fonts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ savedFont: data });
}
