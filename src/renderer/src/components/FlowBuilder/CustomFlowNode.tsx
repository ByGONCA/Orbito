import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Sparkles,
  Bot,
  Terminal,
  FileCode,
  Search,
  FolderTree,
  GitBranch,
  GitCommit,
  GitCompare,
  Sliders,
  Split,
  Layers,
  Repeat,
  Clock,
  Play,
  Type,
  FileText,
  Variable,
  CheckCircle2,
  Bell,
  Check,
  XCircle,
  AlertCircle,
  ShieldCheck,
  CheckCheck
} from 'lucide-react';
import type { FlowNodeData } from '../../../../shared/workflows';

const CATEGORY_COLORS = {
  ai: {
    bg: 'bg-white/[0.04]',
    border: 'border-white/[0.12]',
    text: 'text-[#ECEDEF]',
    glow: 'shadow-sm'
  },
  context: {
    bg: 'bg-white/[0.03]',
    border: 'border-white/[0.10]',
    text: 'text-[#A4A8AF]',
    glow: 'shadow-sm'
  },
  logic: {
    bg: 'bg-white/[0.04]',
    border: 'border-white/[0.12]',
    text: 'text-[#ECEDEF]',
    glow: 'shadow-sm'
  },
  io: {
    bg: 'bg-white/[0.03]',
    border: 'border-white/[0.10]',
    text: 'text-[#A4A8AF]',
    glow: 'shadow-sm'
  },
  dev: {
    bg: 'bg-white/[0.04]',
    border: 'border-white/[0.12]',
    text: 'text-[#ECEDEF]',
    glow: 'shadow-sm'
  }
};

const NODE_ICONS: Record<string, React.ElementType> = {
  ai_agent: Bot,
  multi_agent_task: Layers,
  ai_prompt: Sparkles,
  ai_review: ShieldCheck,
  ai_transform: Sliders,
  ai_classifier: Split,

  search_workspace: Search,
  read_file: FileText,
  search_files: FolderTree,
  get_project_info: FileCode,
  build_context: Layers,

  condition: Split,
  switch: Sliders,
  merge: Layers,
  loop: Repeat,
  delay: Clock,
  parallel: Split,

  manual_trigger: Play,
  text_input: Type,
  file_input: FileText,
  variable: Variable,
  output: CheckCircle2,
  notification: Bell,

  run_tests: CheckCheck,
  run_typecheck: FileCode,
  run_build: Terminal,
  git_status: GitBranch,
  git_diff: GitCompare,
  create_git_commit: GitCommit
};

export const CustomFlowNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const nodeData = data as unknown as FlowNodeData;
  const category = nodeData.category || 'ai';
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.ai;
  const Icon = NODE_ICONS[nodeData.nodeType] || Sparkles;

  const isRunning = nodeData.status === 'running';
  const isCompleted = nodeData.status === 'completed';
  const isFailed = nodeData.status === 'failed';
  const isSkipped = nodeData.status === 'skipped';

  return (
    <div
      className={`min-w-[220px] max-w-[280px] rounded-xl border bg-card/95 backdrop-blur-md transition-all shadow-md ${
        selected ? 'ring-2 ring-primary border-primary shadow-lg' : color.border
      } ${isRunning ? 'animate-pulse ring-2 ring-sky-500 border-sky-500 shadow-sky-500/30' : ''} ${
        isSkipped ? 'opacity-40 border-dashed' : ''
      }`}
    >
      {/* Node Header */}
      <div className={`px-3 py-2 border-b ${color.border} flex items-center justify-between ${color.bg} rounded-t-xl`}>
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-md ${color.bg} ${color.text}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-foreground truncate max-w-[140px]">
            {nodeData.label || nodeData.nodeType}
          </span>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-1">
          {isRunning && <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />}
          {isCompleted && <Check className="w-3.5 h-3.5 text-emerald-400" />}
          {isFailed && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
          {isSkipped && <span className="text-[10px] text-muted-foreground uppercase font-mono">skip</span>}
          {!isRunning && !isCompleted && !isFailed && !isSkipped && (
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
          )}
        </div>
      </div>

      {/* Node Body */}
      <div className="p-3 text-[11px] text-muted-foreground space-y-2">
        <p className="line-clamp-2 leading-relaxed">{nodeData.description}</p>

        {/* Input Handles */}
        <div className="space-y-1 pt-1">
          {nodeData.inputs?.map((input, idx) => (
            <div key={input.id} className="relative flex items-center text-[10px] text-muted-foreground h-5">
              <Handle
                type="target"
                position={Position.Left}
                id={input.id}
                className="!w-2.5 !h-2.5 !bg-primary !border-2 !border-background hover:!scale-125 transition-transform"
                style={{ top: `${(idx + 1) * 20 + 35}px` }}
              />
              <span className="pl-1 truncate">{input.name}</span>
            </div>
          ))}
        </div>

        {/* Output Handles */}
        <div className="space-y-1">
          {nodeData.outputs?.map((output, idx) => (
            <div key={output.id} className="relative flex items-center justify-end text-[10px] text-muted-foreground h-5">
              <span className="pr-1 truncate">{output.name}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={output.id}
                className="!w-2.5 !h-2.5 !bg-accent-foreground !border-2 !border-background hover:!scale-125 transition-transform"
                style={{ top: `${(idx + 1) * 20 + 35}px` }}
              />
            </div>
          ))}
        </div>

        {/* Error message if failed */}
        {nodeData.errorMessage && (
          <div className="mt-1 p-1.5 bg-rose-500/10 border border-rose-500/30 rounded text-[10px] text-rose-400 flex items-start gap-1">
            <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span className="truncate">{nodeData.errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
});
CustomFlowNode.displayName = 'CustomFlowNode';
