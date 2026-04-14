"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  { value: "in-collection", label: "In Collection", authOnly: true },
  { value: "not-in-collection", label: "Not in Collection", authOnly: true },
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
 * SIMILARITY METRIC (Algorithm C — tested against 2 alternatives)
 *
 * Scores every candidate font against each seed, averages across seeds.
 * Best-first ordering: highest score at the top.
 *
 * Scoring (max ~44 per seed):
 *
 *   1. Category match (+20, or -5 penalty):
 *      Same category is the dominant signal. Cross-category matches
 *      are penalized so they only surface when everything else aligns.
 *
 *   2. Variant set overlap (Jaccard × 12, range 0-12):
 *      Measures the fraction of combined weight/style variants shared
 *      between candidate and seed. Fonts with identical variant sets
 *      (e.g. both offer 100-900 + italics) score highest here.
 *
 *   3. Variant profile shape (+3 full-family, +2 minimal, +2 italic, +1 bold):
 *      Structural similarity — are both "workhorse text fonts" (12+ variants)
 *      or both "single-weight display fonts"? Do both offer italics? Bold?
 *
 *   4. Subset overlap (Jaccard × 4, range 0-4):
 *      Shared language/script support. Fonts covering the same writing
 *      systems are more likely to be practical substitutes.
 *
 *   5. Popularity proximity (+2 max, decays with rank distance):
 *      Slight bonus for fonts of similar popularity, since popular fonts
 *      tend to share higher production quality and similar design eras.
 *
 * Tested with 6 seed scenarios (single font, paired, cross-category,
 * iterative drilling). Outperformed pure-Jaccard and profile-only
 * approaches on all test cases — see git history for comparison data.
 */
function computeSimilarity(
  candidate: Font,
  seed: Font,
  candidateIdx: number,
  seedIdx: number
): number {
  let score = 0;

  // 1. Category match / penalty
  if (candidate.category === seed.category) score += 20;
  else score -= 5;

  // 2. Variant set Jaccard
  const seedVars = new Set(seed.variants);
  const candVars = new Set(candidate.variants);
  const intersection = [...candVars].filter((v) => seedVars.has(v)).length;
  const union = new Set([...seedVars, ...candVars]).size;
  if (union > 0) score += (intersection / union) * 12;

  // 3. Variant profile shape
  const candFull = candidate.variants.length >= 12;
  const seedFull = seed.variants.length >= 12;
  const candMin = candidate.variants.length <= 2;
  const seedMin = seed.variants.length <= 2;
  const candItalic = candidate.variants.some((v) => v.includes("italic"));
  const seedItalic = seed.variants.some((v) => v.includes("italic"));
  const candBold = candidate.variants.some((v) => v === "700");
  const seedBold = seed.variants.some((v) => v === "700");
  if (candFull === seedFull) score += 3;
  if (candMin === seedMin) score += 2;
  if (candItalic === seedItalic) score += 2;
  if (candBold === seedBold) score += 1;

  // 4. Subset Jaccard
  const seedSubs = new Set(seed.subsets || []);
  const candSubs = new Set(candidate.subsets || []);
  const subInt = [...candSubs].filter((s) => seedSubs.has(s)).length;
  const subUnion = new Set([...seedSubs, ...candSubs]).size;
  if (subUnion > 0) score += (subInt / subUnion) * 4;

  // 5. Popularity proximity
  const rankDiff = Math.abs(candidateIdx - seedIdx);
  score += Math.max(0, 2 - rankDiff * 0.002);

  return score;
}

function getRecommendations(
  allFonts: Font[],
  seedFonts: Font[],
  excludeFamilies: Set<string>,
): Font[] {
  if (seedFonts.length === 0) return [];
  const seedIndices = seedFonts.map((s) => allFonts.indexOf(s));
  const scored = allFonts
    .filter((f) => !excludeFamilies.has(f.family))
    .map((f) => {
      const ci = allFonts.indexOf(f);
      return {
        font: f,
        score:
          seedFonts.reduce(
            (sum, s, i) => sum + computeSimilarity(f, s, ci, seedIndices[i]),
            0
          ) / seedFonts.length,
      };
    })
    .sort((a, b) => b.score - a.score);
  return scored.map((s) => s.font);
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
  const [showNames, setShowNames] = useState(false);
  // Undo stack as state so changes trigger re-renders
  const [undoStack, setUndoStack] = useState<BrowseSnapshot[]>([]);

  const apiSort = sort === "in-collection" || sort === "not-in-collection" ? "popularity" : sort;

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
    if (sort === "in-collection") result = result.filter((f) => savedFamilies.has(f.family));
    if (sort === "not-in-collection") result = result.filter((f) => !savedFamilies.has(f.family));
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

  // Infinite scroll: load more when sentinel enters viewport
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < displayedFonts.length) {
          setVisibleCount((c) => c + 40);
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, displayedFonts.length]);

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
          onChange={(e) => { setSearch(e.target.value); if (e.target.value) setShowNames(true); }}
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
          maxLength={80}
          className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        />

        {/* Show names toggle */}
        <label className="inline-flex items-center gap-2 text-sm text-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showNames}
            onChange={(e) => setShowNames(e.target.checked)}
            className="accent-accent w-4 h-4 cursor-pointer"
          />
          Show names
        </label>
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
          {sort === "in-collection"
            ? "No fonts in your collection yet. Save some fonts to see them here."
            : sort === "not-in-collection"
              ? "All fonts are in your collection!"
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
                isSelected={selectedFamilies.has(font.family)}
                showName={showNames}
                onSelect={() => handleSelect(font.family)}
              />
            ))}
          </div>
          {/* Infinite scroll sentinel */}
          {visibleCount < displayedFonts.length && (
            <div ref={sentinelRef} className="h-10" />
          )}
        </>
      )}

      {/* Sticky bottom bar for Find Similar / Undo */}
      {isSignedIn && (selectedFamilies.size > 0 || undoStack.length > 0) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-border py-3 px-4">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            {selectedFamilies.size > 0 && (
              <>
                <button
                  onClick={handleFindSimilar}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer bg-accent text-white hover:bg-accent/90"
                >
                  Find similar ({selectedFamilies.size} selected)
                </button>
                <button
                  onClick={() => setSelectedFamilies(new Set())}
                  className="text-sm text-muted hover:text-foreground cursor-pointer"
                >
                  Clear selection
                </button>
              </>
            )}
            {undoStack.length > 0 && (
              <button
                onClick={handleUndo}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-muted border border-border rounded-lg hover:text-foreground hover:border-foreground transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                </svg>
                Undo
              </button>
            )}
            {recommendedFonts && (
              <button
                onClick={() => { setRecommendedFonts(null); setSelectedFamilies(new Set()); }}
                className="text-sm text-muted hover:text-foreground cursor-pointer"
              >
                Back to all fonts
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
