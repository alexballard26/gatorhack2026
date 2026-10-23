import { Suspense } from "react";
import { RacePage } from "@/components/RacePage";
import { PageSkeleton } from "@/components/ui";

export const metadata = { title: "Race | BallotScout" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RacePage raceId={decodeURIComponent(id)} />
    </Suspense>
  );
}
