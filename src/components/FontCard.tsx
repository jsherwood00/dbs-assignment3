"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

interface FontCardProps {
  font: { family: string; category: string; variants: string[] };
  previewText: string;
  isSaved: boolean;
  isSelected: boolean;
  onSave: () => void;
  onSelect: () => void;
  isSignedIn: boolean;
}

export default function FontCard({
  font,
  previewText,
  isSaved,
  isSelected,
  onSave,
  onSelect,
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
    <div
      onClick={onSelect}
      className={`border-2 rounded-xl p-5 bg-white hover:shadow-md transition-all cursor-pointer ${
        isSelected
          ? "border-accent shadow-md ring-2 ring-accent/20"
          : "border-border"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-medium text-sm">{font.family}</h3>
        <div className="flex items-center gap-1">
          {isSignedIn && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSave();
              }}
              className={`p-1 rounded-lg transition-colors cursor-pointer ${
                isSaved
                  ? "text-indigo-300"
                  : "text-indigo-200 hover:text-indigo-300"
              }`}
              title={isSaved ? "Unsave" : "Save font"}
            >
              <svg
                className="w-7 h-7"
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
      </div>
      <p
        className="text-xl leading-relaxed min-h-[3.5rem]"
        style={{ fontFamily: `"${font.family}", ${font.category}` }}
      >
        {previewText}
      </p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted">
          {font.variants.length} style{font.variants.length !== 1 ? "s" : ""}
        </span>
        <Link
          href={`/font/${encodeURIComponent(font.family)}`}
          onClick={(e) => e.stopPropagation()}
          className="text-2xl text-muted hover:text-foreground transition-colors p-3 -m-3"
          title="View details"
        >
          &rarr;
        </Link>
      </div>
    </div>
  );
}
