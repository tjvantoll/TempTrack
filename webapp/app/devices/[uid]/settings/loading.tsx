import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-[34rem]" />
      <Skeleton className="h-72" />
    </div>
  );
}
