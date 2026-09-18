import type { ReactNode } from "react";

import { parse, type Block, type Inline } from "./markdown";

/**
 * The advisor's reply, drawn from the tree the parser read it into.
 *
 * Every element on the page is chosen here, from a closed set of shapes. The
 * reply's own text only ever reaches the page as the children of an element
 * this file named, which is why there is nothing to sanitise: a reply cannot
 * name an element, so there is no element for it to name badly.
 */
export function Prose({
  text,
  writing = false,
}: {
  text: string;
  /** True while the reply is still arriving, which draws the caret. */
  writing?: boolean;
}) {
  const blocks = parse(text);
  // A reply whose first fragment has not arrived yet is still a reply being
  // written, and the caret is the only thing saying so.
  if (writing && blocks.length === 0) {
    return (
      <p className="text-body text-ink">
        <Caret />
      </p>
    );
  }
  return <Blocks blocks={blocks} caret={writing} />;
}

/** One block, with the caret riding on it if it is the last of them. */
function Drawn({ block, caret }: { block: Block; caret: boolean }) {
  switch (block.kind) {
    case "paragraph":
      return (
        <p className="text-body text-ink">
          <Written content={block.content} />
          {caret && <Caret />}
        </p>
      );

    case "heading":
      return (
        <Heading level={block.level}>
          <Written content={block.content} />
          {caret && <Caret />}
        </Heading>
      );

    case "list": {
      const items = block.items.map((item, at) => (
        <li key={at} className="ps-1">
          <Blocks blocks={item} caret={caret && at === block.items.length - 1} />
        </li>
      ));
      return block.ordered ? (
        <ol start={block.start} className="flex list-decimal flex-col gap-2 ps-6 marker:text-ink-subtle">
          {items}
        </ol>
      ) : (
        <ul className="flex list-disc flex-col gap-2 ps-6 marker:text-ink-subtle">{items}</ul>
      );
    }

    case "quote":
      return (
        <blockquote className="border-s-2 border-line-strong ps-4 text-ink-muted">
          <Blocks blocks={block.content} caret={caret} />
        </blockquote>
      );

    case "code":
      return (
        <pre className="overflow-x-auto rounded-panel bg-sunken px-4 py-3 font-mono text-meta text-ink">
          <code>
            {block.text}
            {caret && <Caret />}
          </code>
        </pre>
      );

    case "rule":
      return <hr className="border-t border-line" />;
  }
}

function Blocks({ blocks, caret }: { blocks: Block[]; caret: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, at) => (
        <Drawn key={at} block={block} caret={caret && at === blocks.length - 1} />
      ))}
    </div>
  );
}

/**
 * A reply's own headings, set below the one the Message already has.
 *
 * Each Message is an article under a heading naming who is speaking, so a
 * reply's headings continue that outline rather than restarting it.
 */
function Heading({ level, children }: { level: 1 | 2 | 3; children: ReactNode }) {
  const weight = "font-display font-semibold text-ink";
  if (level === 1) return <h3 className={`mt-2 text-title ${weight}`}>{children}</h3>;
  if (level === 2) return <h4 className={`mt-1 text-heading ${weight}`}>{children}</h4>;
  return <h5 className={`text-heading ${weight}`}>{children}</h5>;
}

function Written({ content }: { content: Inline[] }) {
  return (
    <>
      {content.map((inline, at) => (
        <Run key={at} inline={inline} />
      ))}
    </>
  );
}

function Run({ inline }: { inline: Inline }) {
  switch (inline.kind) {
    case "text":
      return inline.text;

    case "emphasis":
      return (
        <em>
          <Written content={inline.content} />
        </em>
      );

    case "strong":
      return (
        <strong className="font-semibold">
          <Written content={inline.content} />
        </strong>
      );

    case "code":
      return (
        <code className="rounded-control bg-sunken px-1 py-0.5 text-[0.9em]">{inline.text}</code>
      );

    case "link":
      return (
        <a
          href={inline.href}
          // A link the advisor wrote leads somewhere the application does not
          // control, so it opens away from the Conversation and carries no
          // referrer and no handle back onto this window.
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-accent underline decoration-1 underline-offset-2 transition-colors hover:text-accent-strong"
        >
          <Written content={inline.content} />
        </a>
      );
  }
}

/** Where the reply has got to, for as long as it is still being written. */
function Caret() {
  return (
    <span
      aria-hidden="true"
      className="ms-0.5 inline-block h-[1lh] w-[2px] translate-y-[3px] animate-caret bg-accent align-baseline"
    />
  );
}
