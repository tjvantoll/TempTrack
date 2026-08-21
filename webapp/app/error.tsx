"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <h2 className="text-base font-semibold text-ink">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-[var(--primary-contrast)] hover:bg-[var(--primary-hover)]"
      >
        Try again
      </button>
    </div>
  );
}
