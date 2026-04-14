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
  { value: "liked", label: "Liked", authOnly: true },
  { value: "recommended", label: "Recommended", authOnly: true },
] as const;

// Human-friendly labels for variant strings from the Google Fonts API
function formatVariant(v: string): string {
  const map: Record<string, string> = {
    "100": "Thin",
    "200": "Extra Light",
    "300": "Light",
    regular: "Regular",
    "500": "Medium",
    "600": "Semi Bold",
    "700": "Bold",
    "800": "Extra Bold",
    "900": "Black",
    "100italic": "Thin Italic",
    "200italic": "Extra Light Italic",
    "300italic": "Light Italic",
    italic: "Italic",
    "500italic": "Medium Italic",
    "600italic": "Semi Bold Italic",
    "700italic": "Bold Italic",
    "800italic": "Extra Bold Italic",
    "900italic": "Black Italic",
  };
  return map[v] || v;
}

// Preferred ordering so the buttons aren't random
const VARIANT_ORDER = [
  "100", "200", "300", "regular", "500", "600", "700", "800", "900",
  "100italic", "200italic", "300italic", "italic", "500italic",
  "600italic", "700italic", "800italic", "900italic",
];

export default function BrowsePage() {
  const { isSignedIn } = useAuth();
  const [fonts, setFonts] = useState<Font[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("popularity");
  const [variant, setVariant] = useState("all");
  const [previewText, setPreviewText] = useState("The quick brown fox jumps over the lazy dog");
  const [savedFamilies, setSavedFamilies] = useState<Set<string>>(new Set());
  const [savedCategoryMap, setSavedCategoryMap] = useState<Record<string, string>>({});
  const [savingFont, setSavingFont] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(40);

  // For liked/recommended we always need the full popularity-sorted list
  const apiSort = sort === "liked" || sort === "recommended" ? "popularity" : sort;

  const fetchFonts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ sort: apiSort });
    if (category !== "all") params.set("category", category);
    if (search) params.set("search", search);

    const res = await fetch(`/api/fonts?${params}`);
    const data = await res.json();
    setFonts(data.fonts || []);
    setVisibleCount(40);
    setLoading(false);
  }, [apiSort, category, search]);

  useEffect(() => {
    fetchFonts();
  }, [fetchFonts]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/saved-fonts")
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        const saved = data.savedFonts || [];
        const families = new Set<string>(
          saved.map((sf: { font_family: string }) => sf.font_family)
        );
        const catMap: Record<string, string> = {};
        for (const sf of saved) {
          if (sf.font_category) catMap[sf.font_family] = sf.font_category;
        }
        setSavedFamilies(families);
        setSavedCategoryMap(catMap);
      })
      .catch(() => {});
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
      setSavedCategoryMap((prev) => ({ ...prev, [font.family]: font.category }));
    }
    setSavingFont(null);
  };

  // Collect unique variants across all loaded fonts, sorted and capped at 20
  const availableVariants = (() => {
    const set = new Set<string>();
    for (const f of fonts) {
      for (const v of f.variants) set.add(v);
    }
    return VARIANT_ORDER.filter((v) => set.has(v)).slice(0, 20);
  })();

  // Apply client-side variant filter
  const variantFiltered =
    variant === "all"
      ? fonts
      : fonts.filter((f) => f.variants.includes(variant));

  // Apply liked/recommended modes
  const displayedFonts = (() => {
    if (sort === "liked") {
      return variantFiltered.filter((f) => savedFamilies.has(f.family));
    }
    if (sort === "recommended") {
      // Find the most common category among saved fonts
      const catCounts: Record<string, number> = {};
      for (const cat of Object.values(savedCategoryMap)) {
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      }
      const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!topCategory) return [];
      return variantFiltered
        .filter((f) => f.category === topCategory && !savedFamilies.has(f.family))
        .slice(0, 6);
    }
    return variantFiltered;
  })();

  const filterBtn = (
    active: boolean,
    onClick: () => void,
    label: string,
    key?: string
  ) => (
    <button
      key={key}
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
        active
          ? "bg-accent text-white"
          : "bg-white border border-border text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-8 space-y-4">
        <input
          type="text"
          placeholder="Search fonts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        />

        {/* Row 1: Category */}
        <div>
          <p className="text-xs font-medium text-muted mb-1.5">Category</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) =>
              filterBtn(category === cat, () => setCategory(cat), cat === "all" ? "All" : cat, cat)
            )}
          </div>
        </div>

        {/* Row 2: Style / Variant */}
        {availableVariants.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted mb-1.5">Style</p>
            <div className="flex flex-wrap gap-2">
              {filterBtn(variant === "all", () => setVariant("all"), "All")}
              {availableVariants.map((v) =>
                filterBtn(variant === v, () => setVariant(v), formatVariant(v), v)
              )}
            </div>
          </div>
        )}

        {/* Row 3: Sort */}
        <div>
          <p className="text-xs font-medium text-muted mb-1.5">Sort</p>
          <div className="flex flex-wrap gap-2">
            {SORT_OPTIONS
              .filter((opt) => !("authOnly" in opt && opt.authOnly) || isSignedIn)
              .map((opt) =>
                filterBtn(sort === opt.value, () => setSort(opt.value), opt.label, opt.value)
              )}
          </div>
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
      ) : displayedFonts.length === 0 ? (
        <div className="text-center py-20 text-muted">
          {sort === "liked"
            ? "No liked fonts yet. Save some fonts to see them here."
            : sort === "recommended"
              ? "Save some fonts first so we can recommend similar ones."
              : "No fonts found."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedFonts.slice(0, visibleCount).map((font) => (
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
          {visibleCount < displayedFonts.length && (
            <div className="text-center mt-8">
              <button
                onClick={() => setVisibleCount((c) => c + 40)}
                className="px-6 py-2.5 text-sm font-medium text-accent border border-accent rounded-lg hover:bg-accent hover:text-white transition-colors cursor-pointer"
              >
                Load more ({displayedFonts.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
