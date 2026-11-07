import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FilePlus,
  FolderPlus,
  FolderMinus,
  RefreshCw,
  Copy,
  Edit3,
  Trash2,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  X
} from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import type { FileNode } from '../../../../shared/types';
import { IconButton } from '../ui/IconButton';
import { SearchField } from '../ui/SearchField';
import { FileIcon } from '../../utils/file-icons';
import {
  CreateFileOrFolderModal,
  RenameModal,
  DeleteConfirmModal
} from '../FileExplorerModals';

interface FlatNode {
  node: FileNode;
  depth: number;
}

export const FilesTab: React.FC = () => {
  const {
    project,
    files,
    setFiles,
    activeFilePath,
    setActiveFile,
    expandedDirs,
    toggleDirExpanded,
    collapseAllDirs,
    fileFilter,
    setFileFilter,
    gitStatus,
    loadGitStatus,
    fileIconTheme,
    showGitFileColors,
    createFile,
    createDirectory,
    renameItem,
    deleteItem,
    moveItem,
    addLog
  } = useWorkspaceStore();

  const fileTreeRef = useRef<HTMLDivElement>(null);

  // Modals & context menu states
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileNode | null } | null>(null);
  const [draggedNode, setDraggedNode] = useState<FileNode | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [createModal, setCreateModal] = useState<{ isOpen: boolean; type: 'file' | 'folder'; parentDir: string } | null>(null);
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; node: FileNode } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; node: FileNode } | null>(null);

  // Close context menu on outside click or Escape
  useEffect(() => {
    const handleDismiss = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', handleDismiss);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleDismiss);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleRefreshFiles = useCallback(async () => {
    if (!project) return;
    try {
      const refreshed = await window.api.listFiles({ projectPath: project.path });
      setFiles(refreshed);
      loadGitStatus(project.path);
      addLog('Files and Git status refreshed', 'info');
    } catch (e: any) {
      addLog(`Failed to refresh files: ${e.message}`, 'error');
    }
  }, [project, setFiles, loadGitStatus, addLog]);

  // Auto-refresh files if project is selected and files are empty
  useEffect(() => {
    if (project?.path && files.length === 0) {
      handleRefreshFiles();
    }
  }, [project?.path, files.length, handleRefreshFiles]);

  const handleCollapseAllFolders = useCallback(() => {
    collapseAllDirs();
  }, [collapseAllDirs]);

  // Flatten and filter file tree with correct parent-first order and folder expansion
  const flatNodes = useMemo(() => {
    const list: FlatNode[] = [];
    const filterLower = fileFilter.trim().toLowerCase();

    function matchesFilter(node: FileNode): boolean {
      if (node.name.toLowerCase().includes(filterLower)) return true;
      if (node.isDirectory && node.children && node.children.length > 0) {
        return node.children.some(matchesFilter);
      }
      return false;
    }

    function sortNodes(nodes: FileNode[]): FileNode[] {
      return [...nodes].sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });
    }

    function traverse(nodes: FileNode[], depth: number) {
      const sorted = sortNodes(nodes);
      for (const n of sorted) {
        if (n.name.startsWith('.') && n.name !== '.env' && n.name !== '.gitignore') {
          // exclude internal hidden dotfiles
          continue;
        }

        const norm = n.path.replace(/\\/g, '/');
        const isDirExpanded =
          expandedDirs.has(n.path) ||
          expandedDirs.has(norm) ||
          (n.id ? expandedDirs.has(n.id) : false);

        if (filterLower) {
          if (!matchesFilter(n)) continue;

          list.push({ node: n, depth });
          if (n.isDirectory && n.children && n.children.length > 0) {
            // Automatically expand matching folders when searching
            traverse(n.children, depth + 1);
          }
        } else {
          list.push({ node: n, depth });
          if (n.isDirectory && isDirExpanded && n.children && n.children.length > 0) {
            traverse(n.children, depth + 1);
          }
        }
      }
    }

    traverse(files, 0);
    return list;
  }, [files, expandedDirs, fileFilter]);

  // TanStack virtualizer with stable keys
  const rowVirtualizer = useVirtualizer({
    count: flatNodes.length,
    getScrollElement: () => fileTreeRef.current,
    estimateSize: () => 24,
    getItemKey: (index) => flatNodes[index]?.node.path ?? index,
    overscan: 10
  });

  // Git map lookup
  const gitStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!gitStatus?.changedFiles) return map;
    for (const cf of gitStatus.changedFiles) {
      const normalized = cf.path.replace(/\\/g, '/');
      map.set(normalized, cf.status || 'M');
    }
    return map;
  }, [gitStatus]);

  const getFileGitStatus = useCallback(
    (filePath: string) => {
      if (!project?.path) return undefined;
      const rel = filePath.replace(project.path, '').replace(/^[\\/]/, '').replace(/\\/g, '/');
      return gitStatusMap.get(rel);
    },
    [project, gitStatusMap]
  );

  return (
    <div className="h-full flex flex-col font-sans select-none">
      {/* Search & Actions Bar */}
      <div className="p-2 border-b border-white/[0.06] bg-transparent flex items-center gap-1 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <SearchField
            value={fileFilter}
            onChange={(e) => setFileFilter(e.target.value)}
            onClear={() => setFileFilter('')}
            placeholder="Search files..."
            className="w-full text-xs"
          />
        </div>
        <IconButton
          icon={FilePlus}
          onClick={() => setCreateModal({ isOpen: true, type: 'file', parentDir: project?.path || '' })}
          tooltip="New File"
          size="sm"
          className="text-neutral-400 hover:text-white"
        />
        <IconButton
          icon={FolderPlus}
          onClick={() => setCreateModal({ isOpen: true, type: 'folder', parentDir: project?.path || '' })}
          tooltip="New Folder"
          size="sm"
          className="text-neutral-400 hover:text-white"
        />
        <IconButton
          icon={FolderMinus}
          onClick={handleCollapseAllFolders}
          tooltip="Collapse All Folders"
          size="sm"
          className="text-neutral-400 hover:text-white"
        />
        <IconButton
          icon={RefreshCw}
          onClick={handleRefreshFiles}
          tooltip="Refresh Files"
          size="sm"
          className="text-neutral-400 hover:text-white"
        />
      </div>

      {/* Virtualized Files List */}
      <div
        ref={fileTreeRef}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, node: null });
        }}
        className="flex-1 overflow-auto p-1 font-mono text-[11px]"
      >
        {flatNodes.length === 0 ? (
          <div className="p-4 text-center text-neutral-500 text-xs italic">
            {fileFilter ? 'No files match your search.' : 'Project folder is empty.'}
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative'
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const { node, depth } = flatNodes[virtualRow.index];
              const norm = node.path.replace(/\\/g, '/');
              const isExpanded =
                expandedDirs.has(node.path) ||
                expandedDirs.has(norm) ||
                (node.id ? expandedDirs.has(node.id) : false);
              const isSelected =
                activeFilePath === node.path ||
                (activeFilePath ? activeFilePath.replace(/\\/g, '/') === norm : false);
              const fileGitStatus = !node.isDirectory ? getFileGitStatus(node.path) : undefined;

              return (
                <div
                  key={node.path}
                  onClick={() => {
                    if (node.isDirectory) {
                      toggleDirExpanded(node.path);
                    } else {
                      setActiveFile(node.path);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenu({ x: e.clientX, y: e.clientY, node });
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                  className={`flex items-center gap-1.5 px-2 rounded cursor-pointer transition-colors text-[11px] group ${
                    isSelected
                      ? 'bg-white/[0.08] text-white font-medium'
                      : 'hover:bg-white/[0.04] text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <div style={{ width: `${depth * 14}px` }} className="flex-shrink-0" />
                  {node.isDirectory ? (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDirExpanded(node.path);
                      }}
                      className="text-neutral-500 hover:text-white w-4 h-4 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors"
                      title={isExpanded ? 'Collapse folder' : 'Expand folder'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </span>
                  ) : (
                    <div className="w-4 flex-shrink-0" />
                  )}
                  <FileIcon
                    name={node.name}
                    isDirectory={node.isDirectory}
                    isExpanded={isExpanded}
                    theme={fileIconTheme}
                  />
                  <span className="truncate flex-1 select-none">{node.name}</span>

                  {/* Git Status indicator (Modified, Untracked, Added, Deleted, Renamed) */}
                  {fileGitStatus && (
                    <span
                      className={`ml-auto mr-1 font-mono text-[10px] font-semibold ${
                        fileGitStatus === 'M'
                          ? 'text-amber-400'
                          : fileGitStatus === 'D'
                          ? 'text-rose-400'
                          : fileGitStatus === 'R'
                          ? 'text-purple-400'
                          : fileGitStatus === 'U'
                          ? 'text-sky-400'
                          : 'text-emerald-400'
                      }`}
                      title={`Git: ${fileGitStatus}`}
                    >
                      {fileGitStatus}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 min-w-44 bg-[#1C1D24] border border-white/10 rounded-lg shadow-xl p-1 text-xs text-neutral-300 font-sans"
        >
          <button
            onClick={() => {
              const parentDir = contextMenu.node?.isDirectory
                ? contextMenu.node.path
                : project?.path || '';
              setCreateModal({ isOpen: true, type: 'file', parentDir });
              setContextMenu(null);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-white/[0.08] hover:text-white flex items-center gap-2"
          >
            <FilePlus className="w-3.5 h-3.5 text-neutral-400" />
            <span>New File</span>
          </button>
          <button
            onClick={() => {
              const parentDir = contextMenu.node?.isDirectory
                ? contextMenu.node.path
                : project?.path || '';
              setCreateModal({ isOpen: true, type: 'folder', parentDir });
              setContextMenu(null);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-white/[0.08] hover:text-white flex items-center gap-2"
          >
            <FolderPlus className="w-3.5 h-3.5 text-neutral-400" />
            <span>New Folder</span>
          </button>
          {contextMenu.node && (
            <>
              <div className="h-px bg-white/[0.06] my-1" />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.node!.path);
                  addLog('File path copied to clipboard', 'info');
                  setContextMenu(null);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded hover:bg-white/[0.08] hover:text-white flex items-center gap-2"
              >
                <Copy className="w-3.5 h-3.5 text-neutral-400" />
                <span>Copy Path</span>
              </button>
              <button
                onClick={() => {
                  window.api.revealInFileManager?.({ filePath: contextMenu.node!.path });
                  setContextMenu(null);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded hover:bg-white/[0.08] hover:text-white flex items-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                <span>Reveal in File Explorer</span>
              </button>
              <button
                onClick={() => {
                  setRenameModal({ isOpen: true, node: contextMenu.node! });
                  setContextMenu(null);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded hover:bg-white/[0.08] hover:text-white flex items-center gap-2"
              >
                <Edit3 className="w-3.5 h-3.5 text-neutral-400" />
                <span>Rename</span>
              </button>
              <button
                onClick={() => {
                  setDeleteModal({ isOpen: true, node: contextMenu.node! });
                  setContextMenu(null);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {createModal?.isOpen && (
        <CreateFileOrFolderModal
          isOpen={createModal.isOpen}
          type={createModal.type}
          parentDir={createModal.parentDir}
          onClose={() => setCreateModal(null)}
          onSubmit={async (name) => {
            const sep = createModal.parentDir.includes('\\') ? '\\' : '/';
            const targetPath = `${createModal.parentDir.replace(/[\\/]+$/, '')}${sep}${name}`;
            if (createModal.type === 'file') {
              await createFile(targetPath, '');
            } else {
              await createDirectory(targetPath);
            }
            handleRefreshFiles();
          }}
        />
      )}

      {renameModal?.isOpen && (
        <RenameModal
          isOpen={renameModal.isOpen}
          currentName={renameModal.node.name}
          isDirectory={renameModal.node.isDirectory}
          onClose={() => setRenameModal(null)}
          onSubmit={async (newName) => {
            const lastSlash = Math.max(
              renameModal.node.path.lastIndexOf('/'),
              renameModal.node.path.lastIndexOf('\\')
            );
            const dir =
              lastSlash > -1
                ? renameModal.node.path.substring(0, lastSlash)
                : renameModal.node.path;
            const sep = renameModal.node.path.includes('\\') ? '\\' : '/';
            await renameItem(renameModal.node.path, `${dir}${sep}${newName}`);
            handleRefreshFiles();
          }}
        />
      )}

      {deleteModal?.isOpen && (
        <DeleteConfirmModal
          isOpen={deleteModal.isOpen}
          itemName={deleteModal.node.name}
          isDirectory={deleteModal.node.isDirectory}
          onClose={() => setDeleteModal(null)}
          onConfirm={async () => {
            await deleteItem(deleteModal.node.path);
            handleRefreshFiles();
          }}
        />
      )}
    </div>
  );
};
