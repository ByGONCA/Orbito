import type { FlowNode, FlowEdge } from '../../shared/workflows';
import { NODE_REGISTRY } from './node-registry';

export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  topologicalOrder?: string[];
  levels?: string[][]; // Batches of node IDs that can run concurrently
}

export class WorkflowValidator {
  /**
   * Validates a workflow graph: structure, port connectivity, data types, and cycle-free DAG topology.
   */
  public static validate(nodes: FlowNode[], edges: FlowEdge[]): WorkflowValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!nodes || nodes.length === 0) {
      return { valid: false, errors: ['Workflow canvas is empty. Add at least one node.'], warnings };
    }

    const nodeMap = new Map<string, FlowNode>();
    const nodeIds = new Set<string>();

    // 1. Check duplicate IDs & populate map
    for (const node of nodes) {
      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node ID detected: "${node.id}".`);
      }
      nodeIds.add(node.id);
      nodeMap.set(node.id, node);

      // Validate node type is recognized
      const def = NODE_REGISTRY[node.data.nodeType];
      if (!def) {
        errors.push(`Unrecognized node type: "${node.data.nodeType}" on node "${node.id}".`);
      }
    }

    // 2. Validate Edge Connectivity & Ports
    for (const edge of edges || []) {
      if (!nodeMap.has(edge.source)) {
        errors.push(`Edge references missing source node: "${edge.source}".`);
      }
      if (!nodeMap.has(edge.target)) {
        errors.push(`Edge references missing target node: "${edge.target}".`);
      }
      if (edge.source === edge.target) {
        errors.push(`Self-referencing loop connection detected on node "${edge.source}".`);
      }

      // Check port types if handles are specified
      if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
        const sourceNode = nodeMap.get(edge.source)!;
        const targetNode = nodeMap.get(edge.target)!;
        const sourceDef = NODE_REGISTRY[sourceNode.data.nodeType];
        const targetDef = NODE_REGISTRY[targetNode.data.nodeType];

        if (sourceDef && targetDef && edge.sourceHandle && edge.targetHandle) {
          const sourcePort = sourceDef.outputs.find((p) => p.id === edge.sourceHandle);
          const targetPort = targetDef.inputs.find((p) => p.id === edge.targetHandle);

          if (!sourcePort) {
            warnings.push(
              `Edge from "${sourceNode.data.label}" references unknown output handle: "${edge.sourceHandle}".`
            );
          }
          if (!targetPort) {
            warnings.push(
              `Edge to "${targetNode.data.label}" references unknown input handle: "${edge.targetHandle}".`
            );
          }

          if (sourcePort && targetPort) {
            const compatible = this.isTypeCompatible(sourcePort.type, targetPort.type);
            if (!compatible) {
              warnings.push(
                `Type mismatch on connection: "${sourceNode.data.label}.${sourcePort.name}" (${sourcePort.type}) -> "${targetNode.data.label}.${targetPort.name}" (${targetPort.type}).`
              );
            }
          }
        }
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors, warnings };
    }

    // 3. Cycle Detection & Topological Ordering via Kahn's Algorithm
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    for (const node of nodes) {
      inDegree.set(node.id, 0);
      adjList.set(node.id, []);
    }

    for (const edge of edges || []) {
      // Direct edge from source to target
      adjList.get(edge.source)!.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    // Find all nodes with inDegree 0 (no prerequisites)
    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) {
        queue.push(id);
      }
    }

    const topologicalOrder: string[] = [];
    const levels: string[][] = [];
    let currentLevelNodes = [...queue];

    while (currentLevelNodes.length > 0) {
      levels.push([...currentLevelNodes]);
      const nextLevelNodes: string[] = [];

      for (const nodeId of currentLevelNodes) {
        topologicalOrder.push(nodeId);

        for (const neighborId of adjList.get(nodeId) || []) {
          const newDeg = inDegree.get(neighborId)! - 1;
          inDegree.set(neighborId, newDeg);
          if (newDeg === 0) {
            nextLevelNodes.push(neighborId);
          }
        }
      }

      currentLevelNodes = nextLevelNodes;
    }

    if (topologicalOrder.length !== nodes.length) {
      const remainingNodes = nodes
        .filter((n) => !topologicalOrder.includes(n.id))
        .map((n) => `"${n.data.label}" (${n.id})`);
      errors.push(
        `Cyclic dependency detected in workflow! The following nodes are involved in a cycle: ${remainingNodes.join(', ')}.`
      );
      return { valid: false, errors, warnings };
    }

    // 4. Validate Configuration constraints
    for (const node of nodes) {
      if (node.data.nodeType === 'loop') {
        const iters = Number(node.data.config.maxIterations || 10);
        if (iters > 50) {
          warnings.push(`Loop node "${node.data.label}" specifies maxIterations > 50. Clamped to 50 for safety.`);
        }
        if (iters < 1) {
          errors.push(`Loop node "${node.data.label}" specifies invalid maxIterations < 1.`);
        }
      }
      if (node.data.nodeType === 'delay') {
        const ms = Number(node.data.config.delayMs || 1000);
        if (ms > 60000) {
          warnings.push(`Delay node "${node.data.label}" specifies delayMs > 60000ms. Clamped to 60s.`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      topologicalOrder,
      levels
    };
  }

  private static isTypeCompatible(src: string, tgt: string): boolean {
    if (src === 'any' || tgt === 'any') return true;
    if (src === tgt) return true;
    if (src === 'json' && (tgt === 'object' || tgt === 'string')) return true;
    if (src === 'object' && tgt === 'json') return true;
    if (src === 'file_ref' && tgt === 'string') return true;
    if (src === 'agent_result' && (tgt === 'string' || tgt === 'object')) return true;
    return false;
  }
}
