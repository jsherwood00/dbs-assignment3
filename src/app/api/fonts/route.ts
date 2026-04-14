import { NextRequest, NextResponse } from "next/server";

const GOOGLE_FONTS_API_KEY = process.env.GOOGLE_FONTS_API_KEY!;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") || "popularity";
  const category = searchParams.get("category") || "";
  const search = searchParams.get("search") || "";

  const sortMap: Record<string, string> = {
    popularity: "popularity",
    newest: "date",
    alpha: "alpha",
    trending: "trending",
  };

  const apiSort = sortMap[sort] || "popularity";
  const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${GOOGLE_FONTS_API_KEY}&sort=${apiSort}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch fonts" },
      { status: 500 }
    );
  }

  const data = await res.json();
  let fonts = data.items || [];

  if (category) {
    fonts = fonts.filter(
      (f: { category: string }) =>
        f.category.toLowerCase() === category.toLowerCase()
    );
  }

  if (search) {
    const q = search.toLowerCase();
    fonts = fonts.filter((f: { family: string }) =>
      f.family.toLowerCase().includes(q)
    );
  }

  const formatted = fonts.map(
    (f: {
      family: string;
      category: string;
      variants: string[];
      subsets: string[];
    }) => ({
      family: f.family,
      category: f.category,
      variants: f.variants,
      subsets: f.subsets,
    })
  );

  return NextResponse.json({ fonts: formatted });
}
