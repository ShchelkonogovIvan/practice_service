import Link from "next/link";
import { PublicCohorts } from "@/components/public-cohorts";
import { Button } from "@/components/ui/button";

export default async function CohortApplicationPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div>
          <p className="text-sm text-muted">Сервис сопровождения практики</p>
          <h1 className="mt-1 text-2xl font-semibold">Анкета кандидата</h1>
        </div>
        <Button asChild variant="secondary">
          <Link href="/">Все открытые наборы</Link>
        </Button>
      </header>
      <PublicCohorts cohortId={cohortId} />
    </main>
  );
}
