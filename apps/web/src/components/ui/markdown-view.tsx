"use client";

/**
 * Minimal markdown renderer for deal briefs and similar content.
 * Renders ## headings, ### headings, bullet lists, and paragraphs.
 * No raw HTML to avoid XSS.
 */
export function MarkdownView({ content }: { content: string }) {
  if (!content.trim()) return null;

  const lines = content.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={key++} className="mt-4 mb-2 text-base font-semibold text-gray-900 first:mt-0">
          {trimmed.slice(3)}
        </h2>,
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={key++} className="mt-3 mb-1.5 text-sm font-semibold text-gray-800">
          {trimmed.slice(4)}
        </h3>,
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const listItems: string[] = [];
      while (i < lines.length) {
        const l = lines[i].trim();
        if (l.startsWith("- ") || l.startsWith("* ")) {
          listItems.push(l.slice(2));
          i++;
        } else if (l === "") {
          i++;
        } else {
          break;
        }
      }
      elements.push(
        <ul key={key++} className="list-disc list-inside space-y-0.5 text-sm text-gray-700">
          {listItems.map((item, j) => (
            <li key={j}>{item}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length) {
        const l = lines[i].trim();
        if (/^\d+\.\s/.test(l)) {
          listItems.push(l.replace(/^\d+\.\s*/, ""));
          i++;
        } else if (l === "") {
          i++;
        } else {
          break;
        }
      }
      elements.push(
        <ol key={key++} className="list-decimal list-inside space-y-0.5 text-sm text-gray-700">
          {listItems.map((item, j) => (
            <li key={j}>{item}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (trimmed === "") {
      i++;
      continue;
    }

    elements.push(
      <p key={key++} className="text-sm text-gray-700 leading-relaxed">
        {trimmed}
      </p>,
    );
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
}
