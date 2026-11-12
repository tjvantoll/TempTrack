import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>

      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Skeleton className="h-[420px]" />
          <Skeleton className="h-[420px]" />
        </div>
        <Skeleton className="h-28" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-48" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
