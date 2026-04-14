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

  const supabase = await createClerkSupabaseClient();
  const { id } = await params;

  // Delete font assignments first
  await supabase
    .from("collection_fonts")
    .delete()
    .eq("collection_id", id);

  // Delete the collection
  const { error } = await supabase
    .from("collections")
    .delete()
    .eq("id", id);

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

  const supabase = await createClerkSupabaseClient();
  const { id } = await params;
  const body = await req.json();

  if (body.addFont) {
    await supabase.from("collection_fonts").upsert(
      { user_id: userId, collection_id: id, font_family: body.addFont },
      { onConflict: "collection_id,font_family" }
    );
  }

  if (body.removeFont) {
    await supabase
      .from("collection_fonts")
      .delete()
      .eq("collection_id", id)
      .eq("font_family", body.removeFont);
  }

  return NextResponse.json({ success: true });
}
