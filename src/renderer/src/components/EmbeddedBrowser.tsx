import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Search,
  ExternalLink,
  ShieldCheck,
  Globe
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';

interface EmbeddedBrowserProps {
  url?: string;
  tabId?: string;
}

export const EmbeddedBrowser: React.FC<EmbeddedBrowserProps> = ({
  url: initialUrl = 'https://www.google.com',
  tabId
}) => {
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [key, setKey] = useState(0); // Used to reload iframe
  const { openTabs } = useWorkspaceStore();

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    let target = inputUrl.trim();
    if (!target) return;

    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      if (target.includes('.') && !target.includes(' ')) {
        target = `https://${target}`;
      } else {
        target = `https://www.google.com/search?q=${encodeURIComponent(target)}`;
      }
    }
    setCurrentUrl(target);
    setInputUrl(target);

    // Update tab title if this tab is open
    if (tabId) {
      const isGoogle = target.includes('google');
      const domain = isGoogle ? 'Google' : target.replace(/^https?:\/\//, '').split('/')[0];
      useWorkspaceStore.setState({
        openTabs: openTabs.map((t) => (t.id === tabId ? { ...t, title: domain, url: target } : t))
      });
    }
  };

  const handleOpenExternal = () => {
    window.open(currentUrl, '_blank');
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#0f1115] select-none font-sans overflow-hidden">
      {/* 1. Browser Navigation Chrome Header */}
      <div className="h-10 px-3 bg-[#13151b] border-b border-white/[0.08] flex items-center gap-2 flex-shrink-0 z-20">
        {/* Navigation Buttons */}
        <div className="flex items-center gap-1 text-[#A4A8AF]">
          <button
            onClick={() => setKey((k) => k + 1)}
            className="p-1.5 rounded-md hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            title="Reload Page"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Address & Search Bar */}
        <form onSubmit={handleNavigate} className="flex-1 max-w-2xl flex items-center">
          <div className="w-full flex items-center gap-2 bg-[#1a1d24] border border-white/[0.08] focus-within:border-white/30 rounded-lg px-3 py-1 text-xs transition-colors">
            <Search className="w-3.5 h-3.5 text-[#747982] flex-shrink-0" />
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Search Google or enter URL (e.g. google.com)"
              className="w-full bg-transparent border-none outline-none text-[#ECEDEF] text-xs font-mono placeholder:text-[#555A64]"
              spellCheck={false}
            />
            {currentUrl.startsWith('https://') && (
              <span title="Encrypted Connection (HTTPS)">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              </span>
            )}
          </div>
        </form>

        {/* External Browser Action */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={handleOpenExternal}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-[#A4A8AF] hover:text-white hover:bg-white/[0.08] border border-white/[0.06] transition-colors cursor-pointer"
            title="Open in System Browser"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Open in Browser</span>
          </button>
        </div>
      </div>

      {/* 2. Embedded Web Canvas / Iframe */}
      <div className="flex-1 w-full h-full relative bg-white">
        <iframe
          key={key}
          src={currentUrl}
          title="Embedded Browser"
          className="w-full h-full border-none"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
        />
      </div>
    </div>
  );
};

export default EmbeddedBrowser;
