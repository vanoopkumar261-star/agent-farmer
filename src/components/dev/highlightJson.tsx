import React from "react";

/**
 * Tokenizes a JSON string and wraps keys/strings/numbers/booleans/punctuation
 * in colored spans, terminal-syntax-highlight style. Avoids pulling in a full
 * syntax highlighter dependency for one JSON block.
 */
export function highlightJson(json: string): React.ReactNode[] {
  const tokenRegex =
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d+)?([eE][+-]?\d+)?|[{}[\],:])/g;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokenRegex.exec(json)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(json.slice(lastIndex, match.index));
    }

    const token = match[0];
    let className = "text-hud-text-dim";

    if (/^"/.test(token)) {
      className = /:$/.test(token) ? "text-hud-blue" : "text-hud-green";
    } else if (/^(true|false)$/.test(token)) {
      className = "text-hud-amber";
    } else if (/^null$/.test(token)) {
      className = "text-hud-red";
    } else if (/^-?\d/.test(token)) {
      className = "text-hud-amber";
    } else if (/^[{}[\],:]$/.test(token)) {
      className = "text-hud-text-faint";
    }

    nodes.push(
      <span key={key++} className={className}>
        {token}
      </span>
    );

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < json.length) {
    nodes.push(json.slice(lastIndex));
  }

  return nodes;
}
