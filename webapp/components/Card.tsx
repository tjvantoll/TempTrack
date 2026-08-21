import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  actions,
  footnote,
  children,
  bodyClassName = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footnote?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(31,49,64,0.04)]">
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={`px-5 py-4 ${bodyClassName}`}>{children}</div>
      {footnote && (
        <footer className="border-t border-line px-5 py-3 text-xs text-muted">{footnote}</footer>
      )}
    </section>
  );
}
