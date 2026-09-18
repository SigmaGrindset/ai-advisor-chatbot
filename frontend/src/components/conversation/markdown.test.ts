import { describe, expect, it } from "vitest";

import { parse, spoken } from "./markdown";

describe("what the advisor writes in prose", () => {
  it("reads a run of lines as one paragraph and a blank line as a break", () => {
    expect(parse("Lisbon in April\nis mild.\n\nPack a light jacket.")).toEqual([
      { kind: "paragraph", content: [{ kind: "text", text: "Lisbon in April is mild." }] },
      { kind: "paragraph", content: [{ kind: "text", text: "Pack a light jacket." }] },
    ]);
  });

  it("reads emphasis and strong emphasis in either spelling", () => {
    expect(parse("Take *cash* and **a card**, not __only__ a card.")).toEqual([
      {
        kind: "paragraph",
        content: [
          { kind: "text", text: "Take " },
          { kind: "emphasis", content: [{ kind: "text", text: "cash" }] },
          { kind: "text", text: " and " },
          { kind: "strong", content: [{ kind: "text", text: "a card" }] },
          { kind: "text", text: ", not " },
          { kind: "strong", content: [{ kind: "text", text: "only" }] },
          { kind: "text", text: " a card." },
        ],
      },
    ]);
  });

  it("leaves an underscore inside a word alone", () => {
    // `exchange_rate_eur` is a word with underscores in it, not a request for
    // emphasis, and mangling it would be worse than not offering emphasis.
    expect(parse("Ask for exchange_rate_eur by name.")).toEqual([
      {
        kind: "paragraph",
        content: [{ kind: "text", text: "Ask for exchange_rate_eur by name." }],
      },
    ]);
  });

  it("takes a backslash as a request for the character itself", () => {
    expect(parse(String.raw`A literal \*asterisk\* survives.`)).toEqual([
      { kind: "paragraph", content: [{ kind: "text", text: "A literal *asterisk* survives." }] },
    ]);
  });
});

describe("what the advisor writes as a structure", () => {
  it("reads a bulleted list, whichever bullet was used", () => {
    expect(parse("- Alfama\n* Belem\n+ Sintra")).toEqual([
      {
        kind: "list",
        ordered: false,
        start: 1,
        items: [
          [{ kind: "paragraph", content: [{ kind: "text", text: "Alfama" }] }],
          [{ kind: "paragraph", content: [{ kind: "text", text: "Belem" }] }],
          [{ kind: "paragraph", content: [{ kind: "text", text: "Sintra" }] }],
        ],
      },
    ]);
  });

  it("reads a numbered list and keeps the number it began at", () => {
    expect(parse("3. Third day\n4. Fourth day")).toEqual([
      {
        kind: "list",
        ordered: true,
        start: 3,
        items: [
          [{ kind: "paragraph", content: [{ kind: "text", text: "Third day" }] }],
          [{ kind: "paragraph", content: [{ kind: "text", text: "Fourth day" }] }],
        ],
      },
    ]);
  });

  it("reads a list nested inside an item as a list inside that item", () => {
    expect(parse("- Day one\n  - Morning\n  - Afternoon\n- Day two")).toEqual([
      {
        kind: "list",
        ordered: false,
        start: 1,
        items: [
          [
            { kind: "paragraph", content: [{ kind: "text", text: "Day one" }] },
            {
              kind: "list",
              ordered: false,
              start: 1,
              items: [
                [{ kind: "paragraph", content: [{ kind: "text", text: "Morning" }] }],
                [{ kind: "paragraph", content: [{ kind: "text", text: "Afternoon" }] }],
              ],
            },
          ],
          [{ kind: "paragraph", content: [{ kind: "text", text: "Day two" }] }],
        ],
      },
    ]);
  });

  it("reads a heading, and flattens the depths below the third onto it", () => {
    // A reply already sits under a heading of its own, so its own headings are
    // three levels of weight rather than six levels of outline.
    expect(parse("## Getting there\n\n##### Visas")).toEqual([
      { kind: "heading", level: 2, content: [{ kind: "text", text: "Getting there" }] },
      { kind: "heading", level: 3, content: [{ kind: "text", text: "Visas" }] },
    ]);
  });

  it("reads a quote and a thematic break", () => {
    expect(parse("> Book ahead.\n\n---")).toEqual([
      {
        kind: "quote",
        content: [{ kind: "paragraph", content: [{ kind: "text", text: "Book ahead." }] }],
      },
      { kind: "rule" },
    ]);
  });

  it("ends a paragraph where a list begins, without a blank line between them", () => {
    expect(parse("Three days:\n- Alfama")).toEqual([
      { kind: "paragraph", content: [{ kind: "text", text: "Three days:" }] },
      {
        kind: "list",
        ordered: false,
        start: 1,
        items: [[{ kind: "paragraph", content: [{ kind: "text", text: "Alfama" }] }]],
      },
    ]);
  });
});

describe("what the advisor writes as a link or a figure", () => {
  it("reads a link, and an address written on its own", () => {
    expect(parse("See [the rules](https://gov.uk/visas) or <https://example.org/a>.")).toEqual([
      {
        kind: "paragraph",
        content: [
          { kind: "text", text: "See " },
          {
            kind: "link",
            href: "https://gov.uk/visas",
            content: [{ kind: "text", text: "the rules" }],
          },
          { kind: "text", text: " or " },
          {
            kind: "link",
            href: "https://example.org/a",
            content: [{ kind: "text", text: "https://example.org/a" }],
          },
          { kind: "text", text: "." },
        ],
      },
    ]);
  });

  it("reads code, inline and as a block, without looking inside it", () => {
    expect(parse("Try `**EUR**`.\n\n```json\n{\"a\": **1**}\n```")).toEqual([
      {
        kind: "paragraph",
        content: [
          { kind: "text", text: "Try " },
          { kind: "code", text: "**EUR**" },
          { kind: "text", text: "." },
        ],
      },
      { kind: "code", text: '{"a": **1**}' },
    ]);
  });
});

describe("what the advisor is not able to put on the page", () => {
  it("has no shape for an image, so asking for one leaves its words behind", () => {
    // There is no image node to build, so a model-supplied image cannot reach
    // the page whatever the reply says. Its alt text is still what it said.
    expect(parse("![a beach](https://elsewhere.example/track.png)")).toEqual([
      { kind: "paragraph", content: [{ kind: "text", text: "a beach" }] },
    ]);
  });

  it("reads markup as the characters it is made of", () => {
    const written = '<img src=x onerror="steal()"> and <script>steal()</script>';
    expect(parse(written)).toEqual([
      { kind: "paragraph", content: [{ kind: "text", text: written }] },
    ]);
  });

  it("refuses a link whose address is a way of running something", () => {
    // The words stay — only the address is dropped, so the traveler still
    // reads what they were told and simply has nothing to click.
    for (const address of ["javascript:steal()", "data:text/html,<script>", "vbscript:x"]) {
      expect(parse(`Read [the rules](${address}) first.`)).toEqual([
        {
          kind: "paragraph",
          content: [{ kind: "text", text: "Read the rules first." }],
        },
      ]);
    }
  });

  it("allows only the schemes a traveler can follow", () => {
    const [paragraph] = parse("[a](https://a.example) [b](http://b.example) [c](mailto:c@d.example)");
    expect(paragraph).toEqual({
      kind: "paragraph",
      content: [
        { kind: "link", href: "https://a.example", content: [{ kind: "text", text: "a" }] },
        { kind: "text", text: " " },
        { kind: "link", href: "http://b.example", content: [{ kind: "text", text: "b" }] },
        { kind: "text", text: " " },
        { kind: "link", href: "mailto:c@d.example", content: [{ kind: "text", text: "c" }] },
      ],
    });
  });
});

describe("a reply that is still arriving", () => {
  it("shows a delimiter that has not closed yet as the character it is", () => {
    expect(parse("Pack **a light")).toEqual([
      { kind: "paragraph", content: [{ kind: "text", text: "Pack **a light" }] },
    ]);
    expect(parse("Read [the rul")).toEqual([
      { kind: "paragraph", content: [{ kind: "text", text: "Read [the rul" }] },
    ]);
  });

  it("shows a fence that has not closed yet as the code it has so far", () => {
    expect(parse("```\nEUR 1.00")).toEqual([{ kind: "code", text: "EUR 1.00" }]);
  });

  it("reads every prefix of a reply without failing, and the whole as the whole", () => {
    const reply = [
      "## Three days in **Lisbon**",
      "",
      "1. Alfama, then a [viewpoint](https://example.org/x)",
      "   - Morning: `tram 28`",
      "2. Belem",
      "",
      "> Book ahead.",
      "",
      "```json",
      '{"rate": 1.08}',
      "```",
    ].join("\n");

    for (let upto = 0; upto <= reply.length; upto += 1) {
      expect(() => parse(reply.slice(0, upto))).not.toThrow();
    }
    expect(parse(reply).map((block) => block.kind)).toEqual(["heading", "list", "quote", "code"]);
  });
});

describe("a reply read out rather than looked at", () => {
  it("says the words and none of the markup", () => {
    // A live region handed the reply as written announces "hash hash Three
    // Days", because to a screen reader markup is characters like any other.
    const reply = ["## Three Days", "", "1. **Day One:** the `28` tram", "2. [Belem](https://b.example)"];
    expect(spoken(reply.join("\n"))).toBe("Three Days\nDay One: the 28 tram\nBelem");
  });

  it("keeps a quote and a code block, which are still things that were said", () => {
    expect(spoken("> Book ahead.\n\n```\nEUR 1.08\n```")).toBe("Book ahead.\nEUR 1.08");
  });

  it("says nothing at all for a reply that has not started", () => {
    expect(spoken("")).toBe("");
  });
});

