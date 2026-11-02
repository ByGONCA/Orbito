/**
 * Safe Restricted Expression Evaluator.
 * Parses and evaluates simple boolean logic, comparisons, and property access
 * without ever resorting to `eval()` or `Function()`.
 */

export interface EvaluationContext {
  [key: string]: any;
}

export class ExpressionEvaluator {
  /**
   * Safely evaluate an expression string against a given context object.
   * If parsing fails or an invalid expression is encountered, returns false or throws.
   */
  public static evaluate(expr: string, context: EvaluationContext = {}): any {
    const trimmed = (expr || '').trim();
    if (!trimmed) return true; // Empty expression defaults to true

    try {
      return this.evaluateOr(trimmed, context);
    } catch {
      // In case of syntax anomaly, safely fallback to falsy
      return false;
    }
  }

  // Handle Logical OR ('||')
  private static evaluateOr(expr: string, context: EvaluationContext): any {
    const parts = this.splitByOperator(expr, '||');
    if (parts.length > 1) {
      for (const part of parts) {
        if (Boolean(this.evaluateAnd(part, context))) {
          return true;
        }
      }
      return false;
    }
    return this.evaluateAnd(expr, context);
  }

  // Handle Logical AND ('&&')
  private static evaluateAnd(expr: string, context: EvaluationContext): any {
    const parts = this.splitByOperator(expr, '&&');
    if (parts.length > 1) {
      for (const part of parts) {
        if (!Boolean(this.evaluateComparison(part, context))) {
          return false;
        }
      }
      return true;
    }
    return this.evaluateComparison(expr, context);
  }

  // Handle Comparisons: '==', '!=', '<=', '>=', '<', '>'
  private static evaluateComparison(expr: string, context: EvaluationContext): any {
    const trimmed = expr.trim();

    // Check operators in order of length to avoid splitting '<=' by '<'
    const ops = ['==', '!=', '<=', '>=', '<', '>'];
    for (const op of ops) {
      const idx = this.findOperatorIndex(trimmed, op);
      if (idx !== -1) {
        const leftStr = trimmed.slice(0, idx).trim();
        const rightStr = trimmed.slice(idx + op.length).trim();
        const leftVal = this.evaluateAtom(leftStr, context);
        const rightVal = this.evaluateAtom(rightStr, context);

        switch (op) {
          case '==':
            return leftVal === rightVal;
          case '!=':
            return leftVal !== rightVal;
          case '<=':
            return leftVal <= rightVal;
          case '>=':
            return leftVal >= rightVal;
          case '<':
            return leftVal < rightVal;
          case '>':
            return leftVal > rightVal;
        }
      }
    }

    // Single atom/boolean
    return this.evaluateAtom(trimmed, context);
  }

  // Evaluate single atoms: literals, functions, identifiers, or negation
  private static evaluateAtom(raw: string, context: EvaluationContext): any {
    const str = raw.trim();

    // Negation '!'
    if (str.startsWith('!') && !str.startsWith('!=')) {
      return !Boolean(this.evaluateAtom(str.slice(1), context));
    }

    // Boolean literals
    if (str === 'true') return true;
    if (str === 'false') return false;
    if (str === 'null' || str === 'undefined') return null;

    // Number literals
    if (/^-?\d+(\.\d+)?$/.test(str)) {
      return parseFloat(str);
    }

    // String literals ('string' or "string")
    if (
      (str.startsWith("'") && str.endsWith("'")) ||
      (str.startsWith('"') && str.endsWith('"'))
    ) {
      return str.slice(1, -1);
    }

    // Built-in functions: contains(a, b), startsWith(a, b), length(a), isEmpty(a)
    const fnMatch = str.match(/^([a-zA-Z_]\w*)\((.*)\)$/);
    if (fnMatch) {
      const fnName = fnMatch[1];
      const argsRaw = fnMatch[2];
      const args = this.splitArgs(argsRaw).map((a) => this.evaluateAtom(a, context));

      switch (fnName) {
        case 'contains':
          if (typeof args[0] === 'string' && typeof args[1] === 'string') {
            return args[0].toLowerCase().includes(args[1].toLowerCase());
          }
          if (Array.isArray(args[0])) {
            return args[0].includes(args[1]);
          }
          return false;
        case 'startsWith':
          return typeof args[0] === 'string' && typeof args[1] === 'string'
            ? args[0].startsWith(args[1])
            : false;
        case 'length':
          if (Array.isArray(args[0]) || typeof args[0] === 'string') {
            return args[0].length;
          }
          return 0;
        case 'isEmpty':
          if (args[0] === null || args[0] === undefined) return true;
          if (typeof args[0] === 'string' || Array.isArray(args[0])) return args[0].length === 0;
          if (typeof args[0] === 'object') return Object.keys(args[0]).length === 0;
          return false;
        default:
          return null;
      }
    }

    // Property path resolution: 'result.status' or 'value'
    return this.resolvePath(str, context);
  }

  private static resolvePath(path: string, context: EvaluationContext): any {
    if (!path) return undefined;
    const parts = path.split('.');
    let current = context;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      // Security: Block prototype poisoning and function constructor access
      if (part === '__proto__' || part === 'prototype' || part === 'constructor') {
        return undefined;
      }
      if (!Object.prototype.hasOwnProperty.call(current, part) && !(part in current)) {
        return undefined;
      }
      current = current[part];
    }
    return current;
  }

  private static splitByOperator(expr: string, op: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuote: string | null = null;
    let parenDepth = 0;

    for (let i = 0; i < expr.length; i++) {
      const char = expr[i];

      if (char === "'" || char === '"') {
        if (!inQuote) inQuote = char;
        else if (inQuote === char) inQuote = null;
      } else if (!inQuote) {
        if (char === '(') parenDepth++;
        else if (char === ')') parenDepth--;
        else if (parenDepth === 0 && expr.startsWith(op, i)) {
          parts.push(current.trim());
          current = '';
          i += op.length - 1;
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts;
  }

  private static findOperatorIndex(expr: string, op: string): number {
    let inQuote: string | null = null;
    let parenDepth = 0;

    for (let i = 0; i < expr.length; i++) {
      const char = expr[i];

      if (char === "'" || char === '"') {
        if (!inQuote) inQuote = char;
        else if (inQuote === char) inQuote = null;
      } else if (!inQuote) {
        if (char === '(') parenDepth++;
        else if (char === ')') parenDepth--;
        else if (parenDepth === 0 && expr.startsWith(op, i)) {
          // Ensure we don't accidentally match part of '==' as '=' or similar
          if (op === '<' && expr[i + 1] === '=') continue;
          if (op === '>' && expr[i + 1] === '=') continue;
          if (op === '!' && expr[i + 1] === '=') continue;
          return i;
        }
      }
    }
    return -1;
  }

  private static splitArgs(argsRaw: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuote: string | null = null;
    let parenDepth = 0;

    for (let i = 0; i < argsRaw.length; i++) {
      const char = argsRaw[i];
      if (char === "'" || char === '"') {
        if (!inQuote) inQuote = char;
        else if (inQuote === char) inQuote = null;
      } else if (!inQuote) {
        if (char === '(') parenDepth++;
        else if (char === ')') parenDepth--;
        else if (char === ',' && parenDepth === 0) {
          args.push(current.trim());
          current = '';
          continue;
        }
      }
      current += char;
    }
    if (current.trim()) {
      args.push(current.trim());
    }
    return args;
  }
}
