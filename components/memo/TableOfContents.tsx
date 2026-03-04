"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { MemoSection } from "@/types";

interface TableOfContentsProps {
  sections: MemoSection[];
}

export function TableOfContents({ sections }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0.1 }
    );

    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav className="space-y-1">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Contents
      </p>
      {sections.map((section) => (
        <button
          key={section.id}
          onClick={() => {
            document
              .getElementById(section.id)
              ?.scrollIntoView({ behavior: "smooth" });
          }}
          className={cn(
            "block w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
            activeId === section.id
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {section.title}
        </button>
      ))}
    </nav>
  );
}
