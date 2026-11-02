import crypto from 'node:crypto';

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  lastAccessedAt: number;
  hits: number;
  tokensEstimate: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  tokensSaved: number;
  entryCount: number;
  hitRatio: number;
}

export class LRUCache<T> {
  private entries = new Map<string, CacheEntry<T>>();
  private maxEntries: number;
  private defaultTtlMs: number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private tokensSaved = 0;

  constructor(maxEntries: number = 500, defaultTtlMs: number = 3600000) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
  }

  public get(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      this.misses++;
      return null;
    }

    entry.lastAccessedAt = Date.now();
    entry.hits++;
    this.hits++;
    this.tokensSaved += entry.tokensEstimate;

    // Refresh map position for LRU
    this.entries.delete(key);
    this.entries.set(key, entry);

    return entry.value;
  }

  public set(key: string, value: T, tokensEstimate: number = 0, ttlMs?: number): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    } else if (this.entries.size >= this.maxEntries) {
      // Evict least recently used (first item in Map iterator)
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey) {
        this.entries.delete(oldestKey);
        this.evictions++;
      }
    }

    const ttl = ttlMs !== undefined ? ttlMs : this.defaultTtlMs;
    this.entries.set(key, {
      key,
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      lastAccessedAt: Date.now(),
      hits: 0,
      tokensEstimate
    });
  }

  public invalidate(key: string): boolean {
    return this.entries.delete(key);
  }

  public invalidateMatching(predicate: (key: string) => boolean): number {
    let count = 0;
    for (const key of Array.from(this.entries.keys())) {
      if (predicate(key)) {
        this.entries.delete(key);
        count++;
      }
    }
    return count;
  }

  public clear(): void {
    this.entries.clear();
  }

  public getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      tokensSaved: this.tokensSaved,
      entryCount: this.entries.size,
      hitRatio: total > 0 ? Number((this.hits / total).toFixed(3)) : 0
    };
  }
}

export class MultiTierCacheService {
  // 1. Context Cache: Parsed file ASTs and extracted symbol metadata
  public static contextCache = new LRUCache<any>(1000, 1800000); // 30 mins

  // 2. Skill Cache: Composed skill instructions and operational summaries
  public static skillCache = new LRUCache<string>(200, 3600000); // 1 hour

  // 3. Prompt Cache: Assembled prompt fingerprints and structured sections
  public static promptCache = new LRUCache<any>(500, 900000); // 15 mins

  // 4. Model Response Cache: Safe deterministic model responses
  public static modelResponseCache = new LRUCache<string>(300, 3600000); // 1 hour

  /**
   * Generates a deterministic SHA-256 fingerprint from arbitrary payload string.
   */
  public static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Asserts whether a model response is eligible for caching.
   * Prohibits caching of requests containing sensitive tokens, passwords, or modifying commands.
   */
  public static isCacheEligible(params: {
    category: string;
    isModifying?: boolean;
    containsSecrets?: boolean;
    prompt: string;
  }): boolean {
    if (params.isModifying) return false;
    if (params.containsSecrets) return false;

    // Reject volatile or stateful categories
    const nonCacheableCategories = ['bug_fixing', 'code_modification', 'git_commit', 'terminal_command'];
    if (nonCacheableCategories.includes(params.category.toLowerCase())) {
      return false;
    }

    // Secret pattern heuristic
    const sensitiveRegex = /(api[_-]?key|password|secret|bearer\s+|private[_-]?key|auth[_-]?token)/i;
    if (sensitiveRegex.test(params.prompt)) {
      return false;
    }

    return true;
  }

  /**
   * Invalidates caches for a modified workspace file.
   */
  public static onFileModified(filePath: string): void {
    const normalized = filePath.replace(/\\/g, '/');
    this.contextCache.invalidateMatching((k) => k.includes(normalized));
    this.promptCache.invalidateMatching((k) => k.includes(normalized));
    this.modelResponseCache.invalidateMatching((k) => k.includes(normalized));
  }

  /**
   * Retrieves unified cache statistics across all tiers.
   */
  public static getAggregatedStats(): {
    context: CacheStats;
    skills: CacheStats;
    prompts: CacheStats;
    modelResponses: CacheStats;
    totalTokensSaved: number;
  } {
    const ctx = this.contextCache.getStats();
    const skl = this.skillCache.getStats();
    const pmt = this.promptCache.getStats();
    const mdl = this.modelResponseCache.getStats();

    return {
      context: ctx,
      skills: skl,
      prompts: pmt,
      modelResponses: mdl,
      totalTokensSaved: ctx.tokensSaved + skl.tokensSaved + pmt.tokensSaved + mdl.tokensSaved
    };
  }

  /**
   * Clears all cache tiers.
   */
  public static clearAll(): void {
    this.contextCache.clear();
    this.skillCache.clear();
    this.promptCache.clear();
    this.modelResponseCache.clear();
  }
}
