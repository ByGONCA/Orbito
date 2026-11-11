import React, { useState } from 'react';
import {
  ChevronDown,
  Plus,
  MoreVertical,
  Check,
  Globe,
  ExternalLink
} from 'lucide-react';
import { useBrowserSettingsStore } from '../../../stores/browser-settings.store';
import { useWorkspaceStore } from '../../../stores/workspace.store';

interface BrowserPageProps {
  onCloseSettings?: () => void;
}

export const BrowserPage: React.FC<BrowserPageProps> = ({ onCloseSettings }) => {
  const {
    agentBrowserAccess,
    setAgentBrowserAccess,
    profiles,
    addProfile,
    removeProfile,
    openLinksIn,
    setOpenLinksIn,
    autoShowFloatingPreview,
    setAutoShowFloatingPreview,
    searchEngine,
    setSearchEngine,
    recordingFrameRate,
    setRecordingFrameRate,
    showKeyPressesInRecordings,
    setShowKeyPresses,
    showMousePressesInRecordings,
    setShowMousePresses
  } = useBrowserSettingsStore();

  const { openBrowserTab } = useWorkspaceStore();

  const [isOpenLinksDropdownOpen, setIsOpenLinksDropdownOpen] = useState(false);
  const [isSearchEngineDropdownOpen, setIsSearchEngineDropdownOpen] = useState(false);
  const [isFpsDropdownOpen, setIsFpsDropdownOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

  const searchEngineLabels: Record<string, string> = {
    duckduckgo: 'DuckDuckGo',
    google: 'Google',
    bing: 'Bing'
  };

  const handleCreateProfile = () => {
    if (!newProfileName.trim()) return;
    addProfile(newProfileName.trim());
    setNewProfileName('');
    setIsAddingProfile(false);
  };

  const handleLaunchBrowserNow = () => {
    onCloseSettings?.();
    openBrowserTab('https://www.google.com');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150 text-[#ECEDEF] font-sans pb-12">
      {/* Scope row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-[#8A8F98]">
          <span>Applying settings for</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.08] text-[#ECEDEF] font-medium transition-colors"
          >
            <span>All projects</span>
            <ChevronDown className="w-3 h-3 text-[#747982]" />
          </button>
          <span>across</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.08] text-[#ECEDEF] font-medium transition-colors"
          >
            <span>All environments</span>
            <ChevronDown className="w-3 h-3 text-[#747982]" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleLaunchBrowserNow}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Launch Browser</span>
        </button>
      </div>

      {/* SECTION 1: Agent access */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Agent access</h3>

        <div className="rounded-xl bg-[#111216]/90 border border-white/[0.07] p-4 flex items-center justify-between gap-4">
          <div className="space-y-1 max-w-lg">
            <div className="text-xs font-medium text-white">Agent browser access</div>
            <p className="text-[11.5px] text-[#8A8F98]">
              Allow agents to use the shared browser. Projects can override it.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={agentBrowserAccess}
            onClick={() => setAgentBrowserAccess(!agentBrowserAccess)}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 border-0 ${
              agentBrowserAccess ? 'bg-blue-600' : 'bg-white/10'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition duration-200 mt-[3px] ml-[3px] ${
                agentBrowserAccess ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* SECTION 2: Browsing */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Browsing</h3>

        <div className="rounded-xl bg-[#111216]/90 border border-white/[0.07] divide-y divide-white/[0.05]">
          {/* Browser profiles */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-xs font-medium text-white">Browser profiles</div>
                <p className="text-[11.5px] text-[#8A8F98]">
                  Profiles separate cookies and logins. Incognito data is cleared when the app closes.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddingProfile(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-xs font-medium text-[#ECEDEF] border border-white/[0.08] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add profile</span>
              </button>
            </div>

            {isAddingProfile && (
              <div className="flex gap-2 p-2 rounded-lg bg-black/40 border border-white/[0.08]">
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateProfile()}
                  placeholder="Profile name (e.g. Work, Testing)"
                  className="flex-1 bg-transparent border-none text-xs text-[#ECEDEF] outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCreateProfile}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-xs text-white"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingProfile(false)}
                  className="px-2.5 py-1 rounded bg-white/[0.05] text-xs text-[#8A8F98]"
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              {profiles.map((prof) => (
                <div
                  key={prof.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-black/30 border border-white/[0.04]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white">{prof.name}</span>
                    {prof.isDefault && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-400 font-medium">
                        Default
                      </span>
                    )}
                  </div>
                  {!prof.isDefault && (
                    <button
                      type="button"
                      onClick={() => removeProfile(prof.id)}
                      className="text-xs text-[#8A8F98] hover:text-rose-400 p-1"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Open links in */}
          <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 max-w-lg">
              <div className="text-xs font-medium text-white">Open links in</div>
              <p className="text-[11.5px] text-[#8A8F98]">
                Where links in the chat and terminal open. Hold ⌘ or Ctrl while clicking a link to
                open it in your default browser either way.
              </p>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsOpenLinksDropdownOpen(!isOpenLinksDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-[#ECEDEF] transition-colors cursor-pointer min-w-[190px] justify-between"
              >
                <span>
                  {openLinksIn === 'embedded'
                    ? 'Orbito Browser (in-app)'
                    : 'Your default browser'}
                </span>
                <ChevronDown className="w-3 h-3 text-[#747982] flex-shrink-0" />
              </button>

              {isOpenLinksDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 rounded-lg bg-[#181a20] border border-white/[0.1] shadow-2xl py-1 z-50">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenLinksIn('embedded');
                      setIsOpenLinksDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/[0.08] flex items-center justify-between text-[#ECEDEF]"
                  >
                    <span>Orbito Browser (in-app)</span>
                    {openLinksIn === 'embedded' && <Check className="w-3 h-3 text-blue-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenLinksIn('system');
                      setIsOpenLinksDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/[0.08] flex items-center justify-between text-[#ECEDEF]"
                  >
                    <span>Your default browser</span>
                    {openLinksIn === 'system' && <Check className="w-3 h-3 text-blue-400" />}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Auto-show floating preview */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="space-y-1 max-w-lg">
              <div className="text-xs font-medium text-white">Auto-show floating preview</div>
              <p className="text-[11.5px] text-[#8A8F98]">
                Show the floating preview when an agent opens a browser or device unless the agent
                says otherwise.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={autoShowFloatingPreview}
              onClick={() => setAutoShowFloatingPreview(!autoShowFloatingPreview)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 border-0 ${
                autoShowFloatingPreview ? 'bg-blue-600' : 'bg-white/10'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition duration-200 mt-[3px] ml-[3px] ${
                  autoShowFloatingPreview ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Search engine */}
          <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 max-w-lg">
              <div className="text-xs font-medium text-white">Search engine</div>
              <p className="text-[11.5px] text-[#8A8F98]">
                What the address bar searches when you type something that isn&apos;t a URL.
              </p>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSearchEngineDropdownOpen(!isSearchEngineDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-[#ECEDEF] transition-colors cursor-pointer min-w-[150px] justify-between"
              >
                <span>{searchEngineLabels[searchEngine]}</span>
                <ChevronDown className="w-3 h-3 text-[#747982] flex-shrink-0" />
              </button>

              {isSearchEngineDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 rounded-lg bg-[#181a20] border border-white/[0.1] shadow-2xl py-1 z-50">
                  {Object.entries(searchEngineLabels).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSearchEngine(key as any);
                        setIsSearchEngineDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/[0.08] flex items-center justify-between text-[#ECEDEF]"
                    >
                      <span>{label}</span>
                      {searchEngine === key && <Check className="w-3 h-3 text-blue-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Advanced toggle */}
          <div className="p-3 text-xs text-[#8A8F98]">
            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <span>{isAdvancedOpen ? '▼' : '▶'}</span>
              <span>Advanced</span>
            </button>
            {isAdvancedOpen && (
              <div className="pt-2 pl-4 text-[11px] text-[#717784] space-y-1">
                <p>User agent: Built-in Chromium desktop browser</p>
                <p>Hardware acceleration: Enabled</p>
                <p>WebRTC & Media Capture: Enabled</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: Recordings */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Recordings</h3>

        <div className="rounded-xl bg-[#111216]/90 border border-white/[0.07] divide-y divide-white/[0.05]">
          {/* Frame rate */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="space-y-1 max-w-lg">
              <div className="text-xs font-medium text-white">Browser recording frame rate</div>
              <p className="text-[11.5px] text-[#8A8F98]">
                Maximum recording rate. 30 fps saves CPU and storage; 60 fps is smoother.
              </p>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsFpsDropdownOpen(!isFpsDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-[#ECEDEF] transition-colors cursor-pointer min-w-[100px] justify-between"
              >
                <span>{recordingFrameRate} fps</span>
                <ChevronDown className="w-3 h-3 text-[#747982] flex-shrink-0" />
              </button>

              {isFpsDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-32 rounded-lg bg-[#181a20] border border-white/[0.1] shadow-2xl py-1 z-50">
                  {['15', '30', '60'].map((fps) => (
                    <button
                      key={fps}
                      type="button"
                      onClick={() => {
                        setRecordingFrameRate(fps as any);
                        setIsFpsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/[0.08] flex items-center justify-between text-[#ECEDEF]"
                    >
                      <span>{fps} fps</span>
                      {recordingFrameRate === fps && <Check className="w-3 h-3 text-blue-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Show key presses */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="space-y-1 max-w-lg">
              <div className="text-xs font-medium text-white">Show key presses in recordings</div>
              <p className="text-[11.5px] text-[#8A8F98]">
                Show pressed keys and shortcuts in new recordings. Password fields are excluded.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={showKeyPressesInRecordings}
              onClick={() => setShowKeyPresses(!showKeyPressesInRecordings)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 border-0 ${
                showKeyPressesInRecordings ? 'bg-blue-600' : 'bg-white/10'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition duration-200 mt-[3px] ml-[3px] ${
                  showKeyPressesInRecordings ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Show mouse presses */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="space-y-1 max-w-lg">
              <div className="text-xs font-medium text-white">Show mouse presses in recordings</div>
              <p className="text-[11.5px] text-[#8A8F98]">
                Highlight mouse presses and held buttons in new recordings.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={showMousePressesInRecordings}
              onClick={() => setShowMousePresses(!showMousePressesInRecordings)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 border-0 ${
                showMousePressesInRecordings ? 'bg-blue-600' : 'bg-white/10'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition duration-200 mt-[3px] ml-[3px] ${
                  showMousePressesInRecordings ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
