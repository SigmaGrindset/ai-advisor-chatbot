import { useEffect, useState } from "react";

type Health = {
  status: "ok" | "degraded";
  database: "up" | "down";
  openrouter_key: "configured" | "missing";
};

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json() as Promise<Health>)
      .then(setHealth)
      .catch(() => setUnreachable(true));
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">AI Travel Advisor</h1>
      <p className="text-neutral-600">
        The advisor is not here yet. This page confirms the application is running and can
        reach everything it needs.
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <Reading label="Application" value={unreachable ? "unreachable" : (health?.status ?? "…")} />
        <Reading label="Database" value={health?.database ?? "…"} />
        <Reading label="OpenRouter key" value={health?.openrouter_key ?? "…"} />
      </dl>
    </main>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </>
  );
}
