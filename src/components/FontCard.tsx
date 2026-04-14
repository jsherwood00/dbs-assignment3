"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

interface FontCardProps {
  font: { family: string; category: string; variants: string[] };
  previewText: string;
  isSelected: boolean;
  showName: boolean;
  onSelect: () => void;
}

export default function FontCard({
  font,
  previewText,
  isSelected,
  showName,
  onSelect,
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
      className={`border-2 rounded-xl p-3 bg-white hover:shadow-md transition-all cursor-pointer ${
        isSelected
          ? "border-accent shadow-md ring-2 ring-accent/20"
          : "border-border"
      }`}
    >
      {showName && (
        <h3 className="font-medium text-sm mb-3">{font.family}</h3>
      )}
      <p
        className="text-xl leading-relaxed min-h-[3.5rem]"
        style={{ fontFamily: `"${font.family}", ${font.category}` }}
      >
        {previewText}
      </p>
      <div className="mt-3 flex justify-end">
        <Link
          href={`/font/${encodeURIComponent(font.family)}`}
          onClick={(e) => e.stopPropagation()}
          className="text-3xl text-muted hover:text-foreground transition-colors p-2 -m-2"
          title="View details"
        >
          &rarr;
        </Link>
      </div>
    </div>
  );
}
