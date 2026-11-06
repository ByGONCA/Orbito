import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { GraphCanvas } from './GraphCanvas';
import { GraphControls } from './GraphControls';
import { NodeDetailsPanel } from './NodeDetailsPanel';
import type { ProjectGraphNode } from '../../../../shared/types';
import { Network, RefreshCw, FolderOpen } from 'lucide-react';
import { Button } from '../ui/Button';

export const IntelligenceGraphWorkspace: React.FC = () => {
  const {
    project,
    projectGraph,
    isGraphLoading,
    loadProjectGraph,
    selectedGraphNodeId,
    setSelectedGraphNodeId
  } = useWorkspaceStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [orphanOnly, setOrphanOnly] = useState(false);
  const [selectedNode, setSelectedNode] = useState<ProjectGraphNode | null>(null);
  const [isPhysicsPaused, setIsPhysicsPaused] = useState(false);

  // Auto-load graph on component mount if empty
  useEffect(() => {
    if (!projectGraph && project) {
      loadProjectGraph(project.path);
    }
  }, [project, projectGraph, loadProjectGraph]);

  // Synchronize selection with store
  const handleSelectNode = (node: ProjectGraphNode | null) => {
    setSelectedNode(node);
    setSelectedGraphNodeId(node ? node.id : null);
  };

  const handleSelectNodeById = (nodeId: string) => {
    if (!projectGraph) return;
    const target = projectGraph.nodes.find((n) => n.id === nodeId);
    if (target) {
      setSelectedNode(target);
      setSelectedGraphNodeId(target.id);
    }
  };

  if (!project) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center bg-transparent select-none font-mono">
        <div className="max-w-md w-full glass-card p-8 rounded-2xl border border-border shadow-dropdown space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto text-accent shadow-subtle">
            <Network className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">AI Intelligence Graph</h2>
            <p className="text-xs text-foreground-secondary leading-relaxed">
              Open a workspace folder to visualize code dependencies, agent workflows, and architecture intelligence.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const nodes = projectGraph?.nodes || [];
  const edges = projectGraph?.edges || [];
  const orphanCount = projectGraph?.stats.orphanedFiles || 0;

  return (
    <div className="h-full w-full relative overflow-hidden bg-transparent select-none">
      {/* Top Floating Controls */}
      <GraphControls
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels(!showLabels)}
        orphanOnly={orphanOnly}
        onToggleOrphanOnly={() => setOrphanOnly(!orphanOnly)}
        orphanCount={orphanCount}
        totalNodes={nodes.length}
        totalEdges={edges.length}
        onRefresh={() => loadProjectGraph(project.path)}
        isLoading={isGraphLoading}
        isPhysicsPaused={isPhysicsPaused}
        onTogglePhysics={() => setIsPhysicsPaused(!isPhysicsPaused)}
      />

      {/* Main Interactive Graph Canvas */}
      <GraphCanvas
        nodes={nodes}
        edges={edges}
        selectedNodeId={selectedGraphNodeId}
        onSelectNode={handleSelectNode}
        showLabels={showLabels}
        filterCategory={selectedCategory}
        orphanOnly={orphanOnly}
        searchQuery={searchQuery}
        isPhysicsPaused={isPhysicsPaused}
      />

      {/* Contextual Node Details Panel */}
      {selectedNode && (
        <NodeDetailsPanel
          node={selectedNode}
          edges={edges}
          onClose={() => handleSelectNode(null)}
          onSelectNodeById={handleSelectNodeById}
        />
      )}

      {/* Loading Overlay */}
      {isGraphLoading && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-xs flex items-center justify-center z-40">
          <div className="glass-card px-4 py-3 rounded-2xl border border-border flex items-center gap-3 shadow-dropdown font-mono text-xs text-foreground">
            <RefreshCw className="w-4 h-4 text-accent animate-spin" />
            <span>Assembling intelligence graph...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntelligenceGraphWorkspace;
