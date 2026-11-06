import React from 'react';
import {
  X,
  FileCode,
  Bot,
  Sparkles,
  BrainCircuit,
  ExternalLink,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  Info,
  CheckCircle2,
  FileQuestion,
  ListTree
} from 'lucide-react';
import type { ProjectGraphNode, ProjectGraphEdge } from '../../../../shared/types';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';

interface NodeDetailsPanelProps {
  node: ProjectGraphNode | null;
  edges: ProjectGraphEdge[];
  onClose: () => void;
  onSelectNodeById: (id: string) => void;
}

export const NodeDetailsPanel: React.FC<NodeDetailsPanelProps> = ({
  node,
  edges,
  onClose,
  onSelectNodeById
}) => {
  const { setActiveFile, setRightPanelTab, loadFileSymbols } = useWorkspaceStore();

  if (!node) return null;

  // Find incoming and outgoing edges for this node
  const inboundEdges = edges.filter((e) => e.target === node.id);
  const outboundEdges = edges.filter((e) => e.source === node.id);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'agent':
        return <Bot className="w-4 h-4 text-accent" />;
      case 'skill':
        return <Sparkles className="w-4 h-4 text-accent" />;
      case 'context':
        return <BrainCircuit className="w-4 h-4 text-accent" />;
      case 'file':
      default:
        return <FileCode className="w-4 h-4 text-accent" />;
    }
  };

  const handleOpenFile = async () => {
    if (node.path) {
      await setActiveFile(node.path);
    }
  };

  const handleInspectSymbols = async () => {
    if (node.path) {
      await loadFileSymbols(node.path);
      setRightPanelTab('outline');
    }
  };

  return (
    <aside className="absolute top-4 right-4 bottom-4 w-84 z-30 flex flex-col rounded-2xl glass-card backdrop-blur-glass border border-border shadow-dropdown overflow-hidden font-mono text-xs animate-in slide-in-from-right-4 duration-150 select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-border bg-surface/40 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          {getCategoryIcon(node.category)}
          <span className="font-semibold text-foreground text-xs uppercase tracking-wider">
            {node.category} Details
          </span>
        </div>
        <IconButton
          icon={X}
          onClick={onClose}
          tooltip="Close Details"
          size="sm"
          className="text-foreground-muted hover:text-foreground"
        />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Node Identity */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-foreground-muted uppercase tracking-wider font-semibold">
              Identifier
            </span>
            <Badge variant="accent" size="sm">
              {node.subType || node.category}
            </Badge>
          </div>
          <h3 className="font-semibold text-foreground text-sm truncate" title={node.label}>
            {node.label}
          </h3>
          {node.path && (
            <p className="text-[10px] text-foreground-muted truncate select-text" title={node.path}>
              {node.path}
            </p>
          )}
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-xl bg-surface/50 border border-border/80 text-center">
            <div className="text-foreground-muted text-[9px] uppercase">Total</div>
            <div className="text-foreground font-semibold text-sm mt-0.5">{node.degree}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-surface/50 border border-border/80 text-center">
            <div className="text-foreground-muted text-[9px] uppercase">Incoming</div>
            <div className="text-foreground font-semibold text-sm mt-0.5">{node.inDegree}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-surface/50 border border-border/80 text-center">
            <div className="text-foreground-muted text-[9px] uppercase">Outgoing</div>
            <div className="text-foreground font-semibold text-sm mt-0.5">{node.outDegree}</div>
          </div>
        </div>

        {/* Orphaned File Intelligence Alert */}
        {node.isOrphan && (
          <div className="p-3 rounded-xl bg-warning/10 border border-warning/30 space-y-1.5">
            <div className="flex items-center gap-1.5 text-warning font-semibold text-xs">
              <FileQuestion className="w-4 h-4 flex-shrink-0" />
              <span>Unconnected File</span>
            </div>
            <div className="text-[10px] text-foreground-secondary leading-relaxed space-y-1">
              <p>
                <strong className="text-foreground">Category:</strong> {node.orphanReason || 'Standalone resource'}
              </p>
              <p className="text-foreground-muted">
                No direct import or dependency edges were detected for this file. It may be an application entry point, configuration, static asset, or dynamically loaded module.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons for Files */}
        {node.category === 'file' && (
          <div className="space-y-1.5 pt-1">
            <Button
              variant="primary"
              size="md"
              icon={ExternalLink}
              onClick={handleOpenFile}
              className="w-full text-xs"
            >
              Open in Editor
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={ListTree}
              onClick={handleInspectSymbols}
              className="w-full text-xs"
            >
              Inspect AST Symbols
            </Button>
          </div>
        )}

        {/* Inbound Connections (Dependents) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-foreground-muted uppercase tracking-wider font-semibold flex items-center gap-1">
              <ArrowDownLeft className="w-3 h-3 text-accent" />
              <span>Referenced By ({inboundEdges.length})</span>
            </span>
          </div>

          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
            {inboundEdges.length === 0 ? (
              <p className="text-[10px] text-foreground-muted italic py-1">No incoming references.</p>
            ) : (
              inboundEdges.map((e) => (
                <div
                  key={e.id}
                  onClick={() => onSelectNodeById(e.source)}
                  className="p-1.5 rounded-lg bg-surface/40 hover:bg-surface-elevated border border-border/60 hover:border-accent cursor-pointer flex items-center justify-between text-[11px] transition-all"
                >
                  <span className="truncate pr-1.5 text-foreground">{e.source.split(/[/\\]/).pop()}</span>
                  <Badge variant="neutral" size="sm" className="text-[8px]">
                    {e.relation}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Outbound Connections (Dependencies) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-foreground-muted uppercase tracking-wider font-semibold flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-accent" />
              <span>Dependencies ({outboundEdges.length})</span>
            </span>
          </div>

          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
            {outboundEdges.length === 0 ? (
              <p className="text-[10px] text-foreground-muted italic py-1">No outgoing dependencies.</p>
            ) : (
              outboundEdges.map((e) => (
                <div
                  key={e.id}
                  onClick={() => onSelectNodeById(e.target)}
                  className="p-1.5 rounded-lg bg-surface/40 hover:bg-surface-elevated border border-border/60 hover:border-accent cursor-pointer flex items-center justify-between text-[11px] transition-all"
                >
                  <span className="truncate pr-1.5 text-foreground">{e.target.split(/[/\\]/).pop()}</span>
                  <Badge variant="neutral" size="sm" className="text-[8px]">
                    {e.relation}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
