import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-[360px] sm:h-[440px]" />
      <Skeleton className="h-72" />
    </div>
  );
}
