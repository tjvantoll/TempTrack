export function ErrorNotice({
  title,
  message,
  hint,
}: {
  title: string;
  message: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-muted">{message}</p>
      {hint && <p className="mt-3 text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function SetupNotice({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <h2 className="text-base font-semibold text-ink">Finish connecting to Notehub</h2>
      <p className="mt-2 text-sm text-muted">{message}</p>
      <p className="mt-4 text-sm text-muted">
        Copy <code className="rounded bg-surface-alt px-1.5 py-0.5 font-mono text-xs">.env.local.example</code>{" "}
        to <code className="rounded bg-surface-alt px-1.5 py-0.5 font-mono text-xs">.env.local</code>, fill
        in both values, then restart the dev server.
      </p>
    </div>
  );
}
