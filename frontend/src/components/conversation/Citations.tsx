import type { Citation } from "../../api/types";

/**
 * Where an answer's fetched claims came from, kept under the answer.
 *
 * Numbered and closed. A traveler under an answer wants to know that there
 * *is* a source before they want to know which one, so the chip carries the
 * number and the service's name and nothing else; the exact request only
 * matters to somebody who has decided to go and check it, and they are the
 * ones who open it.
 *
 * What opening one reveals is the whole of what the application did to get
 * that claim: what was looked up, where, and — for a web search — the exact
 * query that was sent. A search is the one place the traveler's own words
 * leave this application, so the words that left are shown back to them.
 *
 * `details` rather than state of our own: the platform already knows how to
 * open and close one, how to say so to a screen reader, and how to let a
 * keyboard do it.
 */
export function Citations({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;
  return (
    <ul aria-label="Citations" className="flex flex-wrap items-start gap-2">
      {citations.map((citation, at) => (
        // An opened chip takes the row to itself, so what it reveals opens
        // underneath rather than shouldering the chips beside it out of line.
        <li key={at} className="max-w-full has-[[open]]:w-full">
          <details className="max-w-full">
            {/* The summary keeps its own display, so it keeps the role a
                browser gives a disclosure; the arranging is a span inside it. */}
            <summary className="w-fit max-w-full cursor-pointer list-none rounded-chip border border-verified/40 bg-verified-tint px-2.5 py-1 font-mono text-micro text-verified transition-colors hover:border-verified [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-1.5">
                <span className="tabular-nums">{at + 1}</span>
                <span className="min-w-0 truncate uppercase">{citation.service}</span>
              </span>
            </summary>
            <div className="mt-2 flex flex-col gap-1 rounded-panel border border-line bg-surface px-3 py-2">
              <p className="text-meta text-ink">{citation.about}</p>
              {citation.url !== null && (
                <a
                  href={citation.url}
                  // Somewhere the application does not control, so it opens away
                  // from the Conversation carrying no referrer and no handle
                  // back onto this window.
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="font-mono text-micro break-all text-accent underline decoration-1 underline-offset-2 transition-colors hover:text-accent-strong"
                >
                  {citation.url}
                </a>
              )}
              {citation.query !== null && (
                // The exact words that left the machine, shown exactly as they
                // left it. A traveler opening a search Citation is checking
                // what was sent on their behalf, so this is the sent query
                // rather than the one the advisor asked for — anything shaped
                // like a document number has already been taken out of it.
                <p className="flex flex-col gap-0.5">
                  <span className="font-mono text-micro uppercase text-ink-subtle">
                    Query sent
                  </span>
                  <span className="font-mono text-micro break-words text-ink-muted">
                    {citation.query}
                  </span>
                </p>
              )}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
