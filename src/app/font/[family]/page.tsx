"use client";

import { useState, useEffect, use } from "react";
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
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
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
  }, [isSignedIn, family]);

  const handleToggleSave = async () => {
    if (saving) return;
    setSaving(true);

    if (saved) {
      // Unsave
      const res = await fetch(`/api/saved-fonts/${saved.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSaved(null);
        setNote("");
        setNoteEdited(false);
      }
    } else {
      // Save
      const res = await fetch("/api/saved-fonts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fontFamily: family,
          fontCategory: font?.category,
          note: note || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSaved(data.savedFont);
        setNoteEdited(false);
      }
    }
    setSaving(false);
  };

  const handleSaveNote = async () => {
    if (!saved || saving) return;
    setSaving(true);
    const res = await fetch(`/api/saved-fonts/${saved.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    if (res.ok) {
      const data = await res.json();
      setSaved(data.savedFont);
      setNoteEdited(false);
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="text-center py-20 text-muted">Loading...</div>;
  }

  if (!font) {
    return (
      <div className="text-center py-20">
        <p className="text-muted mb-4">Font not found.</p>
        <Link href="/" className="text-accent hover:underline">
          Back to browse
        </Link>
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

      <div className="mb-8">
        <h1
          className="text-3xl font-bold mb-1"
          style={{ fontFamily: `"${family}"` }}
        >
          {family}
        </h1>
        <span className="text-sm text-muted capitalize">{font.category}</span>
      </div>

      {/* Note */}
      {isSignedIn && (
        <section className="mb-10">
          <textarea
            placeholder="Add a note... e.g. 'Good for headings, pair with Inter'"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setNoteEdited(true);
            }}
            rows={2}
            className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
          />
          {noteEdited && saved && (
            <button
              onClick={handleSaveNote}
              disabled={saving}
              className="mt-2 px-4 py-1.5 text-sm font-medium text-white bg-accent hover:bg-accent/90 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Saving..." : "Save note"}
            </button>
          )}
        </section>
      )}

      {/* Size previews */}
      <section className="mb-10 space-y-6">
        {SAMPLE_SIZES.map(({ label, size, weight }) => (
          <div key={label}>
            <p className="text-xs text-muted mb-1">{label}</p>
            <p
              className={`${size} ${weight}`}
              style={{ fontFamily: `"${family}"` }}
            >
              The quick brown fox jumps over the lazy dog
            </p>
          </div>
        ))}
      </section>

      {/* Character set */}
      <section className="mb-10">
        <h2 className="text-sm font-medium text-muted mb-3">Character Set</h2>
        <p
          className="text-2xl tracking-wide break-all"
          style={{ fontFamily: `"${family}"` }}
        >
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
            <span
              key={v}
              className="px-3 py-1 text-xs border border-border rounded-lg capitalize"
            >
              {v}
            </span>
          ))}
        </div>
      </section>

      {/* Subsets */}
      <section className="mb-10">
        <h2 className="text-sm font-medium text-muted mb-3">Subsets</h2>
        <div className="flex flex-wrap gap-2">
          {font.subsets.map((s) => (
            <span
              key={s}
              className="px-3 py-1 text-xs border border-border rounded-lg capitalize"
            >
              {s}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
