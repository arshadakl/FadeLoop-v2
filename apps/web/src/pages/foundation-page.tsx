import { healthSchema } from "@fadeloop/contracts/health";
import { useQuery } from "@tanstack/react-query";
import { getJSON } from "../api/client";
import { Button } from "../components/ui/button";

export default function FoundationPage() {
  const health = useQuery({
    queryKey: ["system", "health"],
    queryFn: async ({ signal }) =>
      healthSchema.parse(await getJSON("/api/health", signal)),
  });
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-8 md:px-10 md:py-12">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-6">
        <a href="/" className="text-lg font-bold">
          FadeLoop<span className="text-muted-foreground"> / workspace</span>
        </a>
        <span className="rounded bg-muted px-3 py-1 text-sm">Development</span>
      </header>
      <section
        className="max-w-2xl py-12 md:py-20"
        aria-labelledby="welcome-title"
      >
        <p className="mb-4 text-sm text-muted-foreground">FOUNDATION / P01</p>
        <h1
          id="welcome-title"
          className="text-balance text-3xl font-bold md:text-4xl"
        >
          A useful reply starts with a comment.
        </h1>
        <p className="mt-6 text-pretty text-muted-foreground">
          The workspace foundation is ready for development. Instagram
          connection and campaign delivery will be added after the provider
          contract is verified.
        </p>
      </section>
      <section
        className="rounded-md border border-border bg-card p-6"
        aria-labelledby="status-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="status-title" className="text-lg font-semibold">
            Environment status
          </h2>
          <Button
            variant="outline"
            onClick={() => void health.refetch()}
            disabled={health.isFetching}
          >
            Check connection
          </Button>
        </div>
        <p role="status" aria-live="polite" className="mt-4">
          {health.isPending
            ? "Checking API…"
            : health.isError
              ? "API unavailable. Start the local API Worker and try again."
              : `API connected · ${health.data.stage}`}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Sending is disabled. No Instagram account is connected.
        </p>
      </section>
      <footer className="mt-auto pt-12 text-sm text-muted-foreground">
        React · Cloudflare Workers · Event-driven delivery
      </footer>
    </main>
  );
}
