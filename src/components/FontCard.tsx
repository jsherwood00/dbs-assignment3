"use client";

import { useEffect, useRef } from "react";

interface FontCardProps {
  font: { family: string; category: string; variants: string[] };
  previewText: string;
  isSaved: boolean;
  onSave: () => void;
  isSaving: boolean;
  isSignedIn: boolean;
}

export default function FontCard({
  font,
  previewText,
  isSaved,
  onSave,
  isSaving,
  isSignedIn,
}: FontCardProps) {
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.family)}&display=swap`;
    document.head.appendChild(link);
  }, [font.family]);

  return (
    <div className="border border-border rounded-xl p-5 bg-white hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-medium text-sm">{font.family}</h3>
          <span className="text-xs text-muted capitalize">{font.category}</span>
        </div>
        {isSignedIn && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isSaved) onSave();
            }}
            disabled={isSaving}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isSaved
                ? "text-accent"
                : "text-muted hover:text-accent"
            }`}
            title={isSaved ? "Saved" : "Save font"}
          >
            <svg
              className="w-5 h-5"
              fill={isSaved ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>
        )}
      </div>
      <p
        className="text-xl leading-relaxed truncate"
        style={{ fontFamily: `"${font.family}", ${font.category}` }}
      >
        {previewText}
      </p>
      <div className="mt-3 text-xs text-muted">
        {font.variants.length} style{font.variants.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
