import React, { useState } from 'react';
import {
  Copy,
  Check,
  FileText,
  ExternalLink,
  CheckSquare,
  Square,
  ChevronRight
} from 'lucide-react';

interface MarkdownPreviewProps {
  content: string;
  filePath?: string;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, filePath }) => {
  const [copiedBlockIdx, setCopiedBlockIdx] = useState<number | null>(null);

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedBlockIdx(idx);
    setTimeout(() => setCopiedBlockIdx(null), 2000);
  };

  // Render markdown lines into Notion-styled elements
  const renderNotionBlocks = () => {
    const rawLines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;
    let blockCounter = 0;

    while (i < rawLines.length) {
      const line = rawLines[i];
      const trimmed = line.trim();

      // Empty line -> Notion spacing
      if (!trimmed) {
        elements.push(<div key={`spacer-${i}`} className="h-3" />);
        i++;
        continue;
      }

      // Code block (```lang ... ```)
      if (trimmed.startsWith('```')) {
        const lang = trimmed.slice(3).trim() || 'text';
        const codeLines: string[] = [];
        i++;
        while (i < rawLines.length && !rawLines[i].trim().startsWith('```')) {
          codeLines.push(rawLines[i]);
          i++;
        }
        i++; // skip closing ```
        const codeText = codeLines.join('\n');
        const currentIdx = blockCounter++;

        elements.push(
          <div
            key={`code-${currentIdx}`}
            className="my-3 rounded-lg border border-white/[0.08] bg-[#141519] overflow-hidden group/code shadow-xs"
          >
            <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.05] text-[11px] font-mono text-neutral-400">
              <span className="uppercase text-[10px] font-semibold tracking-wider text-neutral-400">
                {lang}
              </span>
              <button
                onClick={() => handleCopyCode(codeText, currentIdx)}
                className="p-1 rounded hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
                title={copiedBlockIdx === currentIdx ? 'Copied' : 'Copy code'}
                aria-label="Copy code"
              >
                {copiedBlockIdx === currentIdx ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <pre className="p-3.5 text-xs font-mono text-neutral-200 overflow-x-auto leading-relaxed whitespace-pre select-text">
              <code>{codeText}</code>
            </pre>
          </div>
        );
        continue;
      }

      // Headings (H1, H2, H3, H4)
      if (line.startsWith('# ')) {
        elements.push(
          <h1
            key={`h1-${i}`}
            className="text-2xl font-bold tracking-tight text-white mt-6 mb-3 pb-1.5 border-b border-white/[0.08] font-sans flex items-center gap-2"
          >
            {renderInline(line.slice(2))}
          </h1>
        );
        i++;
        continue;
      }

      if (line.startsWith('## ')) {
        elements.push(
          <h2
            key={`h2-${i}`}
            className="text-xl font-semibold tracking-tight text-white mt-5 mb-2 font-sans flex items-center gap-1.5"
          >
            {renderInline(line.slice(3))}
          </h2>
        );
        i++;
        continue;
      }

      if (line.startsWith('### ')) {
        elements.push(
          <h3
            key={`h3-${i}`}
            className="text-base font-semibold text-neutral-100 mt-4 mb-1.5 font-sans"
          >
            {renderInline(line.slice(4))}
          </h3>
        );
        i++;
        continue;
      }

      if (line.startsWith('#### ')) {
        elements.push(
          <h4
            key={`h4-${i}`}
            className="text-sm font-semibold text-neutral-200 mt-3 mb-1 font-sans"
          >
            {renderInline(line.slice(5))}
          </h4>
        );
        i++;
        continue;
      }

      // Blockquotes / Notion Callouts (> quote)
      if (line.startsWith('> ')) {
        const quoteLines: string[] = [line.slice(2)];
        i++;
        while (i < rawLines.length && rawLines[i].startsWith('> ')) {
          quoteLines.push(rawLines[i].slice(2));
          i++;
        }
        elements.push(
          <div
            key={`quote-${i}`}
            className="my-3 pl-3.5 pr-3 py-2.5 rounded-r-lg border-l-2 border-accent bg-accent/5 text-neutral-200 text-sm leading-relaxed"
          >
            {quoteLines.map((ql, qIdx) => (
              <p key={qIdx} className="my-0.5">
                {renderInline(ql)}
              </p>
            ))}
          </div>
        );
        continue;
      }

      // Horizontal Divider (--- or ***)
      if (/^(\*\*\*|---|___)$/.test(trimmed)) {
        elements.push(<hr key={`hr-${i}`} className="my-6 border-white/[0.08]" />);
        i++;
        continue;
      }

      // Task List / Checklist (- [ ] or - [x])
      if (/^[-*]\s+\[([ xX])\]\s+/.test(line)) {
        const match = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
        if (match) {
          const isChecked = match[1].toLowerCase() === 'x';
          const taskText = match[2];
          elements.push(
            <div key={`task-${i}`} className="flex items-start gap-2.5 my-1.5 text-sm group">
              <span className="mt-0.5 text-neutral-400">
                {isChecked ? (
                  <CheckSquare className="w-4 h-4 text-accent flex-shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                )}
              </span>
              <span
                className={`leading-normal ${
                  isChecked ? 'line-through text-neutral-500' : 'text-neutral-200'
                }`}
              >
                {renderInline(taskText)}
              </span>
            </div>
          );
          i++;
          continue;
        }
      }

      // Unordered List (- or *)
      if (/^[-*]\s+/.test(line)) {
        const listItems: string[] = [line.replace(/^[-*]\s+/, '')];
        i++;
        while (i < rawLines.length && /^[-*]\s+/.test(rawLines[i])) {
          listItems.push(rawLines[i].replace(/^[-*]\s+/, ''));
          i++;
        }
        elements.push(
          <ul key={`ul-${i}`} className="my-2 space-y-1.5 pl-5 text-sm text-neutral-300 list-disc">
            {listItems.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {renderInline(item)}
              </li>
            ))}
          </ul>
        );
        continue;
      }

      // Ordered List (1. 2. 3.)
      if (/^\d+\.\s+/.test(line)) {
        const listItems: string[] = [line.replace(/^\d+\.\s+/, '')];
        i++;
        while (i < rawLines.length && /^\d+\.\s+/.test(rawLines[i])) {
          listItems.push(rawLines[i].replace(/^\d+\.\s+/, ''));
          i++;
        }
        elements.push(
          <ol key={`ol-${i}`} className="my-2 space-y-1.5 pl-5 text-sm text-neutral-300 list-decimal">
            {listItems.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {renderInline(item)}
              </li>
            ))}
          </ol>
        );
        continue;
      }

      // Table detection (| col1 | col2 |)
      if (line.startsWith('|') && line.endsWith('|')) {
        const tableLines: string[] = [line];
        i++;
        while (i < rawLines.length && rawLines[i].startsWith('|') && rawLines[i].endsWith('|')) {
          tableLines.push(rawLines[i]);
          i++;
        }

        const parseCells = (row: string) =>
          row
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim());

        const headers = parseCells(tableLines[0]);
        const isDivider = tableLines[1] && tableLines[1].includes('---');
        const bodyRows = tableLines.slice(isDivider ? 2 : 1).map(parseCells);

        elements.push(
          <div key={`table-${i}`} className="my-3 overflow-x-auto rounded-lg border border-white/[0.08]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/[0.08]">
                  {headers.map((h, hIdx) => (
                    <th key={hIdx} className="px-3 py-2 font-semibold text-white">
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-white/[0.02] transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3 py-2 text-neutral-300">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      // Standard Paragraph
      elements.push(
        <p key={`p-${i}`} className="text-sm leading-relaxed text-neutral-300 my-1.5 font-sans">
          {renderInline(line)}
        </p>
      );
      i++;
    }

    return elements;
  };

  // Inline formatting parser (bold, italic, inline code, links)
  const renderInline = (text: string): React.ReactNode => {
    // Regex splits by: **bold**, *italic*, `code`, [link](url)
    const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g;
    const parts = text.split(regex);

    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <em key={idx} className="italic text-neutral-200">
            {part.slice(1, -1)}
          </em>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded bg-white/[0.08] font-mono text-[11px] text-amber-200 border border-white/[0.06]"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
        const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
        if (linkMatch) {
          return (
            <a
              key={idx}
              href={linkMatch[2]}
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 hover:text-sky-300 underline underline-offset-2 transition-colors inline-flex items-center gap-0.5"
            >
              <span>{linkMatch[1]}</span>
              <ExternalLink className="w-2.5 h-2.5 inline" />
            </a>
          );
        }
      }
      return part;
    });
  };

  return (
    <div className="h-full overflow-y-auto p-6 md:p-10 select-text bg-[#0F1014] text-neutral-200 font-sans">
      <div className="max-w-3xl mx-auto space-y-1">
        {/* Document Header */}
        {filePath && (
          <div className="pb-4 mb-4 border-b border-white/[0.06] flex items-center justify-between text-xs text-neutral-400">
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              <FileText className="w-3.5 h-3.5 text-accent" />
              <span>{filePath.split(/[/\\]/).pop()}</span>
            </span>
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-500">
              Notion View
            </span>
          </div>
        )}

        {/* Rendered Notion Blocks */}
        {renderNotionBlocks()}
      </div>
    </div>
  );
};

export default MarkdownPreview;
