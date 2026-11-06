import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  Camera,
  Share2,
  FileCode,
  Download,
  Sparkles
} from 'lucide-react';
import { Devicon } from '../utils/devicon-svgs';

interface ShareCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  code: string;
  language: string;
}

export const ShareCodeModal: React.FC<ShareCodeModalProps> = ({
  isOpen,
  onClose,
  fileName,
  code,
  language
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [paddingSize, setPaddingSize] = useState<'compact' | 'normal' | 'relaxed'>('normal');
  const cardRef = useRef<HTMLDivElement>(null);

  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';

  const deviconName = useMemo(() => {
    switch (ext) {
      case 'tsx':
      case 'jsx':
        return 'react';
      case 'ts':
        return 'typescript';
      case 'js':
      case 'mjs':
      case 'cjs':
        return 'javascript';
      case 'py':
        return 'python';
      case 'rs':
        return 'rust';
      case 'go':
        return 'go';
      case 'c':
        return 'c';
      case 'cpp':
      case 'cc':
      case 'cxx':
        return 'cplusplus';
      case 'cs':
        return 'csharp';
      case 'java':
        return 'java';
      case 'php':
        return 'php';
      case 'rb':
        return 'ruby';
      case 'swift':
        return 'swift';
      case 'kt':
      case 'kts':
        return 'kotlin';
      case 'dart':
        return 'dart';
      case 'vue':
        return 'vuejs';
      case 'svelte':
        return 'svelte';
      case 'html':
      case 'htm':
        return 'html5';
      case 'css':
        return 'css3';
      case 'scss':
      case 'sass':
        return 'sass';
      case 'md':
      case 'mdx':
        return 'markdown';
      case 'sql':
        return 'postgresql';
      case 'json':
        return 'json';
      case 'yml':
      case 'yaml':
        return 'yaml';
      case 'graphql':
      case 'gql':
        return 'graphql';
      case 'sh':
      case 'bash':
      case 'zsh':
        return 'bash';
      case 'zig':
        return 'zig';
      case 'lua':
        return 'lua';
      case 'sqlite':
        return 'sqlite';
      default:
        return '';
    }
  }, [ext]);

  const lines = useMemo(() => {
    const rawLines = code.split('\n');
    // If the file is very large, share up to the first 60 lines
    return rawLines.slice(0, 60);
  }, [code]);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyAsImage = async () => {
    try {
      // Build an SVG containing foreignObject of the card
      const el = cardRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const canvas = document.createElement('canvas');
      const scale = 2; // retina 2x
      canvas.width = rect.width * scale;
      canvas.height = rect.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(scale, scale);

      // Render simplified background and code on canvas
      ctx.fillStyle = '#101113';
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Window Header
      ctx.fillStyle = '#16181C';
      ctx.beginPath();
      ctx.roundRect(16, 16, rect.width - 32, rect.height - 32, 12);
      ctx.fill();

      // Window controls dots
      ctx.fillStyle = '#ff5f56';
      ctx.beginPath();
      ctx.arc(36, 36, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffbd2e';
      ctx.beginPath();
      ctx.arc(52, 36, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#27c93f';
      ctx.beginPath();
      ctx.arc(68, 36, 5, 0, Math.PI * 2);
      ctx.fill();

      // Title
      ctx.fillStyle = '#ECEDEF';
      ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      ctx.fillText(fileName, 88, 40);

      // Code lines
      ctx.fillStyle = '#A4A8AF';
      ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      let startY = 70;
      const lineHeight = 18;

      lines.slice(0, 45).forEach((line, idx) => {
        if (showLineNumbers) {
          ctx.fillStyle = '#747982';
          ctx.fillText(String(idx + 1).padStart(3, ' '), 32, startY);
          ctx.fillStyle = '#ECEDEF';
          ctx.fillText(line, 68, startY);
        } else {
          ctx.fillStyle = '#ECEDEF';
          ctx.fillText(line, 36, startY);
        }
        startY += lineHeight;
      });

      canvas.toBlob(async (blob) => {
        if (blob && navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setCopiedImage(true);
          setTimeout(() => setCopiedImage(false), 2000);
        } else {
          handleCopyCode();
        }
      });
    } catch {
      handleCopyCode();
    }
  };

  const paddingClass =
    paddingSize === 'compact'
      ? 'p-4'
      : paddingSize === 'relaxed'
      ? 'p-10'
      : 'p-7';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none font-sans animate-in fade-in duration-150">
      <div className="w-[720px] max-w-[95vw] max-h-[90vh] flex flex-col bg-[#141619] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="h-12 px-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-[#ECEDEF]">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-[#ECEDEF] tracking-tight">Share Code Snippet</h3>
              <p className="text-[10px] text-[#747982]">Export or copy code with authentic language branding</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Line numbers */}
            <button
              onClick={() => setShowLineNumbers(!showLineNumbers)}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                showLineNumbers
                  ? 'bg-white/[0.08] text-[#ECEDEF]'
                  : 'text-[#747982] hover:text-[#ECEDEF]'
              }`}
            >
              123
            </button>

            {/* Close modal */}
            <button
              onClick={onClose}
              className="p-1 rounded-md text-[#747982] hover:text-[#ECEDEF] hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Preview Area with subtle gradient backdrop */}
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-[#101113]">
          <div
            ref={cardRef}
            className={`${paddingClass} rounded-2xl bg-gradient-to-br from-white/[0.04] to-transparent w-full max-w-2xl transition-all duration-200`}
          >
            {/* Raycast-style Window Card */}
            <div className="bg-[#141619] rounded-xl border border-white/[0.08] shadow-2xl overflow-hidden">
              {/* Card Window Top Header */}
              <div className="h-9 px-3.5 bg-white/[0.02] border-b border-white/[0.06] flex items-center justify-between">
                {/* Window Dots */}
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                </div>

                {/* File Title */}
                <div className="text-[11px] font-mono text-[#A4A8AF] truncate px-2">
                  {fileName}
                </div>

                {/* AUTHENTIC DEVICON LANGUAGE LOGO IN SYMBOL POSITION */}
                <div className="flex items-center gap-1.5 flex-shrink-0" title={`Language: ${language}`}>
                  {deviconName ? (
                    <Devicon name={deviconName} className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <FileCode className="w-4 h-4 text-[#A4A8AF] flex-shrink-0" />
                  )}
                  <span className="text-[10px] font-mono font-medium text-[#ECEDEF]">
                    {language}
                  </span>
                </div>
              </div>

              {/* Code Content */}
              <div className="p-4 font-mono text-xs leading-relaxed text-[#ECEDEF] overflow-x-auto max-h-[380px]">
                <div className="flex min-w-full">
                  {showLineNumbers && (
                    <div className="pr-4 select-none text-right font-mono text-[11px] text-[#747982]/60 select-none">
                      {lines.map((_, idx) => (
                        <div key={idx}>{idx + 1}</div>
                      ))}
                    </div>
                  )}
                    <pre className="whitespace-pre font-mono text-xs text-[#ECEDEF] flex-1">
                      {lines.join('\n')}
                    </pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="h-12 px-4 border-t border-white/[0.06] bg-[#141619] flex items-center justify-between flex-shrink-0 text-xs">
          <div className="flex items-center gap-2 text-[11px] text-[#747982]">
            <span>{lines.length} lines</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              {deviconName && <Devicon name={deviconName} className="w-3.5 h-3.5" />}
              <span>{language} (Official Devicon)</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-[#ECEDEF] flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied Snippet' : 'Copy Code'}</span>
            </button>

            <button
              onClick={handleCopyAsImage}
              className="px-3.5 py-1.5 rounded-lg bg-[#ECEDEF] text-[#101113] hover:bg-white flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer shadow-sm"
            >
              {copiedImage ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Camera className="w-3.5 h-3.5" />}
              <span>{copiedImage ? 'Image Copied to Clipboard!' : 'Copy PNG Image'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareCodeModal;
