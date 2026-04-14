"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import FontCard from "@/components/FontCard";

interface Font {
  family: string;
  category: string;
  variants: string[];
}

const CATEGORIES = [
  "all",
  "serif",
  "sans-serif",
  "display",
  "handwriting",
  "monospace",
];

const SORT_OPTIONS = [
  { value: "popularity", label: "Popular" },
  { value: "newest", label: "Newest" },
  { value: "alpha", label: "A-Z" },
  { value: "trending", label: "Trending" },
];

export default function BrowsePage() {
  const { isSignedIn } = useAuth();
  const [fonts, setFonts] = useState<Font[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("popularity");
  const [previewText, setPreviewText] = useState("The quick brown fox jumps over the lazy dog");
  const [savedFamilies, setSavedFamilies] = useState<Set<string>>(new Set());
  const [savingFont, setSavingFont] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(40);

  const fetchFonts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ sort });
    if (category !== "all") params.set("category", category);
    if (search) params.set("search", search);

    const res = await fetch(`/api/fonts?${params}`);
    const data = await res.json();
    setFonts(data.fonts || []);
    setVisibleCount(40);
    setLoading(false);
  }, [sort, category, search]);

  useEffect(() => {
    fetchFonts();
  }, [fetchFonts]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/saved-fonts")
      .then((r) => r.json())
      .then((data) => {
        const families = new Set<string>(
          (data.savedFonts || []).map((sf: { font_family: string }) => sf.font_family)
        );
        setSavedFamilies(families);
      });
  }, [isSignedIn]);

  const handleSave = async (font: Font) => {
    if (!isSignedIn || savingFont) return;
    setSavingFont(font.family);

    const res = await fetch("/api/saved-fonts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fontFamily: font.family,
        fontCategory: font.category,
      }),
    });

    if (res.ok) {
      setSavedFamilies((prev) => new Set(prev).add(font.family));
    }
    setSavingFont(null);
  };

  return (
    <div>
      <div className="mb-8 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search fonts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-4 py-2.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 text-sm rounded-lg capitalize transition-colors cursor-pointer ${
                category === cat
                  ? "bg-accent text-white"
                  : "bg-white border border-border text-muted hover:text-foreground"
              }`}
            >
              {cat === "all" ? "All" : cat}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Type to preview..."
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
          className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        />
      </div>

      {loading ? (
        <div className="text-center py-20 text-muted">Loading fonts...</div>
      ) : fonts.length === 0 ? (
        <div className="text-center py-20 text-muted">No fonts found.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {fonts.slice(0, visibleCount).map((font) => (
              <Link
                key={font.family}
                href={`/font/${encodeURIComponent(font.family)}`}
              >
                <FontCard
                  font={font}
                  previewText={previewText}
                  isSaved={savedFamilies.has(font.family)}
                  onSave={() => handleSave(font)}
                  isSaving={savingFont === font.family}
                  isSignedIn={!!isSignedIn}
                />
              </Link>
            ))}
          </div>
          {visibleCount < fonts.length && (
            <div className="text-center mt-8">
              <button
                onClick={() => setVisibleCount((c) => c + 40)}
                className="px-6 py-2.5 text-sm font-medium text-accent border border-accent rounded-lg hover:bg-accent hover:text-white transition-colors cursor-pointer"
              >
                Load more ({fonts.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
