"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Collection {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface Assignment {
  id: string;
  collection_id: string;
  font_family: string;
}

interface SavedFont {
  id: string;
  font_family: string;
  font_category: string | null;
  note: string | null;
}

interface SearchFont {
  family: string;
  category: string;
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [savedFonts, setSavedFonts] = useState<SavedFont[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Create flow
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [fontSearch, setFontSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchFont[]>([]);
  const [selectedNewFonts, setSelectedNewFonts] = useState<Set<string>>(new Set());
  const createInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/collections").then((r) => r.json()),
      fetch("/api/saved-fonts").then((r) => r.json()),
    ]).then(([colData, sfData]) => {
      setCollections(colData.collections || []);
      setAssignments(colData.assignments || []);
      setSavedFonts(sfData.savedFonts || []);
      if (colData.collections?.length > 0) {
        setActiveTab(colData.collections[0].id);
      }
      setLoading(false);
    });
  }, []);

  // Load font stylesheets for displayed fonts
  const activeFonts = activeTab
    ? assignments
        .filter((a) => a.collection_id === activeTab)
        .map((a) => a.font_family)
    : [];

  useEffect(() => {
    activeFonts.forEach((family) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`;
      document.head.appendChild(link);
    });
  }, [activeFonts.join(",")]);

  useEffect(() => {
    if (showCreate && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [showCreate]);

  // Font search for create flow
  useEffect(() => {
    if (!fontSearch.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/fonts?search=${encodeURIComponent(fontSearch)}&sort=popularity`)
        .then((r) => r.json())
        .then((data) => setSearchResults((data.fonts || []).slice(0, 10)));
    }, 200);
    return () => clearTimeout(timer);
  }, [fontSearch]);

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        fontFamilies: [...selectedNewFonts],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setCollections((prev) => [data.collection, ...prev]);
      // Add assignments for the new fonts
      const newAssignments = [...selectedNewFonts].map((family) => ({
        id: crypto.randomUUID(),
        collection_id: data.collection.id,
        font_family: family,
      }));
      setAssignments((prev) => [...prev, ...newAssignments]);
      setActiveTab(data.collection.id);
      setNewName("");
      setFontSearch("");
      setSelectedNewFonts(new Set());
      setShowCreate(false);
    }
    setCreating(false);
  };

  const handleDelete = async (col: Collection) => {
    const res = await fetch(`/api/collections/${col.id}`, { method: "DELETE" });
    if (res.ok) {
      setCollections((prev) => prev.filter((c) => c.id !== col.id));
      setAssignments((prev) => prev.filter((a) => a.collection_id !== col.id));
      if (activeTab === col.id) {
        const remaining = collections.filter((c) => c.id !== col.id);
        setActiveTab(remaining.length > 0 ? remaining[0].id : null);
      }
    }
    setDeleteTarget(null);
  };

  const handleRemoveFromCollection = async (collectionId: string, fontFamily: string) => {
    await fetch(`/api/collections/${collectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeFont: fontFamily }),
    });
    setAssignments((prev) =>
      prev.filter((a) => !(a.collection_id === collectionId && a.font_family === fontFamily))
    );
  };

  const toggleNewFont = (family: string) => {
    setSelectedNewFonts((prev) => {
      const next = new Set(prev);
      if (next.has(family)) next.delete(family); else next.add(family);
      return next;
    });
  };

  const activeCollection = collections.find((c) => c.id === activeTab);
  const displayedFamilies = activeTab
    ? assignments.filter((a) => a.collection_id === activeTab).map((a) => a.font_family)
    : [];

  // Get saved font data for displayed families
  const savedFontMap = new Map(savedFonts.map((sf) => [sf.font_family, sf]));

  if (loading) {
    return <div className="text-center py-20 text-muted">Loading...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Collections</h1>
        <button
          onClick={() => { setShowCreate(!showCreate); setSelectedNewFonts(new Set()); setFontSearch(""); }}
          className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent/90 rounded-lg transition-colors cursor-pointer"
        >
          {showCreate ? "Cancel" : "+ New Collection"}
        </button>
      </div>

      {/* Create flow */}
      {showCreate && (
        <div className="border-2 border-accent/20 rounded-xl p-5 bg-white mb-6 space-y-4">
          <input
            ref={createInputRef}
            type="text"
            placeholder="Collection name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />

          {/* Font search */}
          <div>
            <input
              type="text"
              placeholder="Search fonts to add..."
              value={fontSearch}
              onChange={(e) => setFontSearch(e.target.value)}
              className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
            {searchResults.length > 0 && (
              <div className="mt-2 border border-border rounded-lg max-h-48 overflow-y-auto">
                {searchResults.map((f) => (
                  <button
                    key={f.family}
                    onClick={() => toggleNewFont(f.family)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between cursor-pointer ${
                      selectedNewFonts.has(f.family) ? "bg-accent/5" : ""
                    }`}
                  >
                    <span>{f.family} <span className="text-muted capitalize text-xs">({f.category})</span></span>
                    {selectedNewFonts.has(f.family) && (
                      <span className="text-accent text-xs font-medium">Added</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected fonts chips */}
          {selectedNewFonts.size > 0 && (
            <div className="flex flex-wrap gap-2">
              {[...selectedNewFonts].map((family) => (
                <span
                  key={family}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-accent/10 text-accent text-xs rounded-lg"
                >
                  {family}
                  <button
                    onClick={() => toggleNewFont(family)}
                    className="hover:text-accent/70 cursor-pointer"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="px-5 py-2.5 text-sm font-medium text-white bg-accent hover:bg-accent/90 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {creating ? "Creating..." : `Create${selectedNewFonts.size > 0 ? ` with ${selectedNewFonts.size} font${selectedNewFonts.size > 1 ? "s" : ""}` : ""}`}
          </button>
        </div>
      )}

      {/* Tabs */}
      {collections.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-2 mb-6 border-b border-border pb-4">
            {collections.map((col) => {
              const count = assignments.filter((a) => a.collection_id === col.id).length;
              return (
                <div key={col.id} className="flex items-center gap-0.5">
                  <button
                    onClick={() => setActiveTab(col.id)}
                    className={`px-4 py-2 text-sm rounded-l-lg transition-colors cursor-pointer ${
                      activeTab === col.id
                        ? "bg-accent text-white"
                        : "bg-white border border-border border-r-0 text-muted hover:text-foreground"
                    }`}
                  >
                    {col.name} ({count})
                  </button>
                  <button
                    onClick={() => setDeleteTarget(col)}
                    className={`px-2 py-2 text-sm rounded-r-lg transition-colors cursor-pointer ${
                      activeTab === col.id
                        ? "bg-accent text-white/60 hover:text-white"
                        : "bg-white border border-border text-gray-300 hover:text-red-400"
                    }`}
                    title="Delete collection"
                  >
                    &times;
                  </button>
                </div>
              );
            })}
          </div>

          {/* Font grid */}
          {activeCollection && displayedFamilies.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted mb-4">No fonts in &ldquo;{activeCollection.name}&rdquo; yet.</p>
              <Link href="/" className="text-accent hover:underline">Browse fonts to add some</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedFamilies.map((family) => {
                const sf = savedFontMap.get(family);
                return (
                  <div
                    key={family}
                    className="border-2 border-border rounded-xl p-3 bg-white hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Link
                        href={`/font/${encodeURIComponent(family)}`}
                        className="font-medium text-sm hover:text-accent transition-colors"
                      >
                        {family}
                      </Link>
                      <button
                        onClick={() => activeTab && handleRemoveFromCollection(activeTab, family)}
                        className="text-gray-300 hover:text-red-400 transition-colors cursor-pointer p-1"
                        title="Remove from collection"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <p
                      className="text-xl leading-relaxed min-h-[3rem] mb-2"
                      style={{ fontFamily: `"${family}", sans-serif` }}
                    >
                      The quick brown fox jumps over the lazy dog
                    </p>

                    {sf?.note && (
                      <p className="text-xs text-muted italic">&ldquo;{sf.note}&rdquo;</p>
                    )}

                    <div className="mt-2 flex justify-end">
                      <Link
                        href={`/font/${encodeURIComponent(family)}`}
                        className="text-2xl text-muted hover:text-foreground transition-colors p-2 -m-2"
                      >
                        &rarr;
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20">
          <p className="text-muted mb-4">No collections yet. Create one to organize your fonts.</p>
          <Link href="/" className="text-accent hover:underline">Browse fonts</Link>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="font-semibold mb-2">Delete &ldquo;{deleteTarget.name}&rdquo;?</h3>
            <p className="text-sm text-muted mb-5">
              This will remove the collection. The fonts themselves won&apos;t be deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
