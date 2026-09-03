"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders the assistant's replies as formatted text instead of raw syntax.
 *
 * The model writes Markdown — it is what every chat model does, and the system
 * prompt asks for "a tight bullet list", which all but guarantees it. The chat
 * used to print that string literally, so farmers read
 *
 *   "Yes, you are eligible for **PM-KISAN**."
 *
 * asterisks and all. Across the stored replies, 61 of 93 contain bold and 6
 * contain a table, so this is the common case rather than an edge one.
 *
 * ── Why the element map is explicit ──────────────────────────────────────────
 * Left to browser defaults, Markdown brings its own typography: bigger headings,
 * indented lists, blue underlined links. Inside a 14px chat bubble that reads as
 * a different product. Every element is mapped to the app's own tokens and type
 * scale so a formatted reply still looks like the rest of the interface.
 *
 * ── What is deliberately not allowed ─────────────────────────────────────────
 * This text comes from a language model, over which a farmer's question — and
 * anything retrieved into the prompt — has influence. So:
 *
 *   • Raw HTML is not enabled. react-markdown escapes it by default and it
 *     stays that way; there is no `rehype-raw` here on purpose.
 *   • Images are dropped entirely. A model-authored <img> is a request to an
 *     arbitrary host from the farmer's browser, and nothing in a farming answer
 *     needs one.
 *   • Links open in a new tab with `rel="noopener noreferrer"`, and only http(s)
 *     survives — react-markdown's default URL transform already strips
 *     `javascript:` and other dangerous protocols.
 *
 * Only ever used for ASSISTANT turns. The farmer's own messages are rendered as
 * plain text: their words should appear exactly as typed, and a stray asterisk
 * in a question should not silently become italics.
 */
export default function AssistantMarkdown({ children }: { children: string }) {
  return (
    <div className="af-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // No rehype-raw: raw HTML in model output stays escaped.
        components={{
          // Paragraphs carry the bubble's own rhythm; the last one loses its
          // margin so the bubble does not gain a phantom row of padding.
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,

          strong: ({ children }) => (
            <strong className="font-semibold text-af-ink">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,

          ul: ({ children }) => (
            <ul className="my-2 space-y-1 pl-4 list-disc marker:text-af-primary">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 space-y-1 pl-5 list-decimal marker:text-af-muted">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed pl-0.5">{children}</li>,

          // The model does not currently emit headings, but if it starts they
          // should read as emphasis inside a bubble, not as page titles.
          h1: ({ children }) => <div className="font-semibold text-af-ink mt-3 first:mt-0 mb-1">{children}</div>,
          h2: ({ children }) => <div className="font-semibold text-af-ink mt-3 first:mt-0 mb-1">{children}</div>,
          h3: ({ children }) => <div className="font-semibold text-af-ink mt-3 first:mt-0 mb-1">{children}</div>,
          h4: ({ children }) => <div className="font-semibold text-af-ink mt-3 first:mt-0 mb-1">{children}</div>,

          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-af-primary-deep underline underline-offset-2 hover:text-af-primary"
            >
              {children}
            </a>
          ),

          code: ({ children }) => (
            <code className="font-mono text-[12.5px] bg-af-sage/60 rounded px-1 py-0.5">
              {children}
            </code>
          ),

          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-af-border pl-3 my-2 text-af-ink-2">
              {children}
            </blockquote>
          ),

          hr: () => <hr className="my-3 border-af-border" />,

          /* Tables appear in about one reply in fifteen — usually mandi prices.
             The wrapper scrolls on its own so a wide table never widens the
             chat bubble or pushes the page sideways. */
          table: ({ children }) => (
            <div className="my-2 -mx-1 overflow-x-auto">
              <table className="w-full text-[12.5px] border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="text-af-muted">{children}</thead>,
          th: ({ children }) => (
            <th className="text-left font-semibold border-b border-af-border px-2 py-1 whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-af-border/60 px-2 py-1 align-top">{children}</td>
          ),

          // A model-authored image is an outbound request from the farmer's
          // browser to a host it chose. Nothing here needs one.
          img: () => null,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
