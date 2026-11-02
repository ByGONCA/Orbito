import { skillRegistry } from './skill-registry';
import type { SkillMetadata, SkillResolutionResult } from '../../shared/skills';
import type { CLIProvider } from '../../shared/cli';

interface SkillKeywordsRule {
  skillId: string;
  exactPhrases: string[];
  keywords: string[];
  categoryBoost: number;
}

const SKILL_RULES: SkillKeywordsRule[] = [
  {
    skillId: 'code-review',
    exactPhrases: ['review my code', 'code review', 'review pr', 'review this pull request', 'spot bugs in this'],
    keywords: ['review', 'pr', 'antipattern', 'code quality', 'smell', 'linter', 'standards'],
    categoryBoost: 0.15
  },
  {
    skillId: 'bug-investigation',
    exactPhrases: ['why does this crash', 'investigate bug', 'find root cause', 'debug this error', 'diagnose failure'],
    keywords: ['investigate', 'diagnose', 'root cause', 'stack trace', 'crash', 'exception', 'failure', 'reproduce'],
    categoryBoost: 0.15
  },
  {
    skillId: 'bug-fixing',
    exactPhrases: ['fix this bug', 'fix the error', 'patch this issue', 'apply hotfix', 'fix test failure'],
    keywords: ['fix', 'patch', 'hotfix', 'repair', 'resolve error', 'correct'],
    categoryBoost: 0.15
  },
  {
    skillId: 'refactoring',
    exactPhrases: ['refactor this', 'clean up this code', 'clean code', 'extract method', 'simplify logic'],
    keywords: ['refactor', 'decouple', 'cleanup', 'solid', 'dry', 'restructure', 'simplify'],
    categoryBoost: 0.15
  },
  {
    skillId: 'documentation',
    exactPhrases: ['write documentation', 'document this function', 'generate jsdoc', 'create readme', 'api docs'],
    keywords: ['document', 'docs', 'jsdoc', 'tsdoc', 'readme', 'markdown', 'api spec', 'comments'],
    categoryBoost: 0.15
  },
  {
    skillId: 'test-generation',
    exactPhrases: ['write tests for', 'generate unit test', 'create tests', 'vitest suite', 'jest test', 'test suite', 'write a vitest', 'unit tests'],
    keywords: ['test', 'tests', 'vitest', 'jest', 'unit test', 'integration test', 'mock', 'assertion', 'suite'],
    categoryBoost: 0.15
  },
  {
    skillId: 'security-review',
    exactPhrases: ['security audit', 'check for vulnerabilities', 'owasp audit', 'find security flaws', 'audit secrets'],
    keywords: ['security', 'vulnerability', 'owasp', 'cwe', 'injection', 'secret', 'token leak', 'cve', 'xss'],
    categoryBoost: 0.2
  },
  {
    skillId: 'project-understanding',
    exactPhrases: ['explain the project architecture', 'onboarding to this repo', 'how is this codebase structured', 'project overview'],
    keywords: ['architecture', 'onboard', 'structure', 'topology', 'how does this project work', 'overview', 'entrypoint'],
    categoryBoost: 0.15
  },
  {
    skillId: 'performance-analysis',
    exactPhrases: ['performance audit', 'optimize slow code', 'memory leak analysis', 'profile latency', 'find bottleneck'],
    keywords: ['performance', 'slow', 'latency', 'bottleneck', 'memory leak', 'gc', 'o(n^2)', 'profile', 'benchmark'],
    categoryBoost: 0.15
  },
  {
    skillId: 'code-explanation',
    exactPhrases: ['explain this code', 'what does this do', 'walk me through this', 'explain in plain english'],
    keywords: ['explain', 'understand', 'walkthrough', 'meaning', 'how does it work', 'clarify'],
    categoryBoost: 0.15
  }
];

export class SkillResolver {
  /**
   * Analyzes a prompt and resolves candidate skills ranked by confidence.
   */
  public static resolve(
    prompt: string,
    provider?: CLIProvider
  ): SkillResolutionResult[] {
    const skills = skillRegistry.listSkills().filter((s) => s.enabled);
    const normalizedPrompt = prompt.toLowerCase().trim();
    const results: SkillResolutionResult[] = [];

    for (const skill of skills) {
      if (provider && !skill.supportedProviders.includes(provider)) {
        continue;
      }

      const rule = SKILL_RULES.find((r) => r.skillId === skill.id);
      let score = 0;
      const matchedKeywords: string[] = [];
      let matchReason = '';

      // 1. Direct name match (e.g. "@code-review" or "using code-review skill")
      if (normalizedPrompt.includes(skill.id) || normalizedPrompt.includes(skill.name.toLowerCase())) {
        score += 0.8;
        matchedKeywords.push(skill.id);
        matchReason = `Direct reference to skill ${skill.name}`;
      }

      // 2. Exact phrase match
      if (rule) {
        for (const phrase of rule.exactPhrases) {
          if (normalizedPrompt.includes(phrase)) {
            score += 0.6;
            matchedKeywords.push(phrase);
            matchReason = `Matched intent phrase "${phrase}"`;
            break;
          }
        }

        // 3. Keyword matches
        for (const kw of rule.keywords) {
          // Word boundary regex
          const regex = new RegExp(`\\b${kw}\\b`, 'i');
          if (regex.test(normalizedPrompt)) {
            score += 0.15;
            if (!matchedKeywords.includes(kw)) {
              matchedKeywords.push(kw);
            }
          }
        }
      }

      // 4. Tag matches
      for (const tag of skill.tags) {
        const regex = new RegExp(`\\b${tag}\\b`, 'i');
        if (regex.test(normalizedPrompt)) {
          score += 0.1;
          if (!matchedKeywords.includes(tag)) {
            matchedKeywords.push(tag);
          }
        }
      }

      // Normalize score between 0.0 and 1.0
      const confidence = Math.min(1.0, Number(score.toFixed(2)));

      if (confidence >= 0.25) {
        results.push({
          skill,
          confidence,
          matchedKeywords,
          reason: matchReason || `Matched keywords: ${matchedKeywords.join(', ')}`
        });
      }
    }

    // Sort descending by confidence
    results.sort((a, b) => b.confidence - a.confidence);
    return results;
  }
}
