"use client";

import { useState, useEffect, use, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";

interface FontDetail {
  family: string;
  category: string;
  variants: string[];
  subsets: string[];
}

interface SavedFont {
  id: string;
  font_family: string;
  note: string | null;
  collection: string;
}

interface Collection {
  id: string;
  name: string;
}

interface Assignment {
  collection_id: string;
  font_family: string;
}

const SAMPLE_SIZES = [
  { label: "Heading 1", size: "text-4xl", weight: "font-bold" },
  { label: "Heading 2", size: "text-2xl", weight: "font-semibold" },
  { label: "Body", size: "text-base", weight: "font-normal" },
  { label: "Caption", size: "text-sm", weight: "font-light" },
];

const CHARSET_PREVIEW =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";

export default function FontDetailPage({
  params,
}: {
  params: Promise<{ family: string }>;
}) {
  const { family: rawFamily } = use(params);
  const family = decodeURIComponent(rawFamily);
  const { isSignedIn } = useAuth();
  const [font, setFont] = useState<FontDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<SavedFont | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [noteEdited, setNoteEdited] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@100;200;300;400;500;600;700;800;900&display=swap`;
    document.head.appendChild(link);
  }, [family]);

  useEffect(() => {
    fetch(`/api/fonts?search=${encodeURIComponent(family)}`)
      .then((r) => r.json())
      .then((data) => {
        const match = (data.fonts || []).find(
          (f: FontDetail) => f.family === family
        );
        setFont(match || null);
        setLoading(false);
      });
  }, [family]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/saved-fonts")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const match = (data.savedFonts || []).find(
          (sf: SavedFont) => sf.font_family === family
        );
        if (match) {
          setSaved(match);
          setNote(match.note || "");
        }
      })
      .catch(() => {});
    fetch("/api/collections")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setCollections(data.collections || []);
          setAssignments(
            (data.assignments || []).filter((a: Assignment) => a.font_family === family)
          );
        }
      })
      .catch(() => {});
  }, [isSignedIn, family]);

  // Close picker on outside click
  useEffect(() => {
    if (!showCollectionPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowCollectionPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCollectionPicker]);

  const handleNoteBlur = async () => {
    if (!noteEdited || saving) return;
    setSaving(true);
    if (saved) {
      const res = await fetch(`/api/saved-fonts/${saved.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (res.ok) {
        const data = await res.json();
        setSaved(data.savedFont);
      }
    } else if (note.trim()) {
      const res = await fetch("/api/saved-fonts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fontFamily: family, fontCategory: font?.category, note }),
      });
      if (res.ok) {
        const data = await res.json();
        setSaved(data.savedFont);
      }
    }
    setNoteEdited(false);
    setSaving(false);
  };

  const isInCollection = (colId: string) =>
    assignments.some((a) => a.collection_id === colId);

  const toggleCollection = async (col: Collection) => {
    if (isInCollection(col.id)) {
      // Remove
      await fetch(`/api/collections/${col.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeFont: family }),
      });
      setAssignments((prev) =>
        prev.filter((a) => !(a.collection_id === col.id))
      );
    } else {
      // Add
      await fetch(`/api/collections/${col.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addFont: family }),
      });
      setAssignments((prev) => [
        ...prev,
        { collection_id: col.id, font_family: family },
      ]);
    }
  };

  const inCount = assignments.length;

  if (loading) {
    return <div className="text-center py-20 text-muted">Loading...</div>;
  }

  if (!font) {
    return (
      <div className="text-center py-20">
        <p className="text-muted mb-4">Font not found.</p>
        <Link href="/" className="text-accent hover:underline">Back to browse</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/"
        className="text-sm text-muted hover:text-foreground mb-6 inline-block"
      >
        &larr; Back to browse
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1
            className="text-3xl font-bold mb-1"
            style={{ fontFamily: `"${family}"` }}
          >
            {family}
          </h1>
          <span className="text-sm text-muted capitalize">{font.category}</span>
        </div>

        {/* Add to Collection button */}
        {isSignedIn && collections.length > 0 && (
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setShowCollectionPicker(!showCollectionPicker)}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                inCount > 0
                  ? "bg-accent text-white hover:bg-accent/90"
                  : "border-2 border-accent text-accent hover:bg-accent hover:text-white"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {inCount > 0 ? `In ${inCount} collection${inCount > 1 ? "s" : ""}` : "Add to Collection"}
            </button>

            {showCollectionPicker && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-border rounded-xl shadow-lg z-10 py-2">
                {collections.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => toggleCollection(col)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-3 cursor-pointer"
                  >
                    <span className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs ${
                      isInCollection(col.id)
                        ? "bg-accent border-accent text-white"
                        : "border-border"
                    }`}>
                      {isInCollection(col.id) && "✓"}
                    </span>
                    {col.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Note */}
      {isSignedIn && (
        <section className="mb-10">
          <textarea
            placeholder="Add a note... e.g. 'Good for headings, pair with Inter'"
            value={note}
            onChange={(e) => { setNote(e.target.value); setNoteEdited(true); }}
            onBlur={handleNoteBlur}
            rows={2}
            className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
          />
          {saving && <p className="mt-1 text-xs text-muted">Saving...</p>}
        </section>
      )}

      {/* Size previews */}
      <section className="mb-10 space-y-6">
        {SAMPLE_SIZES.map(({ label, size, weight }) => (
          <div key={label}>
            <p className="text-xs text-muted mb-1">{label}</p>
            <p className={`${size} ${weight}`} style={{ fontFamily: `"${family}"` }}>
              The quick brown fox jumps over the lazy dog
            </p>
          </div>
        ))}
      </section>

      {/* Character set */}
      <section className="mb-10">
        <h2 className="text-sm font-medium text-muted mb-3">Character Set</h2>
        <p className="text-2xl tracking-wide break-all" style={{ fontFamily: `"${family}"` }}>
          {CHARSET_PREVIEW}
        </p>
      </section>

      {/* Variants */}
      <section className="mb-10">
        <h2 className="text-sm font-medium text-muted mb-3">
          Available Styles ({font.variants.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          {font.variants.map((v) => (
            <span key={v} className="px-3 py-1 text-xs border border-border rounded-lg capitalize">{v}</span>
          ))}
        </div>
      </section>

      {/* Subsets */}
      <section className="mb-10">
        <h2 className="text-sm font-medium text-muted mb-3">Subsets</h2>
        <div className="flex flex-wrap gap-2">
          {font.subsets.map((s) => (
            <span key={s} className="px-3 py-1 text-xs border border-border rounded-lg capitalize">{s}</span>
          ))}
        </div>
      </section>
    </div>
  );
}
