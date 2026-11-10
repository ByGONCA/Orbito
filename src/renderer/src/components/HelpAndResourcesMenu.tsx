import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  HelpCircle,
  Keyboard,
  MessageSquare,
  Compass,
  BookOpen,
  Scroll,
  ExternalLink,
  RotateCw,
  RefreshCw,
  X,
  Sparkles,
  CheckCircle2,
  Send,
  Terminal,
  Cpu,
  Shield,
  Layers,
  ChevronRight,
  Blocks
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';

// Brand SVGs
const GithubIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

const DiscordIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const XIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export const HelpAndResourcesMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateStatusMessage, setUpdateStatusMessage] = useState<string | null>(null);
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const { toggleSettings, setSettingsActiveTab } = useWorkspaceStore();

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleOpenShortcuts = () => {
    setIsOpen(false);
    setSettingsActiveTab('shortcuts');
    toggleSettings(true);
  };

  const handleCheckUpdates = () => {
    setIsCheckingUpdates(true);
    setUpdateStatusMessage('Checking for updates...');
    setTimeout(() => {
      setIsCheckingUpdates(false);
      setUpdateStatusMessage('Orbito is up to date (v0.1.0)');
      setTimeout(() => setUpdateStatusMessage(null), 3000);
    }, 1200);
  };

  const handleRestart = () => {
    setIsOpen(false);
    window.location.reload();
  };

  const handleOpenExternal = (url: string) => {
    setIsOpen(false);
    window.open(url, '_blank');
  };

  // Calculate popover coordinates from button
  const getPopoverPosition = () => {
    if (!buttonRef.current) return { bottom: 44, left: 12 };
    const rect = buttonRef.current.getBoundingClientRect();
    return {
      bottom: window.innerHeight - rect.top + 8,
      left: Math.max(8, rect.left)
    };
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`p-1.5 rounded-md transition-colors cursor-pointer ${
          isOpen
            ? 'bg-white/[0.12] text-white'
            : 'text-[#747982] hover:text-[#ECEDEF] hover:bg-white/[0.06]'
        }`}
        title="Help & Resources"
        aria-label="Help & Resources"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {/* Popover Menu Portal */}
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              bottom: `${getPopoverPosition().bottom}px`,
              left: `${getPopoverPosition().left}px`
            }}
            className="w-56 bg-[#16171A] border border-white/[0.12] rounded-xl shadow-2xl p-1.5 text-xs text-[#ECEDEF] z-[9999] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 select-none"
          >
            {/* 1. Main Tools */}
            <div className="space-y-0.5">
              <button
                onClick={handleOpenShortcuts}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <Keyboard className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white" />
                  <span>Keyboard Shortcuts</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  useWorkspaceStore.getState().openPluginsTab();
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <Blocks className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-300" />
                  <span>Plugins & Ecosystem</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded font-mono">
                  New
                </span>
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsFeedbackOpen(true);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white" />
                  <span>Send Feedback</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsOnboardingOpen(true);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <Compass className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white" />
                  <span>Onboarding</span>
                </div>
              </button>

              <button
                onClick={() => handleOpenExternal('https://github.com/goncalombrito/Orbito')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white" />
                  <span>Docs</span>
                </div>
                <ExternalLink className="w-3 h-3 text-neutral-500 group-hover:text-neutral-300" />
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsWhatsNewOpen(true);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <Scroll className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white" />
                  <span>Changelog & Updates</span>
                </div>
                <span className="text-[9px] px-1 py-0.2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded font-mono">
                  v0.1.0
                </span>
              </button>
            </div>

            {/* Divider */}
            <div className="my-1 border-t border-white/[0.08]" />

            {/* 2. Community Links */}
            <div className="space-y-0.5">
              <button
                onClick={() => handleOpenExternal('https://github.com/goncalombrito/Orbito')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <GithubIcon className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white" />
                  <span>GitHub</span>
                </div>
                <ExternalLink className="w-3 h-3 text-neutral-500 group-hover:text-neutral-300" />
              </button>

              <button
                onClick={() => handleOpenExternal('https://discord.gg')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <DiscordIcon className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white" />
                  <span>Discord</span>
                </div>
                <ExternalLink className="w-3 h-3 text-neutral-500 group-hover:text-neutral-300" />
              </button>

              <button
                onClick={() => handleOpenExternal('https://x.com')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <XIcon className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white" />
                  <span>X</span>
                </div>
                <ExternalLink className="w-3 h-3 text-neutral-500 group-hover:text-neutral-300" />
              </button>
            </div>

            {/* Divider */}
            <div className="my-1 border-t border-white/[0.08]" />

            {/* 3. App Actions */}
            <div className="space-y-0.5">
              <button
                onClick={handleCheckUpdates}
                disabled={isCheckingUpdates}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <RotateCw
                    className={`w-3.5 h-3.5 text-neutral-400 group-hover:text-white ${
                      isCheckingUpdates ? 'animate-spin text-blue-400' : ''
                    }`}
                  />
                  <span>Check for Updates</span>
                </div>
              </button>

              <button
                onClick={handleRestart}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <RefreshCw className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white" />
                  <span>Restart Orbito</span>
                </div>
              </button>
            </div>

            {/* Toast / Status Message */}
            {updateStatusMessage && (
              <div className="mt-1 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[11px] text-blue-300 text-center animate-in fade-in">
                {updateStatusMessage}
              </div>
            )}
          </div>,
          document.body
        )}

      {/* Notion-Styled Changelog & Updates Modal */}
      <WhatsNewModal isOpen={isWhatsNewOpen} onClose={() => setIsWhatsNewOpen(false)} />

      {/* Send Feedback Modal */}
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />

      {/* Onboarding Quick Tour Modal */}
      <OnboardingModal isOpen={isOnboardingOpen} onClose={() => setIsOnboardingOpen(false)} />
    </>
  );
};

// ==========================================
// 1. Notion-Styled "What's New & Updates" Modal
// ==========================================
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsNewModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  const [checking, setChecking] = useState(false);
  const [checkedMessage, setCheckedMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCheck = () => {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      setCheckedMessage('You are on the latest version of Orbito (v0.1.0).');
      setTimeout(() => setCheckedMessage(null), 3500);
    }, 1000);
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-[#141517] border border-white/[0.12] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-200">
        {/* Notion Cover Header */}
        <div className="relative h-28 bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-purple-900/30 border-b border-white/[0.08] px-6 flex items-end pb-3">
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#1C1D21] border border-white/[0.15] shadow-lg flex items-center justify-center text-2xl select-none -mb-6 z-10">
              🚀
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight">What's New in Orbito</h2>
              <p className="text-xs text-neutral-400">Latest updates, features and improvements</p>
            </div>
          </div>
        </div>

        {/* Notion Document Content */}
        <div className="flex-1 overflow-y-auto p-6 pt-8 space-y-6 text-xs leading-relaxed select-text">
          {/* Notion Properties Block */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-[11px] font-mono">
            <div>
              <span className="text-neutral-500 block text-[10px]">Release</span>
              <span className="text-white font-medium">v0.1.0 (GA)</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px]">Status</span>
              <span className="text-emerald-400 font-medium">● Up to date</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px]">Build</span>
              <span className="text-neutral-300">Production</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px]">Architecture</span>
              <span className="text-neutral-300">Multi-Agent</span>
            </div>
          </div>

          {/* Notion Callout Box */}
          <div className="p-3.5 bg-blue-500/[0.06] border border-blue-500/20 rounded-xl flex items-start gap-3 text-neutral-300">
            <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Orbito Next-Gen Workspace</span>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Engineered for simultaneous AI agent execution, seamless git worktree isolation, and zero-distraction coding.
              </p>
            </div>
          </div>

          {/* Release Highlights */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-accent" />
              <span>Release Highlights</span>
            </h3>

            {/* Feature 1 */}
            <div className="p-3.5 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-1.5 hover:border-white/[0.12] transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white flex items-center gap-2 text-[13px]">
                  🎨 Real-Time Dual-Layer Syntax Editor
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 font-mono">
                  New
                </span>
              </div>
              <p className="text-neutral-400">
                Direct in-canvas typing with continuous syntax highlighting and character-aligned VS Code indentation guides. No black-and-white mode switches, no layout shifts, and instant Tab/Shift+Tab indentation.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-3.5 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-1.5 hover:border-white/[0.12] transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white flex items-center gap-2 text-[13px]">
                  🤖 Multi-Agent AI Terminals & Workspaces
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-300 border border-blue-500/25 font-mono">
                  Core
                </span>
              </div>
              <p className="text-neutral-400">
                Run parallel agent workflows (Claude, Gemini, OpenAI, Ollama) across project worktrees. Real-time background output streaming, official model badges, and independent session lifecycles.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-3.5 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-1.5 hover:border-white/[0.12] transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white flex items-center gap-2 text-[13px]">
                  🌿 Git Worktree Isolation & Instant Switching
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-300 border border-purple-500/25 font-mono">
                  Enhanced
                </span>
              </div>
              <p className="text-neutral-400">
                Create, customize, and switch worktrees without branch collisions or uncommitted change stashes. Includes custom tag colors, provider defaults, and centered customization dialogs.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-3.5 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-1.5 hover:border-white/[0.12] transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white flex items-center gap-2 text-[13px]">
                  💬 Discord Rich Presence Integration
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-500/20 text-neutral-300 border border-neutral-500/30 font-mono">
                  Integration
                </span>
              </div>
              <p className="text-neutral-400">
                Real-time IDE activity broadcast over local named pipes. Displays active project, branch, and status badges with zero leak of code or credentials.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 px-6 border-t border-white/[0.08] bg-[#111214] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCheck}
              disabled={checking}
              className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-neutral-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin text-blue-400' : ''}`} />
              <span>{checking ? 'Checking...' : 'Check for Updates'}</span>
            </button>
            {checkedMessage && (
              <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {checkedMessage}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white text-black font-medium hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ==========================================
// 2. Send Feedback Modal
// ==========================================
export const FeedbackModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'general'>('feature');
  const [message, setMessage] = useState('');
  const [isSent, setIsSent] = useState(false);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setIsSent(true);
    setTimeout(() => {
      setIsSent(false);
      setMessage('');
      onClose();
    }, 1500);
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-[#16171A] border border-white/[0.12] rounded-2xl shadow-2xl p-5 text-neutral-200 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-white">Send Feedback to Orbito</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {isSent ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h4 className="text-sm font-medium text-white">Thank You!</h4>
            <p className="text-xs text-neutral-400">Your feedback helps shape the future of Orbito.</p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-3.5 text-xs">
            {/* Category selection */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFeedbackType('feature')}
                className={`flex-1 py-1.5 px-2 rounded-lg border text-center transition-colors ${
                  feedbackType === 'feature'
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                    : 'bg-white/[0.03] border-white/[0.08] text-neutral-400 hover:text-white'
                }`}
              >
                Feature Idea
              </button>
              <button
                type="button"
                onClick={() => setFeedbackType('bug')}
                className={`flex-1 py-1.5 px-2 rounded-lg border text-center transition-colors ${
                  feedbackType === 'bug'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-white/[0.03] border-white/[0.08] text-neutral-400 hover:text-white'
                }`}
              >
                Bug Report
              </button>
              <button
                type="button"
                onClick={() => setFeedbackType('general')}
                className={`flex-1 py-1.5 px-2 rounded-lg border text-center transition-colors ${
                  feedbackType === 'general'
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                    : 'bg-white/[0.03] border-white/[0.08] text-neutral-400 hover:text-white'
                }`}
              >
                General
              </button>
            </div>

            {/* Textarea */}
            <div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Share your thoughts, suggestions, or issues..."
                rows={4}
                className="w-full bg-[#111214] border border-white/[0.10] rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500/50 resize-none"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!message.trim()}
                className="px-4 py-1.5 rounded-lg bg-white text-black font-medium hover:bg-neutral-200 transition-colors disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>Send</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};

// ==========================================
// 3. Onboarding Quick Tour Modal
// ==========================================
export const OnboardingModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: 'Git Worktrees & Branch Isolation',
      desc: 'Create branches as isolated worktrees with their own file directory. Never stash or lose context when switching tasks.',
      icon: '🌿',
      badge: 'Step 1 of 3'
    },
    {
      title: 'Multi-Agent Background Terminals',
      desc: 'Spawn dedicated AI terminals (Claude, Gemini, Ollama) scoped directly to any active worktree.',
      icon: '🤖',
      badge: 'Step 2 of 3'
    },
    {
      title: 'Live Dual-Layer Code Editor',
      desc: 'Syntax highlighting and VS Code indentation guides active at all times while writing code with zero layout shift.',
      icon: '🎨',
      badge: 'Step 3 of 3'
    }
  ];

  const current = steps[step];

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-[#16171A] border border-white/[0.12] rounded-2xl shadow-2xl p-6 text-neutral-200 flex flex-col space-y-5 text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08]"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.10] flex items-center justify-center text-3xl mx-auto shadow-inner">
          {current.icon}
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
            {current.badge}
          </span>
          <h3 className="text-base font-semibold text-white tracking-tight">{current.title}</h3>
          <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">{current.desc}</p>
        </div>

        {/* Carousel indicators */}
        <div className="flex justify-center gap-1.5 py-1">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === step ? 'w-6 bg-white' : 'w-1.5 bg-white/20'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Previous
            </button>
          ) : (
            <div />
          )}

          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="px-4 py-1.5 rounded-lg bg-white text-black text-xs font-medium hover:bg-neutral-200 transition-colors flex items-center gap-1 ml-auto"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-white text-black text-xs font-medium hover:bg-neutral-200 transition-colors ml-auto"
            >
              Get Started
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
