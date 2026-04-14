import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClerkSupabaseClient } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClerkSupabaseClient();

  const { data, error } = await supabase
    .from("saved_fonts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ savedFonts: data });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClerkSupabaseClient();
  const body = await req.json();
  const { fontFamily, fontCategory, note } = body;

  if (!fontFamily) {
    return NextResponse.json({ error: "fontFamily is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("saved_fonts")
    .insert({
      user_id: userId,
      font_family: fontFamily,
      font_category: fontCategory || null,
      note: note || null,
      collection: "default",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ savedFont: data }, { status: 201 });
}
