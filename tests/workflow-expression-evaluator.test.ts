import { describe, it, expect } from 'vitest';
import { ExpressionEvaluator } from '../src/main/workflows/expression-evaluator';

describe('ExpressionEvaluator (Safe Sandboxed Evaluation)', () => {
  it('evaluates boolean literals and comparisons', () => {
    expect(ExpressionEvaluator.evaluate('true')).toBe(true);
    expect(ExpressionEvaluator.evaluate('false')).toBe(false);
    expect(ExpressionEvaluator.evaluate('10 > 5')).toBe(true);
    expect(ExpressionEvaluator.evaluate('5 <= 5')).toBe(true);
    expect(ExpressionEvaluator.evaluate('10 == 10')).toBe(true);
    expect(ExpressionEvaluator.evaluate('10 != 5')).toBe(true);
    expect(ExpressionEvaluator.evaluate("'hello' == 'hello'")).toBe(true);
    expect(ExpressionEvaluator.evaluate("'hello' != 'world'")).toBe(true);
  });

  it('evaluates context variables and nested properties', () => {
    const context = {
      user: {
        role: 'admin',
        score: 85
      },
      hasChanges: true,
      exitCode: 0
    };

    expect(ExpressionEvaluator.evaluate('hasChanges == true', context)).toBe(true);
    expect(ExpressionEvaluator.evaluate('exitCode == 0', context)).toBe(true);
    expect(ExpressionEvaluator.evaluate("user.role == 'admin'", context)).toBe(true);
    expect(ExpressionEvaluator.evaluate('user.score >= 80', context)).toBe(true);
    expect(ExpressionEvaluator.evaluate('user.score < 50', context)).toBe(false);
  });

  it('evaluates compound logical operators (&& and ||)', () => {
    const context = { status: 'passed', count: 12 };

    expect(
      ExpressionEvaluator.evaluate("status == 'passed' && count > 10", context)
    ).toBe(true);

    expect(
      ExpressionEvaluator.evaluate("status == 'failed' || count > 10", context)
    ).toBe(true);

    expect(
      ExpressionEvaluator.evaluate("status == 'failed' && count > 10", context)
    ).toBe(false);
  });

  it('supports helper functions (contains, startsWith, length, isEmpty)', () => {
    const context = {
      filename: 'auth.service.ts',
      tags: ['security', 'auth', 'database'],
      emptyList: [],
      emptyStr: ''
    };

    expect(ExpressionEvaluator.evaluate("contains(filename, 'auth')", context)).toBe(true);
    expect(ExpressionEvaluator.evaluate("startsWith(filename, 'auth')", context)).toBe(true);
    expect(ExpressionEvaluator.evaluate("contains(tags, 'security')", context)).toBe(true);
    expect(ExpressionEvaluator.evaluate('length(tags) == 3', context)).toBe(true);
    expect(ExpressionEvaluator.evaluate('isEmpty(emptyList)', context)).toBe(true);
    expect(ExpressionEvaluator.evaluate('isEmpty(emptyStr)', context)).toBe(true);
  });

  it('safely handles syntax anomalies without crashing or using eval', () => {
    // Malicious or malformed inputs
    expect(ExpressionEvaluator.evaluate('alert(1)')).toBe(null);
    expect(ExpressionEvaluator.evaluate('process.exit()')).toBe(undefined);
    expect(ExpressionEvaluator.evaluate('function() { return true; }()')).toBe(null);
  });
});
