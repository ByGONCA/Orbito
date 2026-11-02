import { describe, it, expect } from 'vitest';
import { ExpressionEvaluator } from '../src/main/workflows/expression-evaluator';
import { airGapManager } from '../src/main/services/air-gap.manager';

describe('Production Readiness: Performance & Resource Footprint Audit', () => {
  it('measures baseline process memory consumption in runtime', () => {
    const mem = process.memoryUsage();
    const heapUsedMb = mem.heapUsed / (1024 * 1024);
    const rssMb = mem.rss / (1024 * 1024);

    console.log(`[Perf Audit] Baseline Heap Used: ${heapUsedMb.toFixed(2)} MB`);
    console.log(`[Perf Audit] Baseline RSS: ${rssMb.toFixed(2)} MB`);

    expect(heapUsedMb).toBeLessThan(120);
    expect(rssMb).toBeLessThan(350);
  });

  it('measures safe expression evaluation throughput (> 20,000 ops/sec)', () => {
    const iterations = 10000;
    const context = {
      user: { role: 'developer', permissions: ['read', 'write'] },
      result: { code: 0, stdout: 'build completed successfully', durationMs: 1420 },
      flags: { enabled: true, debug: false }
    };

    const expr = 'result.code == 0 && flags.enabled == true && result.durationMs < 5000';

    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) {
      const res = ExpressionEvaluator.evaluate(expr, context);
      if (!res) throw new Error('Evaluation failed unexpectedly');
    }
    const totalMs = performance.now() - t0;
    const opsPerSec = Math.round((iterations / totalMs) * 1000);

    console.log(
      `[Perf Audit] Evaluated ${iterations} expressions in ${totalMs.toFixed(2)}ms (~${opsPerSec.toLocaleString()} ops/sec)`
    );

    expect(opsPerSec).toBeGreaterThan(20000);
  });

  it('measures air-gap destination evaluation throughput (> 50,000 checks/sec)', () => {
    airGapManager.updateConfig({ enabled: true });
    const iterations = 20000;
    const destinations = [
      'http://127.0.0.1:11434',
      'http://localhost:3000',
      'http://127.0.0.2:8080',
      'http://[::1]:11434'
    ];

    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) {
      const dest = destinations[i % destinations.length];
      airGapManager.assertNetworkAllowed(dest);
    }
    const totalMs = performance.now() - t0;
    const checksPerSec = Math.round((iterations / totalMs) * 1000);

    console.log(
      `[Perf Audit] Evaluated ${iterations} Air-Gap destination checks in ${totalMs.toFixed(2)}ms (~${checksPerSec.toLocaleString()} checks/sec)`
    );

    expect(checksPerSec).toBeGreaterThan(50000);
    airGapManager.updateConfig({ enabled: false });
  });
});
