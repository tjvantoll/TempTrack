"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { RANGES, type RangeKey } from "@/lib/time-ranges";

/**
 * Writes the window into the URL so a view is shareable and every section on
 * the page moves together.
 */
export function TimeRangePicker({ value }: { value: RangeKey }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const select = (key: RangeKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", key);
    startTransition(() => router.push(`?${params.toString()}`, { scroll: false }));
  };

  return (
    <div
      role="group"
      aria-label="Time range"
      data-pending={isPending ? "" : undefined}
      className="inline-flex rounded-lg border border-line bg-surface-alt p-0.5 data-pending:opacity-60"
    >
      {RANGES.map((range) => {
        const active = range.key === value;
        return (
          <button
            key={range.key}
            type="button"
            aria-pressed={active}
            onClick={() => select(range.key)}
            className={[
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
            ].join(" ")}
          >
            {range.short}
            <span className="sr-only"> — last {range.label}</span>
          </button>
        );
      })}
    </div>
  );
}
