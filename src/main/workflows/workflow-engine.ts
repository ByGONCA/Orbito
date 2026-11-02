import { BrowserWindow } from 'electron';
import type {
  WorkflowRecord,
  WorkflowExecutionRecord,
  WorkflowEvent,
  NodeExecutionStatus,
  FlowNode,
  FlowEdge
} from '../../shared/workflows';
import { WorkflowValidator } from './workflow-validator';
import { NODE_EXECUTORS, type NodeExecutionContext } from './node-executors';
import { databaseService } from '../db/database.service';
import { SkillPermissionManager, type WorkspacePermissionTier } from '../skills/skill-permission-manager';
import { airGapManager } from '../services/air-gap.manager';

export class WorkflowEngine {
  private activeExecutions = new Map<string, { cancelled: boolean; workflowId: string }>();

  /**
   * Execute a workflow record end-to-end.
   */
  public async executeWorkflow(
    workflow: WorkflowRecord,
    initialInputs: Record<string, any> = {},
    projectPath: string
  ): Promise<WorkflowExecutionRecord> {
    const executionId = `wf-exec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.activeExecutions.set(executionId, { cancelled: false, workflowId: workflow.id });

    // 1. Validate Workflow
    const validation = WorkflowValidator.validate(workflow.nodes, workflow.edges);
    if (!validation.valid) {
      throw new Error(`Cannot execute invalid workflow: ${validation.errors.join('; ')}`);
    }

    const startTime = Date.now();
    const executionRecord: WorkflowExecutionRecord = {
      id: executionId,
      workflowId: workflow.id,
      projectId: workflow.projectId,
      status: 'running',
      triggerType: workflow.trigger.type,
      inputs: initialInputs,
      outputs: {},
      variables: Object.fromEntries(
        Object.entries(workflow.variables || {}).map(([k, v]) => [k, v.value])
      ),
      durationMs: 0,
      createdAt: startTime
    };

    databaseService.createWorkflowExecution(executionRecord);
    this.broadcastEvent({
      type: 'workflow_started',
      executionId,
      workflowId: workflow.id,
      timestamp: startTime,
      status: 'running'
    });

    // 2. Prepare Execution State
    const nodeOutputs = new Map<string, Record<string, any>>();
    const nodeStatus = new Map<string, NodeExecutionStatus>();
    const skippedNodes = new Set<string>();

    for (const node of workflow.nodes) {
      nodeStatus.set(node.id, 'pending');
    }

    // Build incoming and outgoing edge lookups
    const incomingEdges = new Map<string, typeof workflow.edges>();
    const outgoingEdges = new Map<string, typeof workflow.edges>();

    for (const node of workflow.nodes) {
      incomingEdges.set(node.id, []);
      outgoingEdges.set(node.id, []);
    }

    for (const edge of workflow.edges) {
      incomingEdges.get(edge.target)?.push(edge);
      outgoingEdges.get(edge.source)?.push(edge);
    }

    try {
      // 3. Process execution levels (topological batches)
      for (const level of validation.levels || []) {
        if (this.isCancelled(executionId)) break;

        // Run nodes at this level in parallel
        await Promise.all(
          level.map(async (nodeId) => {
            if (this.isCancelled(executionId)) return;

            const node = workflow.nodes.find((n) => n.id === nodeId);
            if (!node) return;

            // Check if node is skipped directly or via all incoming edges
            const incoming = incomingEdges.get(nodeId) || [];
            const isExplicitlySkipped = skippedNodes.has(nodeId);
            const allIncomingSkipped =
              incoming.length > 0 &&
              node.data.nodeType !== 'merge' &&
              incoming.every((edge) => skippedNodes.has(edge.source));

            if (isExplicitlySkipped || allIncomingSkipped) {
              skippedNodes.add(nodeId);
              nodeStatus.set(nodeId, 'skipped');
              this.broadcastEvent({
                type: 'node_skipped',
                executionId,
                workflowId: workflow.id,
                nodeId,
                nodeType: node.data.nodeType,
                status: 'skipped',
                timestamp: Date.now()
              });
              return;
            }

            // Gather inputs from incoming edges
            const inputs: Record<string, any> = { ...initialInputs };
            for (const edge of incoming) {
              const sourceOuts = nodeOutputs.get(edge.source);
              if (sourceOuts) {
                const outKey = edge.sourceHandle || Object.keys(sourceOuts)[0];
                const inKey = edge.targetHandle || outKey;
                if (outKey && sourceOuts[outKey] !== undefined) {
                  inputs[inKey] = sourceOuts[outKey];
                }
              }
            }

            // Execute node
            await this.executeSingleNode(
              node,
              inputs,
              executionRecord,
              projectPath,
              nodeOutputs,
              nodeStatus,
              skippedNodes,
              outgoingEdges.get(nodeId) || []
            );
          })
        );
      }

      // Check if any node failed
      const hasFailed = Array.from(nodeStatus.values()).some((s) => s === 'failed');
      const finalStatus = this.isCancelled(executionId)
        ? 'cancelled'
        : hasFailed
          ? 'failed'
          : 'completed';

      executionRecord.status = finalStatus;
      executionRecord.durationMs = Date.now() - startTime;
      executionRecord.completedAt = Date.now();

      // Collect outputs from any output nodes
      const outputNodes = workflow.nodes.filter((n) => n.data.nodeType === 'output');
      if (outputNodes.length > 0) {
        for (const outNode of outputNodes) {
          const val = nodeOutputs.get(outNode.id);
          if (val) {
            executionRecord.outputs[outNode.id] = val.value ?? val;
          }
        }
      }

      databaseService.updateWorkflowExecution(executionRecord);
      this.broadcastEvent({
        type: finalStatus === 'completed' ? 'workflow_completed' : finalStatus === 'cancelled' ? 'workflow_cancelled' : 'workflow_failed',
        executionId,
        workflowId: workflow.id,
        timestamp: Date.now(),
        status: finalStatus
      });

      return executionRecord;
    } catch (err: any) {
      executionRecord.status = 'failed';
      executionRecord.errorMessage = err.message;
      executionRecord.durationMs = Date.now() - startTime;
      executionRecord.completedAt = Date.now();
      databaseService.updateWorkflowExecution(executionRecord);

      this.broadcastEvent({
        type: 'workflow_failed',
        executionId,
        workflowId: workflow.id,
        timestamp: Date.now(),
        status: 'failed',
        error: err.message
      });

      return executionRecord;
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Cancel an in-flight workflow execution.
   */
  public async cancelWorkflow(executionId: string): Promise<boolean> {
    const active = this.activeExecutions.get(executionId);
    if (!active) return false;

    active.cancelled = true;
    this.broadcastEvent({
      type: 'workflow_cancelled',
      executionId,
      workflowId: active.workflowId,
      timestamp: Date.now(),
      status: 'cancelled'
    });

    databaseService.updateWorkflowExecutionStatus(executionId, 'cancelled');
    return true;
  }

  private isCancelled(executionId: string): boolean {
    return this.activeExecutions.get(executionId)?.cancelled ?? false;
  }

  private async executeSingleNode(
    node: FlowNode,
    inputs: Record<string, any>,
    execution: WorkflowExecutionRecord,
    projectPath: string,
    nodeOutputs: Map<string, Record<string, any>>,
    nodeStatus: Map<string, NodeExecutionStatus>,
    skippedNodes: Set<string>,
    outgoingEdges: FlowEdge[]
  ): Promise<void> {
    const nodeStartTime = Date.now();
    nodeStatus.set(node.id, 'running');

    this.broadcastEvent({
      type: 'node_started',
      executionId: execution.id,
      workflowId: execution.workflowId,
      nodeId: node.id,
      nodeType: node.data.nodeType,
      status: 'running',
      timestamp: nodeStartTime
    });

    databaseService.recordNodeExecution({
      id: `ne-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      executionId: execution.id,
      nodeId: node.id,
      nodeType: node.data.nodeType,
      status: 'running',
      inputs,
      outputs: {},
      durationMs: 0,
      startedAt: nodeStartTime
    });

    // Check permissions
    if (node.data.requiredPermissions) {
      if (airGapManager.isAirGapEnabled() && node.data.requiredPermissions.network?.allowed) {
        throw new Error(
          `Permission denied for node "${node.data.label}": Network egress is forbidden under active Air-Gap isolation mode.`
        );
      }

      const tier: WorkspacePermissionTier = airGapManager.isAirGapEnabled() ? 'strict' : 'standard';
      const allowed = SkillPermissionManager.evaluate(node.data.requiredPermissions, tier);
      if (!allowed.allowed) {
        throw new Error(
          `Permission denied for node "${node.data.label}": ${allowed.violations.join(', ')}`
        );
      }
    }

    const handler = NODE_EXECUTORS[node.data.nodeType];
    if (!handler) {
      throw new Error(`No execution handler for node type: "${node.data.nodeType}"`);
    }

    const ctx: NodeExecutionContext = {
      projectPath,
      workflowId: execution.workflowId,
      executionId: execution.id,
      variables: execution.variables,
      inputs,
      onLog: (msg) => {
        this.broadcastEvent({
          type: 'node_started',
          executionId: execution.id,
          workflowId: execution.workflowId,
          nodeId: node.id,
          nodeType: node.data.nodeType,
          message: msg,
          timestamp: Date.now()
        });
      }
    };

    try {
      const result = await handler(node, ctx);

      // Handle variable mutations
      if (result.newVariables) {
        Object.assign(execution.variables, result.newVariables);
      }

      nodeOutputs.set(node.id, result.outputs);
      nodeStatus.set(node.id, 'completed');

      // Conditional branching skip logic
      if (result.selectedBranch) {
        for (const edge of outgoingEdges) {
          if (edge.sourceHandle && edge.sourceHandle !== result.selectedBranch) {
            skippedNodes.add(edge.target);
          }
        }
      }

      const durationMs = Date.now() - nodeStartTime;
      databaseService.updateNodeExecution(execution.id, node.id, {
        status: 'completed',
        outputs: result.outputs,
        durationMs,
        completedAt: Date.now()
      });

      this.broadcastEvent({
        type: 'node_completed',
        executionId: execution.id,
        workflowId: execution.workflowId,
        nodeId: node.id,
        nodeType: node.data.nodeType,
        status: 'completed',
        output: result.outputs,
        timestamp: Date.now()
      });
    } catch (err: any) {
      nodeStatus.set(node.id, 'failed');
      const durationMs = Date.now() - nodeStartTime;

      databaseService.updateNodeExecution(execution.id, node.id, {
        status: 'failed',
        errorMessage: err.message,
        durationMs,
        completedAt: Date.now()
      });

      this.broadcastEvent({
        type: 'node_failed',
        executionId: execution.id,
        workflowId: execution.workflowId,
        nodeId: node.id,
        nodeType: node.data.nodeType,
        status: 'failed',
        error: err.message,
        timestamp: Date.now()
      });

      throw err;
    }
  }

  private broadcastEvent(event: WorkflowEvent): void {
    try {
      if (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
          if (!win.isDestroyed()) {
            win.webContents.send('workflows:event', event);
          }
        }
      }
    } catch {
      // Ignore IPC broadcast error in headless test runtimes
    }
  }
}

export const workflowEngine = new WorkflowEngine();
