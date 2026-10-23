import { Suspense } from "react";
import { BallotPage } from "@/components/BallotPage";
import { PageSkeleton } from "@/components/ui";

export const metadata = { title: "Your ballot | BallotScout" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BallotPage />
    </Suspense>
  );
}
