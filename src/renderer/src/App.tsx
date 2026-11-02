import React, { useEffect } from 'react';
import { Header } from './components/Header';
import { FileExplorer } from './components/FileExplorer';
import { CenterArea } from './components/CenterArea';
import { RightPanel } from './components/RightPanel';
import { BottomPanel } from './components/BottomPanel';
import { SettingsModal } from './components/SettingsModal';
import { useWorkspaceStore } from './stores/workspace.store';

export const App: React.FC = () => {
  const { setUiMode, setTheme, setProject, setFiles, addLog } = useWorkspaceStore();

  useEffect(() => {
    const initialize = async () => {
      try {
        const settings = await window.api.getSettings();
        if (settings) {
          setUiMode(settings.uiMode);
          setTheme(settings.theme);
        }

        const recent = await window.api.getRecentProjects();
        if (recent.length > 0) {
          const latest = recent[0];
          setProject(latest);
          addLog(`Restored recent project: ${latest.name}`, 'info');
          const files = await window.api.listFiles({ projectPath: latest.path });
          setFiles(files);
        }
      } catch (err: any) {
        addLog(`Init warning: ${err.message}`, 'warn');
      }
    };

    initialize();
  }, [setUiMode, setTheme, setProject, setFiles, addLog]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Top Header */}
      <Header />

      {/* Main Workspace Body: 3-Column Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Virtualized File Explorer (240px) */}
        <div className="w-60 flex-shrink-0 h-full">
          <FileExplorer />
        </div>

        {/* Center: Editor / Viewport */}
        <main className="flex-1 h-full min-w-0">
          <CenterArea />
        </main>

        {/* Right: Inspector & Context (260px) */}
        <div className="w-64 flex-shrink-0 h-full">
          <RightPanel />
        </div>
      </div>

      {/* Bottom Collapsible Logs & Telemetry */}
      <BottomPanel />

      {/* Settings & Keyring Dialog */}
      <SettingsModal />
    </div>
  );
};
export default App;
