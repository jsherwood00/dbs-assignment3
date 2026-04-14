"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import FontCard from "@/components/FontCard";

interface Font {
  family: string;
  category: string;
  variants: string[];
  subsets?: string[];
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
] as const;

function formatVariant(v: string): string {
  const map: Record<string, string> = {
    "100": "Thin", "200": "Extra Light", "300": "Light",
    regular: "Regular", "500": "Medium", "600": "Semi Bold",
    "700": "Bold", "800": "Extra Bold", "900": "Black",
    "100italic": "Thin Italic", "200italic": "Extra Light Italic",
    "300italic": "Light Italic", italic: "Italic",
    "500italic": "Medium Italic", "600italic": "Semi Bold Italic",
    "700italic": "Bold Italic", "800italic": "Extra Bold Italic",
    "900italic": "Black Italic",
  };
  return map[v] || v;
}

const VARIANT_ORDER = [
  "100", "200", "300", "regular", "500", "600", "700", "800", "900",
  "100italic", "200italic", "300italic", "italic", "500italic",
  "600italic", "700italic", "800italic", "900italic",
];

/*
 * SIMILARITY METRIC
 *
 * Scores every candidate font against the seed fonts (selected fonts,
 * or saved library fonts as fallback). Takes the MAX score across seeds.
 *
 *   1. Category match (+10):  Same category (serif, sans-serif, etc.)
 *      is the strongest signal — fonts in the same category share
 *      fundamental structural characteristics.
 *
 *   2. Variant overlap (+1 per shared variant, up to +9):
 *      Fonts offering similar weights/styles are more likely to be
 *      interchangeable or good pairing candidates.
 *
 *   3. Variant count similarity (+3 if within ±2 of seed):
 *      Similar number of available styles suggests similar
 *      versatility and production quality.
 *
 * Candidates in the seed set or already saved are excluded.
 * Top 12 by score, popularity order as tiebreaker.
 */
function computeSimilarity(candidate: Font, seed: Font): number {
  let score = 0;
  if (candidate.category === seed.category) score += 10;
  const seedVariants = new Set(seed.variants);
  for (const v of candidate.variants) {
    if (seedVariants.has(v)) score += 1;
  }
  if (Math.abs(candidate.variants.length - seed.variants.length) <= 2) {
    score += 3;
  }
  return score;
}

function getRecommendations(
  allFonts: Font[],
  seedFonts: Font[],
  excludeFamilies: Set<string>,
  limit = 12
): Font[] {
  if (seedFonts.length === 0) return [];
  const scored = allFonts
    .filter((f) => !excludeFamilies.has(f.family))
    .map((f) => ({
      font: f,
      score: Math.max(...seedFonts.map((s) => computeSimilarity(f, s))),
    }))
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.font);
}

interface BrowseSnapshot {
  displayedFonts: Font[];
  selectedFamilies: Set<string>;
  isRecommendation: boolean;
  label: string;
}

const MAX_STACK = 100;

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
  const [visibleCount, setVisibleCount] = useState(40);
  const [selectedFamilies, setSelectedFamilies] = useState<Set<string>>(new Set());
  const [recommendedFonts, setRecommendedFonts] = useState<Font[] | null>(null);
  const [recLabel, setRecLabel] = useState("");
  // Undo stack as state so changes trigger re-renders
  const [undoStack, setUndoStack] = useState<BrowseSnapshot[]>([]);

  const apiSort = sort === "liked" ? "popularity" : sort;

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
    setRecommendedFonts(null);
    setSelectedFamilies(new Set());
  }, [apiSort, category, search]);

  useEffect(() => { fetchFonts(); }, [fetchFonts]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/saved-fonts")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const saved = data.savedFonts || [];
        setSavedFamilies(new Set(saved.map((sf: { font_family: string }) => sf.font_family)));
        const catMap: Record<string, string> = {};
        for (const sf of saved) {
          if (sf.font_category) catMap[sf.font_family] = sf.font_category;
        }
        setSavedCategoryMap(catMap);
      })
      .catch(() => {});
  }, [isSignedIn]);

  const handleSave = (font: Font) => {
    if (!isSignedIn) return;
    if (savedFamilies.has(font.family)) {
      setSavedFamilies((prev) => { const n = new Set(prev); n.delete(font.family); return n; });
      setSavedCategoryMap((prev) => { const n = { ...prev }; delete n[font.family]; return n; });
      fetch("/api/saved-fonts")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (!data) return;
          const match = (data.savedFonts || []).find((sf: { font_family: string }) => sf.font_family === font.family);
          if (match) fetch(`/api/saved-fonts/${match.id}`, { method: "DELETE" });
        }).catch(() => {});
    } else {
      setSavedFamilies((prev) => new Set(prev).add(font.family));
      setSavedCategoryMap((prev) => ({ ...prev, [font.family]: font.category }));
      fetch("/api/saved-fonts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fontFamily: font.family, fontCategory: font.category }),
      }).catch(() => {});
    }
  };

  const handleSelect = (family: string) => {
    setSelectedFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(family)) next.delete(family); else next.add(family);
      return next;
    });
  };

  function getCurrentDisplay(): Font[] {
    let result = variant === "all" ? fonts : fonts.filter((f) => f.variants.includes(variant));
    if (sort === "liked") result = result.filter((f) => savedFamilies.has(f.family));
    return result;
  }

  const handleFindSimilar = () => {
    let seeds: Font[];
    if (selectedFamilies.size > 0) {
      seeds = fonts.filter((f) => selectedFamilies.has(f.family));
    } else {
      seeds = fonts.filter((f) => savedFamilies.has(f.family));
    }
    if (seeds.length === 0) return;

    // Push current state onto undo stack
    const snapshot: BrowseSnapshot = {
      displayedFonts: recommendedFonts || getCurrentDisplay(),
      selectedFamilies: new Set(selectedFamilies),
      isRecommendation: recommendedFonts !== null,
      label: recLabel,
    };
    setUndoStack((prev) => {
      const next = [...prev, snapshot];
      if (next.length > MAX_STACK) next.shift();
      return next;
    });

    const exclude = new Set([...selectedFamilies, ...savedFamilies]);
    const seedCount = selectedFamilies.size || savedFamilies.size;
    const label = selectedFamilies.size > 0
      ? `Similar to ${seedCount} selected font${seedCount > 1 ? "s" : ""}`
      : "Similar to your library";
    setRecommendedFonts(getRecommendations(fonts, seeds, exclude));
    setRecLabel(label);
    setSelectedFamilies(new Set());
    setVisibleCount(40);
  };

  const handleUndo = () => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const snapshot = next.pop()!;
      if (snapshot.isRecommendation) {
        setRecommendedFonts(snapshot.displayedFonts);
        setRecLabel(snapshot.label);
      } else {
        setRecommendedFonts(null);
      }
      setSelectedFamilies(snapshot.selectedFamilies);
      return next;
    });
  };

  const availableVariants = (() => {
    const set = new Set<string>();
    for (const f of fonts) for (const v of f.variants) set.add(v);
    return VARIANT_ORDER.filter((v) => set.has(v)).slice(0, 20);
  })();

  const displayedFonts = recommendedFonts || getCurrentDisplay();
  const canFindSimilar = selectedFamilies.size > 0 || savedFamilies.size > 0;

  const filterBtn = (active: boolean, onClick: () => void, label: string, key?: string) => (
    <button
      key={key}
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
        active ? "bg-accent text-white" : "bg-white border border-border text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-6 space-y-4">
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

        {/* Row 2: Style */}
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
                filterBtn(
                  sort === opt.value && !recommendedFonts,
                  () => { setSort(opt.value); setRecommendedFonts(null); setSelectedFamilies(new Set()); },
                  opt.label,
                  opt.value
                )
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

        {/* Find Similar + Undo bar */}
        {isSignedIn && (
          <div className="flex items-center gap-3">
            {selectedFamilies.size === 0 && undoStack.length === 0 ? (
              <p className="text-sm text-muted">Select fonts to find similar fonts</p>
            ) : (
              <>
                {selectedFamilies.size > 0 && (
                  <button
                    onClick={handleFindSimilar}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer bg-accent text-white hover:bg-accent/90"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                    </svg>
                    Find similar ({selectedFamilies.size} selected)
                  </button>
                )}
                {undoStack.length > 0 && (
                  <button
                    onClick={handleUndo}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-muted border border-border rounded-lg hover:text-foreground hover:border-foreground transition-colors cursor-pointer"
                    title="Go back to previous view"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                    </svg>
                    Undo
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Recommendation label */}
      {recommendedFonts && (
        <div className="mb-4 flex items-center gap-3">
          <p className="text-sm font-medium text-accent">{recLabel}</p>
          <span className="text-xs text-muted">({displayedFonts.length} results)</span>
          <button
            onClick={() => { setRecommendedFonts(null); setSelectedFamilies(new Set()); }}
            className="text-xs text-muted hover:text-foreground cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-muted">Loading fonts...</div>
      ) : displayedFonts.length === 0 ? (
        <div className="text-center py-20 text-muted">
          {sort === "liked"
            ? "No liked fonts yet. Save some fonts to see them here."
            : recommendedFonts !== null
              ? "No similar fonts found. Try selecting different fonts."
              : "No fonts found."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedFonts.slice(0, visibleCount).map((font) => (
              <FontCard
                key={font.family}
                font={font}
                previewText={previewText}
                isSaved={savedFamilies.has(font.family)}
                isSelected={selectedFamilies.has(font.family)}
                onSave={() => handleSave(font)}
                onSelect={() => handleSelect(font.family)}
                isSignedIn={!!isSignedIn}
              />
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
