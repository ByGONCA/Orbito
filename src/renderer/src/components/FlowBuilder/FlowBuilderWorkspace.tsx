import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  Play,
  Square,
  Sparkles,
  Save,
  Download,
  Upload,
  Copy,
  Trash2,
  FolderOpen,
  Plus,
  Search,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Bot,
  Terminal,
  FileCode,
  ShieldCheck,
  Split,
  Repeat,
  Type,
  FileText,
  Variable,
  Bell,
  CheckCheck,
  ChevronRight,
  ChevronDown,
  X,
  RefreshCw,
  Zap,
  HelpCircle
} from 'lucide-react';

import { useWorkspaceStore } from '../../stores/workspace.store';
import { CustomFlowNode } from './CustomFlowNode';
import { createNodeData, NODE_REGISTRY } from '../../../../shared/node-registry';
import type {
  WorkflowRecord,
  FlowNode,
  FlowEdge,
  FlowNodeType,
  NodeCategory,
  WorkflowEvent,
  WorkflowExecutionRecord,
  NLWorkflowGenerationResult
} from '../../../../shared/workflows';

const nodeTypes = {
  customNode: CustomFlowNode
};

export const FlowBuilderWorkspace: React.FC = () => {
  const {
    project,
    uiMode,
    setUiMode,
    workflows,
    setWorkflows,
    activeWorkflow,
    setActiveWorkflow,
    workflowTemplates,
    setWorkflowTemplates,
    addLog
  } = useWorkspaceStore();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const [workflowDesc, setWorkflowDesc] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);
  const [executionLogs, setExecutionLogs] = useState<Array<{ timestamp: number; message: string; type: string }>>([]);
  const [isBottomOpen, setIsBottomOpen] = useState(false);
  const [nodeSearchQuery, setNodeSearchQuery] = useState('');
  const [isNLModalOpen, setIsNLModalOpen] = useState(false);
  const [nlPrompt, setNlPrompt] = useState('');
  const [nlResult, setNlResult] = useState<NLWorkflowGenerationResult | null>(null);
  const [isGeneratingNL, setIsGeneratingNL] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // Load Workflows and Templates on Mount
  useEffect(() => {
    loadWorkflowsAndTemplates();
  }, [project?.path]);

  const loadWorkflowsAndTemplates = async () => {
    try {
      const templates = await window.api.getWorkflowTemplates();
      setWorkflowTemplates(templates);

      const list = await window.api.listWorkflows({ projectId: project?.path || 'default' });
      setWorkflows(list);

      if (list.length > 0) {
        selectWorkflow(list[0]);
      } else if (templates.length > 0) {
        // Load first template as default
        selectWorkflow(templates[0]);
      }
    } catch (err: any) {
      addLog(`Failed to load workflows: ${err.message}`, 'error');
    }
  };

  const selectWorkflow = (wf: WorkflowRecord) => {
    setActiveWorkflow(wf);
    setWorkflowName(wf.name);
    setWorkflowDesc(wf.description || '');

    const rfNodes: Node[] = wf.nodes.map((n) => ({
      id: n.id,
      type: 'customNode',
      position: n.position,
      data: n.data as any
    }));

    const rfEdges: Edge[] = wf.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      label: e.label,
      animated: e.animated ?? true
    }));

    setNodes(rfNodes);
    setEdges(rfEdges);
    setSelectedNodeId(null);
    setSaveStatus('saved');
  };

  // Sync React Flow Changes
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    setSaveStatus('unsaved');
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    setSaveStatus('unsaved');
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) =>
      addEdge(
        {
          ...connection,
          animated: true,
          style: { strokeWidth: 2 }
        },
        eds
      )
    );
    setSaveStatus('unsaved');
  }, []);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Listen to Workflow Execution Events
  useEffect(() => {
    const unsubscribe = window.api.onWorkflowEvent((event: WorkflowEvent) => {
      setExecutionLogs((prev) => [
        ...prev.slice(-100),
        {
          timestamp: event.timestamp,
          message: event.message || `Node ${event.nodeId || ''} status: ${event.status || event.type}`,
          type: event.type
        }
      ]);

      if (event.nodeId && event.status) {
        setNodes((currentNodes) =>
          currentNodes.map((n) => {
            if (n.id === event.nodeId) {
              return {
                ...n,
                data: {
                  ...n.data,
                  status: event.status as any,
                  errorMessage: event.error || undefined,
                  outputValues: event.output || (n.data as any).outputValues
                }
              };
            }
            return n;
          })
        );
      }

      if (
        event.type === 'workflow_completed' ||
        event.type === 'workflow_failed' ||
        event.type === 'workflow_cancelled'
      ) {
        setIsExecuting(false);
        setActiveExecutionId(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Add Node from Library
  const handleAddNode = (type: FlowNodeType) => {
    const id = `node-${Date.now().toString(36).slice(-4)}`;
    const newNode: Node = {
      id,
      type: 'customNode',
      position: { x: 250 + Math.random() * 80, y: 150 + Math.random() * 80 },
      data: createNodeData(type) as any
    };

    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(id);
    setSaveStatus('unsaved');
  };

  // Save Workflow
  const handleSaveWorkflow = async () => {
    if (!project?.path) {
      addLog('Please open a project directory before saving workflows.', 'warn');
      return;
    }

    setSaveStatus('saving');
    try {
      const flowNodes: FlowNode[] = nodes.map((n) => ({
        id: n.id,
        type: 'customNode',
        position: n.position,
        data: n.data as any
      }));

      const flowEdges: FlowEdge[] = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || undefined,
        targetHandle: e.targetHandle || undefined,
        label: (e.label as string) || undefined,
        animated: e.animated
      }));

      const record: WorkflowRecord = {
        id: activeWorkflow?.id || `wf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        projectId: project.path,
        name: workflowName,
        description: workflowDesc,
        nodes: flowNodes,
        edges: flowEdges,
        variables: activeWorkflow?.variables || {},
        trigger: activeWorkflow?.trigger || { type: 'manual', enabled: true, config: {} },
        status: 'ready',
        version: (activeWorkflow?.version || 0) + 1,
        createdAt: activeWorkflow?.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      await window.api.saveWorkflow({ workflow: record });
      setActiveWorkflow(record);
      setSaveStatus('saved');
      addLog(`Workflow "${workflowName}" saved successfully.`, 'info');

      // Refresh list
      const list = await window.api.listWorkflows({ projectId: project.path });
      setWorkflows(list);
    } catch (err: any) {
      setSaveStatus('unsaved');
      addLog(`Error saving workflow: ${err.message}`, 'error');
    }
  };

  // Execute Workflow
  const handleRunWorkflow = async () => {
    if (!project?.path) {
      addLog('Cannot execute workflow without an open project.', 'warn');
      return;
    }

    // Auto-save before running
    await handleSaveWorkflow();

    if (!activeWorkflow) return;

    setIsExecuting(true);
    setIsBottomOpen(true);
    setExecutionLogs([]);

    try {
      const exec = await window.api.executeWorkflow({
        workflowId: activeWorkflow.id,
        projectPath: project.path
      });
      setActiveExecutionId(exec.id);
    } catch (err: any) {
      setIsExecuting(false);
      addLog(`Workflow execution failed: ${err.message}`, 'error');
    }
  };

  // Cancel Workflow
  const handleCancelWorkflow = async () => {
    if (!activeExecutionId) return;
    try {
      await window.api.cancelWorkflow({ executionId: activeExecutionId });
      addLog('Cancellation signal sent to workflow execution.', 'info');
    } catch (err: any) {
      addLog(`Failed to cancel workflow: ${err.message}`, 'error');
    }
  };

  // Natural Language Generation
  const handleGenerateFromPrompt = async () => {
    if (!nlPrompt.trim() || !project?.path) return;
    setIsGeneratingNL(true);
    try {
      const result = await window.api.generateWorkflowFromPrompt({
        prompt: nlPrompt,
        projectPath: project.path
      });
      setNlResult(result);
    } catch (err: any) {
      addLog(`Generation failed: ${err.message}`, 'error');
    } finally {
      setIsGeneratingNL(false);
    }
  };

  const handleApplyNLWorkflow = () => {
    if (!nlResult) return;
    setWorkflowName(nlResult.name);
    setWorkflowDesc(nlResult.description);

    const rfNodes: Node[] = nlResult.nodes.map((n) => ({
      id: n.id,
      type: 'customNode',
      position: n.position,
      data: n.data as any
    }));

    const rfEdges: Edge[] = nlResult.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      animated: true
    }));

    setNodes(rfNodes);
    setEdges(rfEdges);
    setIsNLModalOpen(false);
    setNlResult(null);
    setNlPrompt('');
    setSaveStatus('unsaved');
  };

  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  // Filter node library
  const filteredNodeCategories = useMemo(() => {
    const q = nodeSearchQuery.toLowerCase();
    const categories: Record<NodeCategory, FlowNodeType[]> = {
      ai: ['ai_agent', 'multi_agent_task', 'ai_prompt', 'ai_review', 'ai_transform', 'ai_classifier'],
      context: ['search_workspace', 'read_file', 'search_files', 'get_project_info', 'build_context'],
      logic: ['condition', 'switch', 'merge', 'loop', 'delay', 'parallel'],
      io: ['manual_trigger', 'text_input', 'file_input', 'variable', 'output', 'notification'],
      dev: ['run_tests', 'run_typecheck', 'run_build', 'git_status', 'git_diff', 'create_git_commit']
    };

    const result: Record<string, FlowNodeType[]> = {};
    for (const [cat, types] of Object.entries(categories)) {
      const matched = types.filter((t) => {
        const def = NODE_REGISTRY[t];
        return (
          t.toLowerCase().includes(q) ||
          def.name.toLowerCase().includes(q) ||
          def.description.toLowerCase().includes(q)
        );
      });
      if (matched.length > 0) {
        result[cat] = matched;
      }
    }
    return result;
  }, [nodeSearchQuery]);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden select-none">
      {/* 1. Top Toolbar */}
      <div className="h-12 border-b border-border bg-card/60 backdrop-blur-md px-4 flex items-center justify-between gap-4">
        {/* Left: Workflow Title & Save Indicator */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={workflowName}
            onChange={(e) => {
              setWorkflowName(e.target.value);
              setSaveStatus('unsaved');
            }}
            className="text-sm font-semibold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 py-0.5 rounded transition-all max-w-xs"
            placeholder="Workflow Name"
          />

          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              saveStatus === 'saved'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : saveStatus === 'saving'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-muted text-muted-foreground border-border'
            }`}
          >
            {saveStatus}
          </span>
        </div>

        {/* Center: Controls & Actions */}
        <div className="flex items-center gap-2">
          {/* Execution Controls */}
          {isExecuting ? (
            <button
              onClick={handleCancelWorkflow}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-medium transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          ) : (
            <button
              onClick={handleRunWorkflow}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Flow</span>
            </button>
          )}

          {/* AI Generator Button */}
          <button
            onClick={() => setIsNLModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/30 rounded-lg text-xs font-medium transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Prompt</span>
          </button>

          {/* Templates Picker */}
          <button
            onClick={() => setIsTemplatesModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-xs font-medium transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Templates</span>
          </button>

          {/* Save Button */}
          <button
            onClick={handleSaveWorkflow}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-xs font-medium transition-colors"
          >
            <Save className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Save</span>
          </button>
        </div>

        {/* Right: UI Mode & Monitor Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUiMode(uiMode === 'simple' ? 'advanced' : 'simple')}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
              uiMode === 'advanced'
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'bg-muted text-muted-foreground border-border'
            }`}
          >
            {uiMode === 'advanced' ? 'Advanced' : 'Simple'}
          </button>

          <button
            onClick={() => setIsBottomOpen(!isBottomOpen)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded border transition-colors ${
              isBottomOpen
                ? 'bg-secondary text-foreground border-border'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Logs</span>
          </button>
        </div>
      </div>

      {/* 2. Main Workspace Layout: Library | Canvas | Inspector */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Node Library */}
        <div className="w-64 border-r border-border bg-card/40 flex flex-col overflow-hidden">
          {/* Library Search */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search nodes..."
                value={nodeSearchQuery}
                onChange={(e) => setNodeSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Category List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
            {Object.entries(filteredNodeCategories).map(([cat, types]) => (
              <div key={cat} className="space-y-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  {cat.toUpperCase()} NODES ({types.length})
                </span>
                <div className="space-y-1">
                  {types.map((t) => {
                    const def = NODE_REGISTRY[t];
                    return (
                      <button
                        key={t}
                        onClick={() => handleAddNode(t)}
                        className="w-full text-left p-2 rounded-lg bg-background hover:bg-secondary/70 border border-border/60 hover:border-border transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Plus className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                          <div className="overflow-hidden">
                            <p className="font-medium text-foreground truncate">{def.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{def.description}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center: React Flow Canvas */}
        <div className="flex-1 h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.2}
            maxZoom={2.5}
            className="bg-dot-pattern"
          >
            <Background gap={16} size={1} color="rgba(255, 255, 255, 0.08)" />
            <Controls className="!bg-card !border-border !text-foreground rounded-lg shadow-md" />
            <MiniMap
              className="!bg-card !border-border rounded-lg overflow-hidden shadow-md"
              nodeColor={() => '#6366f1'}
              maskColor="rgba(0, 0, 0, 0.4)"
            />
          </ReactFlow>
        </div>

        {/* Right: Node / Workflow Properties Inspector */}
        {selectedNode && (
          <div className="w-80 border-l border-border bg-card/60 backdrop-blur-md flex flex-col overflow-hidden">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Node Properties</span>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Node Label */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Label</label>
                <input
                  type="text"
                  value={selectedNode.data.label as string}
                  onChange={(e) => {
                    const newLabel = e.target.value;
                    setNodes((nds) =>
                      nds.map((n) =>
                        n.id === selectedNode.id
                          ? { ...n, data: { ...n.data, label: newLabel } }
                          : n
                      )
                    );
                    setSaveStatus('unsaved');
                  }}
                  className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary text-xs"
                />
              </div>

              {/* Node Config Fields */}
              {selectedNode.data.config && Object.keys(selectedNode.data.config).length > 0 && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Configuration Parameters
                  </span>

                  {Object.entries(selectedNode.data.config as Record<string, any>).map(([k, v]) => (
                    <div key={k} className="space-y-1">
                      <label className="text-[11px] font-mono text-muted-foreground capitalize">{k}</label>
                      {typeof v === 'boolean' ? (
                        <input
                          type="checkbox"
                          checked={v}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setNodes((nds) =>
                              nds.map((n) =>
                                n.id === selectedNode.id
                                  ? { ...n, data: { ...n.data, config: { ...(n.data.config as any), [k]: val } } }
                                  : n
                              )
                            );
                            setSaveStatus('unsaved');
                          }}
                          className="rounded border-border"
                        />
                      ) : (
                        <input
                          type="text"
                          value={String(v)}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNodes((nds) =>
                              nds.map((n) =>
                                n.id === selectedNode.id
                                  ? { ...n, data: { ...n.data, config: { ...(n.data.config as any), [k]: val } } }
                                  : n
                              )
                            );
                            setSaveStatus('unsaved');
                          }}
                          className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary text-xs"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Advanced Mode: Permissions Inspection */}
              {uiMode === 'advanced' && (selectedNode.data as any).requiredPermissions && (
                <div className="space-y-2 pt-2 border-t border-border text-[11px]">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Required Permissions
                  </span>
                  <div className="bg-background border border-border rounded-lg p-2.5 space-y-1 font-mono text-[10px]">
                    <p>Filesystem: Read: {String((selectedNode.data as any).requiredPermissions.filesystem.read)}, Write: {String((selectedNode.data as any).requiredPermissions.filesystem.write)}</p>
                    <p>Terminal: Exec: {String((selectedNode.data as any).requiredPermissions.terminal.execute)}</p>
                    <p>Network: Allowed: {String((selectedNode.data as any).requiredPermissions.network.allowed)}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 border-t border-border flex items-center justify-between">
                <button
                  onClick={() => {
                    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
                    setSelectedNodeId(null);
                    setSaveStatus('unsaved');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg text-xs font-medium transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Node</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Bottom Execution Logs Drawer */}
      {isBottomOpen && (
        <div className="h-48 border-t border-border bg-card/90 backdrop-blur-md flex flex-col overflow-hidden">
          <div className="h-8 border-b border-border px-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Execution Monitor</span>
              {isExecuting && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
            </div>
            <button
              onClick={() => setIsBottomOpen(false)}
              className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 font-mono text-xs text-muted-foreground space-y-1">
            {executionLogs.length === 0 ? (
              <p className="text-muted-foreground/60 italic">No execution events yet. Click 'Run Flow' to begin.</p>
            ) : (
              executionLogs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-muted-foreground/50">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className={log.type.includes('failed') ? 'text-rose-400' : log.type.includes('completed') ? 'text-emerald-400' : 'text-foreground'}>
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. Natural Language Workflow Generator Modal */}
      {isNLModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">AI Workflow Generator</h3>
                  <p className="text-xs text-muted-foreground">Describe your automation goal to generate an editable workflow.</p>
                </div>
              </div>
              <button
                onClick={() => setIsNLModalOpen(false)}
                className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <textarea
                value={nlPrompt}
                onChange={(e) => setNlPrompt(e.target.value)}
                placeholder="Example: Whenever I begin working, inspect recent git diffs, run TypeScript typechecking, analyze potential security issues, and summarize everything..."
                className="w-full h-28 p-3 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              />

              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-muted-foreground text-[11px]">Quick Prompts:</span>
                <button
                  onClick={() => setNlPrompt('Scan the codebase for security flaws and unencrypted secrets.')}
                  className="px-2 py-1 bg-secondary hover:bg-secondary/80 rounded border border-border text-[11px] text-foreground"
                >
                  Security Audit
                </button>
                <button
                  onClick={() => setNlPrompt('Run tests and diagnose any failure logs.')}
                  className="px-2 py-1 bg-secondary hover:bg-secondary/80 rounded border border-border text-[11px] text-foreground"
                >
                  Test Diagnostics
                </button>
                <button
                  onClick={() => setNlPrompt('Inspect git diff and perform automated adversarial review.')}
                  className="px-2 py-1 bg-secondary hover:bg-secondary/80 rounded border border-border text-[11px] text-foreground"
                >
                  Pre-Commit Review
                </button>
              </div>

              {nlResult && (
                <div className="p-3 bg-background border border-border rounded-lg space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{nlResult.name}</span>
                    <span className="text-muted-foreground text-[10px]">{nlResult.nodes.length} Nodes</span>
                  </div>
                  <p className="text-muted-foreground">{nlResult.explanation}</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex items-center justify-end gap-2">
              <button
                onClick={() => setIsNLModalOpen(false)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              {nlResult ? (
                <button
                  onClick={handleApplyNLWorkflow}
                  className="px-4 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-semibold"
                >
                  Apply to Canvas
                </button>
              ) : (
                <button
                  onClick={handleGenerateFromPrompt}
                  disabled={isGeneratingNL || !nlPrompt.trim()}
                  className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  {isGeneratingNL ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Generate DAG</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Built-in Templates Modal */}
      {isTemplatesModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Built-in Workflow Templates</h3>
                <p className="text-xs text-muted-foreground">Select a ready-to-run automation template.</p>
              </div>
              <button
                onClick={() => setIsTemplatesModalOpen(false)}
                className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 grid grid-cols-2 gap-3 overflow-y-auto flex-1">
              {workflowTemplates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => {
                    selectWorkflow(tmpl);
                    setIsTemplatesModalOpen(false);
                  }}
                  className="text-left p-3.5 rounded-xl bg-background hover:bg-secondary/70 border border-border hover:border-primary transition-all flex flex-col justify-between group space-y-2"
                >
                  <div>
                    <h4 className="font-semibold text-foreground text-xs group-hover:text-primary transition-colors">
                      {tmpl.name}
                    </h4>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
                      {tmpl.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-secondary">{tmpl.nodes.length} Nodes</span>
                    <span className="px-1.5 py-0.5 rounded bg-secondary">{tmpl.edges.length} Edges</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
