import Link from "next/link";

/**
 * Lives at the root rather than under `devices/[uid]` because the device
 * layout is what calls `notFound()`, and a layout's not-found is handled by
 * the boundary above it.
 */
export default function NotFound() {
  return (
    <div className="rounded-xl border border-line bg-surface px-5 py-6">
      <h1 className="text-lg font-semibold text-ink">Not found</h1>
      <p className="mt-1 text-sm text-muted">
        There is nothing here. If you followed a link to a device, this project has no device with
        that UID — it may have been deleted or moved to another project.
      </p>
      <Link href="/" className="mt-4 inline-block text-sm text-primary hover:text-[var(--primary-hover)]">
        Back to the fleet
      </Link>
    </div>
  );
}
