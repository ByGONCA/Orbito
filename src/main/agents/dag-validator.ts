import type { OrchestrationTask } from '../../shared/agents';

export interface DAGValidationResult {
  valid: boolean;
  errors: string[];
  topologicalOrder?: string[];
  levels?: string[][]; // Array of parallel task ID batches
}

export class DAGValidator {
  /**
   * Validates tasks DAG for cycles, missing dependencies, and self-referencing.
   */
  public static validate(tasks: OrchestrationTask[]): DAGValidationResult {
    const errors: string[] = [];

    if (!tasks || tasks.length === 0) {
      return { valid: false, errors: ['Task graph is empty. At least one task is required.'] };
    }

    const taskMap = new Map<string, OrchestrationTask>();
    const taskIds = new Set<string>();

    // 1. Check duplicate IDs and populate map
    for (const t of tasks) {
      if (taskIds.has(t.id)) {
        errors.push(`Duplicate task ID detected: "${t.id}"`);
      }
      taskIds.add(t.id);
      taskMap.set(t.id, t);
    }

    // 2. Check self-dependencies and missing dependencies
    for (const t of tasks) {
      for (const dep of t.dependencies) {
        if (dep === t.id) {
          errors.push(`Task "${t.id}" has a self-dependency.`);
        }
        if (!taskMap.has(dep)) {
          errors.push(`Task "${t.id}" depends on non-existent task: "${dep}".`);
        }
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // 3. Cycle Detection using Kahn's Algorithm
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    for (const t of tasks) {
      inDegree.set(t.id, t.dependencies.length);
      adjList.set(t.id, []);
    }

    for (const t of tasks) {
      for (const dep of t.dependencies) {
        adjList.get(dep)!.push(t.id);
      }
    }

    const queue: string[] = [];
    const levelMap = new Map<string, number>();

    for (const [id, deg] of inDegree) {
      if (deg === 0) {
        queue.push(id);
        levelMap.set(id, 0);
      }
    }

    const topologicalOrder: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      topologicalOrder.push(current);
      const currentLevel = levelMap.get(current) || 0;

      for (const neighbor of adjList.get(current)!) {
        const nextDeg = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, nextDeg);

        const existingNeighborLevel = levelMap.get(neighbor) || 0;
        levelMap.set(neighbor, Math.max(existingNeighborLevel, currentLevel + 1));

        if (nextDeg === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (topologicalOrder.length !== tasks.length) {
      const unvisited = tasks.filter((t) => !topologicalOrder.includes(t.id)).map((t) => t.id);
      errors.push(`Circular dependency (cycle) detected among tasks: ${unvisited.join(', ')}`);
      return { valid: false, errors };
    }

    // Group into levels
    const maxLevel = Math.max(...Array.from(levelMap.values()), 0);
    const levels: string[][] = [];
    for (let i = 0; i <= maxLevel; i++) {
      levels.push([]);
    }

    for (const [id, lvl] of levelMap) {
      levels[lvl].push(id);
    }

    return {
      valid: true,
      errors: [],
      topologicalOrder,
      levels
    };
  }

  /**
   * Checks if a transition between two task statuses is permissible.
   */
  public static isValidTransition(current: string, next: string): boolean {
    const ALLOWED_TRANSITIONS: Record<string, string[]> = {
      pending: ['ready', 'blocked', 'cancelled'],
      ready: ['running', 'blocked', 'cancelled'],
      running: ['waiting_approval', 'reviewing', 'completed', 'failed', 'cancelled'],
      waiting_approval: ['running', 'completed', 'failed', 'cancelled'],
      reviewing: ['completed', 'running', 'failed', 'cancelled'],
      failed: ['ready', 'pending', 'cancelled'], // Retryable
      blocked: ['ready', 'pending', 'cancelled'],
      completed: [],
      cancelled: []
    };

    const allowed = ALLOWED_TRANSITIONS[current] || [];
    return allowed.includes(next);
  }
}
