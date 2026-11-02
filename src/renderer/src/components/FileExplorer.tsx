import React, { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  File
} from 'lucide-react';
import type { FileNode } from '../../../shared/types';
import { useWorkspaceStore } from '../stores/workspace.store';

interface FlatNode {
  node: FileNode;
  depth: number;
}

export const FileExplorer: React.FC = () => {
  const { files, project, expandedDirs, toggleDirExpanded, setActiveFile, activeFilePath, addLog } =
    useWorkspaceStore();

  const parentRef = useRef<HTMLDivElement>(null);

  // Flatten the recursive tree into a linear list of only visible/expanded nodes
  const flatNodes = useMemo(() => {
    const result: FlatNode[] = [];

    const traverse = (items: FileNode[], depth: number) => {
      for (const item of items) {
        result.push({ node: item, depth });
        if (item.isDirectory && expandedDirs.has(item.id) && item.children) {
          traverse(item.children, depth + 1);
        }
      }
    };

    traverse(files, 0);
    return result;
  }, [files, expandedDirs]);

  const rowVirtualizer = useVirtualizer({
    count: flatNodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 26,
    overscan: 10
  });

  const handleNodeClick = async (node: FileNode) => {
    if (node.isDirectory) {
      toggleDirExpanded(node.id);
    } else if (project) {
      try {
        const content = await window.api.readFileContent({
          filePath: node.path,
          projectPath: project.path
        });
        setActiveFile(node.path, content);
        addLog(`Opened file: ${node.name}`, 'info');
      } catch (err: any) {
        addLog(`Failed to read file: ${err.message}`, 'error');
      }
    }
  };

  const getFileIcon = (node: FileNode, isExpanded: boolean) => {
    if (node.isDirectory) {
      return isExpanded ? (
        <FolderOpen className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
      ) : (
        <Folder className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
      );
    }

    const ext = node.name.split('.').pop()?.toLowerCase();
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'json'].includes(ext || '')) {
      return <FileCode className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
    }
    if (['md', 'txt', 'doc'].includes(ext || '')) {
      return <FileText className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
    }
    return <File className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />;
  };

  return (
    <div className="flex flex-col h-full bg-card/60 select-none border-r border-border">
      <div className="h-8 border-b border-border flex items-center justify-between px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <span>Files</span>
        <span className="text-[10px] lowercase font-normal bg-secondary px-1.5 py-0.5 rounded">
          {flatNodes.length} items
        </span>
      </div>

      <div ref={parentRef} className="flex-1 overflow-auto text-xs py-1">
        {flatNodes.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground italic text-xs">
            {project ? 'No files found.' : 'Open a directory to explore files.'}
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
              const isExpanded = expandedDirs.has(node.id);
              const isSelected = activeFilePath === node.path;

              return (
                <div
                  key={node.id}
                  onClick={() => handleNodeClick(node)}
                  className={`absolute top-0 left-0 w-full flex items-center gap-1.5 px-2 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-primary/15 text-primary font-medium'
                      : 'hover:bg-secondary/60 text-foreground'
                  }`}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingLeft: `${Math.max(8, depth * 14 + 8)}px`
                  }}
                >
                  {/* Chevron for directories */}
                  {node.isDirectory ? (
                    <span className="w-3 h-3 flex items-center justify-center text-muted-foreground">
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                    </span>
                  ) : (
                    <span className="w-3 h-3" />
                  )}

                  {getFileIcon(node, isExpanded)}
                  <span className="truncate">{node.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
