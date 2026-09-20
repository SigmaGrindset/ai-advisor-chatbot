/**
 * The Markdown the advisor writes, read into a closed set of shapes.
 *
 * A reply is model output, so the safety here is structural rather than
 * filtering: the tree this answers with has no node for an image and none for
 * raw markup. A reply containing `<script>` cannot become a script element,
 * because there is nothing for it to become.
 */

/** One run inside a line of prose. */
export type Inline =
  | { kind: "text"; text: string }
  | { kind: "emphasis"; content: Inline[] }
  | { kind: "strong"; content: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "link"; href: string; content: Inline[] };

/** One thing in a reply, in the order it was written. */
export type Block =
  | { kind: "paragraph"; content: Inline[] }
  | { kind: "heading"; level: 1 | 2 | 3; content: Inline[] }
  | { kind: "list"; ordered: boolean; start: number; items: Block[][] }
  | { kind: "quote"; content: Block[] }
  | { kind: "code"; text: string }
  | { kind: "rule" };

/**
 * The addresses a link may carry. Everything else is refused and the link
 * becomes its own words. An allowed list, so a scheme invented tomorrow is
 * refused by default.
 */
const FOLLOWABLE = /^(?:https?|mailto):/i;

/**
 * How far structure is followed before it is read as prose. Past this the text
 * still arrives, as paragraphs: the limit bounds the work, it drops nothing.
 */
const MAX_DEPTH = 6;

export function parse(markdown: string): Block[] {
  const lines = markdown
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "    ")
    .split("\n");
  return blocks(lines, 0);
}

/**
 * A reply as words alone, for a live region to read out. Given the reply as
 * written, a screen reader announces "hash hash Three Days in Lisbon"; read
 * off the tree, the punctuation meant for a renderer is gone.
 */
export function spoken(markdown: string): string {
  return said(parse(markdown)).join("\n");
}

function said(blocks: Block[]): string[] {
  return blocks.flatMap((block) => {
    switch (block.kind) {
      case "paragraph":
      case "heading":
        return [words(block.content)];
      case "list":
        return block.items.flatMap((item) => said(item));
      case "quote":
        return said(block.content);
      case "code":
        return block.text === "" ? [] : [block.text];
      case "rule":
        return [];
    }
  });
}

function words(content: Inline[]): string {
  return content
    .map((inline) => (inline.kind === "text" || inline.kind === "code" ? inline.text : words(inline.content)))
    .join("");
}

function blocks(lines: string[], depth: number): Block[] {
  const found: Block[] = [];
  let at = 0;

  while (at < lines.length) {
    const line = lines[at]!;

    if (line.trim() === "") {
      at += 1;
      continue;
    }

    if (RULE.test(line.trim())) {
      found.push({ kind: "rule" });
      at += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence !== null) {
      const opener = fence[1]!;
      const indent = indentOf(line);
      const fenced: string[] = [];
      at += 1;
      // An unclosed fence runs to the end, because a reply still arriving has
      // not written its closing fence yet.
      while (at < lines.length && !closesFence(lines[at]!, opener)) {
        fenced.push(lines[at]!.slice(indent));
        at += 1;
      }
      if (at < lines.length) at += 1;
      // The label is read only so it is not taken for the first line of code.
      // Nothing draws it: this interface does no highlighting.
      found.push({ kind: "code", text: fenced.join("\n") });
      continue;
    }

    const heading = HEADING.exec(line.trimStart());
    if (heading !== null) {
      found.push({
        // A reply already sits under a heading, so its own are three levels of
        // weight rather than six of outline.
        kind: "heading",
        level: Math.min(heading[1]!.length, 3) as 1 | 2 | 3,
        content: inlines(heading[2]!.trim()),
      });
      at += 1;
      continue;
    }

    if (depth < MAX_DEPTH && QUOTE.test(line)) {
      const quoted: string[] = [];
      while (at < lines.length && QUOTE.test(lines[at]!)) {
        quoted.push(lines[at]!.replace(QUOTE, ""));
        at += 1;
      }
      found.push({ kind: "quote", content: blocks(quoted, depth + 1) });
      continue;
    }

    const opening = depth < MAX_DEPTH ? itemAt(line) : null;
    if (opening !== null) {
      const read = list(lines, at, opening, depth);
      found.push(read.list);
      at = read.end;
      continue;
    }

    const paragraph: string[] = [];
    while (at < lines.length && lines[at]!.trim() !== "" && !opensBlock(lines[at]!, depth)) {
      paragraph.push(lines[at]!.trim());
      at += 1;
    }
    // A line that opens an unrecognised block is prose after all.
    if (paragraph.length === 0) {
      paragraph.push(lines[at]!.trim());
      at += 1;
    }
    found.push({ kind: "paragraph", content: inlines(paragraph.join(" ")) });
  }

  return found;
}

/** One list item's marker, and where its own content begins. */
type Item = { ordered: boolean; number: number; indent: number; content: number; text: string };

function itemAt(line: string): Item | null {
  const marked = ITEM.exec(line);
  if (marked === null) return null;
  const [, spaces, , counted, text] = marked;
  const number = counted === undefined ? Number.NaN : Number.parseInt(counted, 10);
  return {
    ordered: !Number.isNaN(number),
    number: Number.isNaN(number) ? 1 : number,
    indent: spaces!.length,
    content: marked[0]!.length - text!.length,
    text: text!,
  };
}

/** A whole list from where it opens, and the line the list stops at. */
function list(
  lines: string[],
  from: number,
  opening: Item,
  depth: number,
): { list: Block; end: number } {
  const items: Block[][] = [];
  let gathering: string[] = [];
  let at = from;

  /** Commit the item whose lines have been collected, if there is one. */
  function close(): void {
    if (gathering.length > 0) items.push(blocks(gathering, depth + 1));
    gathering = [];
  }

  while (at < lines.length) {
    const line = lines[at]!;

    if (line.trim() === "") {
      // A blank line only ends the list if nothing indented follows it.
      const next = lines.findIndex((after, index) => index > at && after.trim() !== "");
      const continues =
        next !== -1 && (itemAt(lines[next]!)?.indent === opening.indent || indentOf(lines[next]!) >= opening.content);
      if (!continues) break;
      gathering.push("");
      at += 1;
      continue;
    }

    const item = itemAt(line);
    if (item !== null && item.indent === opening.indent) {
      // A run of bullets and a run of numbers are two different lists, even
      // with no blank line between them.
      if (item.ordered !== opening.ordered) break;
      close();
      gathering.push(item.text);
      at += 1;
      continue;
    }

    // Anything indented as far as the item's text belongs to that item, which
    // is how a nested list arrives inside its parent.
    if (indentOf(line) >= opening.content) {
      gathering.push(line.slice(opening.content));
      at += 1;
      continue;
    }

    if (item !== null || opensBlock(line, depth)) break;

    // A plain line under an item continues that item's own paragraph.
    gathering.push(line.trim());
    at += 1;
  }

  close();
  return {
    list: { kind: "list", ordered: opening.ordered, start: opening.number, items },
    end: at,
  };
}

/** True when this line begins something other than more of a paragraph. */
function opensBlock(line: string, depth: number): boolean {
  const trimmed = line.trim();
  if (RULE.test(trimmed)) return true;
  if (FENCE.test(line)) return true;
  if (HEADING.test(line.trimStart())) return true;
  if (depth >= MAX_DEPTH) return false;
  return QUOTE.test(line) || itemAt(line) !== null;
}

/** True when this line is the fence that shuts the one that was opened. */
function closesFence(line: string, opener: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith(opener) && trimmed === trimmed[0]!.repeat(trimmed.length);
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

const RULE = /^(-{3,}|\*{3,}|_{3,})$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)[ \t]*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const QUOTE = /^ {0,3}> ?/;
const ITEM = /^( *)(?:([-*+])|(\d{1,9})[.)]) +(.*)$/;

/** Read one line of prose, pairing delimiters that actually close. */
function inlines(line: string): Inline[] {
  const content: Inline[] = [];
  let plain = "";

  /** Commit whatever has been read as ordinary text before something else. */
  function flush(): void {
    if (plain === "") return;
    content.push({ kind: "text", text: plain });
    plain = "";
  }

  let at = 0;
  while (at < line.length) {
    const here = line[at]!;

    if (here === "\\" && at + 1 < line.length && PUNCTUATION.test(line[at + 1]!)) {
      // A backslash before punctuation asks for the character itself.
      plain += line[at + 1];
      at += 2;
      continue;
    }

    if (here === "`") {
      const span = codeAt(line, at);
      if (span !== null) {
        flush();
        content.push({ kind: "code", text: span.text });
        at = span.end;
        continue;
      }
    }

    if (here === "<") {
      const address = AUTOLINK.exec(line.slice(at));
      if (address !== null && FOLLOWABLE.test(address[1]!)) {
        flush();
        content.push({
          kind: "link",
          href: address[1]!,
          content: [{ kind: "text", text: address[1]! }],
        });
        at += address[0]!.length;
        continue;
      }
    }

    // `![alt](src)` asks for an image, and there is no such shape to give it,
    // so what is left is the words it was labelled with.
    const figure = here === "!" && line[at + 1] === "[";
    if (here === "[" || figure) {
      const linked = linkAt(line, figure ? at + 1 : at);
      if (linked !== null) {
        flush();
        const href = figure ? null : followable(linked.href);
        if (href === null) content.push(...linked.content);
        else content.push({ kind: "link", href, content: linked.content });
        at = linked.end;
        continue;
      }
    }

    if (here === "*" || here === "_") {
      const emphasised = emphasisAt(line, at);
      if (emphasised !== null) {
        flush();
        content.push(emphasised.inline);
        at = emphasised.end;
        continue;
      }
    }

    plain += here;
    at += 1;
  }

  flush();
  return coalesce(content);
}

/**
 * Runs of ordinary text that ended up side by side, joined back together. A
 * refused link and a dropped image both leave their words in place, and
 * joining them makes one sentence rather than three abutting fragments.
 */
function coalesce(content: Inline[]): Inline[] {
  const joined: Inline[] = [];
  for (const inline of content) {
    const last = joined[joined.length - 1];
    if (inline.kind === "text" && last?.kind === "text") last.text += inline.text;
    else joined.push(inline.kind === "text" ? { ...inline } : inline);
  }
  return joined;
}

/** A code span opening at this position, or null when nothing closes it. */
function codeAt(line: string, at: number): { text: string; end: number } | null {
  let opener = 0;
  while (line[at + opener] === "`") opener += 1;
  const fence = "`".repeat(opener);

  let from = at + opener;
  for (;;) {
    const closes = line.indexOf(fence, from);
    if (closes === -1) return null;
    if (line[closes + opener] === "`") {
      // A longer run is not this span's closer; look past the whole of it.
      from = closes + opener;
      while (line[from] === "`") from += 1;
      continue;
    }
    const text = line.slice(at + opener, closes);
    return {
      // One space either side is how a span starting or ending in a backtick
      // is written, so it belongs to the markup rather than the code.
      text: text.startsWith(" ") && text.endsWith(" ") && text.trim() !== "" ? text.slice(1, -1) : text,
      end: closes + opener,
    };
  }
}

/** A `[label](address)` opening at this position, however it ends up used. */
function linkAt(
  line: string,
  at: number,
): { content: Inline[]; href: string; end: number } | null {
  const label = matching(line, at, "[", "]");
  if (label === null || line[label + 1] !== "(") return null;
  const address = matching(line, label + 1, "(", ")");
  if (address === null) return null;

  // `(https://a.example "Title")` carries a title nothing here shows, so the
  // address is what stands before the first space.
  const inside = line.slice(label + 2, address).trim();
  const href = inside.startsWith("<") ? inside.slice(1, inside.indexOf(">")) : inside.split(/\s/)[0]!;

  return { content: inlines(line.slice(at + 1, label)), href, end: address + 1 };
}

/** Where a bracket opened at this position closes, counting nested pairs. */
function matching(line: string, at: number, open: string, close: string): number | null {
  let depth = 0;
  for (let index = at; index < line.length; index += 1) {
    if (line[index] === "\\") {
      index += 1;
      continue;
    }
    if (line[index] === open) depth += 1;
    else if (line[index] === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return null;
}

/** The address as something a traveler can follow, or null if it is not. */
function followable(href: string): string | null {
  // Control characters are how `java\tscript:` reads as a scheme in a browser
  // but not in a test for one.
  const address = href.replace(/[\u0000-\u0020\u007f]/g, "");
  return FOLLOWABLE.test(address) ? address : null;
}

const AUTOLINK = /^<([a-z][a-z0-9+.-]*:[^<>\s]+)>/i;

/** Emphasis opening at this position, or null when nothing closes it. */
function emphasisAt(line: string, at: number): { inline: Inline; end: number } | null {
  const marker = line[at]!;
  const opener = line.startsWith(marker.repeat(2), at) ? marker.repeat(2) : marker;

  // `exchange_rate_eur` is a word with underscores in it rather than a request
  // for emphasis, so an underscore only opens and closes at a word's edge.
  if (marker === "_" && isWordCharacter(line[at - 1])) return null;

  const closes = closerAt(line, at + opener.length, opener);
  if (closes === null) return null;

  const inner = line.slice(at + opener.length, closes);
  if (inner.trim() === "") return null;

  return {
    inline: { kind: opener.length === 2 ? "strong" : "emphasis", content: inlines(inner) },
    end: closes + opener.length,
  };
}

/** Where this delimiter next closes, skipping escaped ones, or null. */
function closerAt(line: string, from: number, delimiter: string): number | null {
  for (let at = from; at <= line.length - delimiter.length; at += 1) {
    if (line[at] === "\\") {
      at += 1;
      continue;
    }
    if (!line.startsWith(delimiter, at)) continue;
    // A single delimiter is not closed by the first of a longer run.
    if (delimiter.length === 1 && line[at + 1] === delimiter) continue;
    if (delimiter === "_" && isWordCharacter(line[at + 1])) continue;
    return at;
  }
  return null;
}

const PUNCTUATION = /[\\`*_{}[\]()#+\-.!<>|~]/;

function isWordCharacter(character: string | undefined): boolean {
  return character !== undefined && /[\p{L}\p{N}]/u.test(character);
}
