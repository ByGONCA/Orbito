import type { SpecialistRole } from '../../shared/agents';
import type { SkillPermissions } from '../../shared/skills';

export interface SpecialistDefinition {
  role: SpecialistRole;
  title: string;
  description: string;
  systemPrompt: string;
  boundSkillIds: string[];
  defaultPermissions: SkillPermissions;
  defaultIsModifying: boolean;
}

export const SPECIALIST_ROLES: Record<SpecialistRole, SpecialistDefinition> = {
  coordinator: {
    role: 'coordinator',
    title: 'Coordinator & Planner Agent',
    description: 'Decomposes user requests into dependency-ordered DAGs and supervises execution.',
    systemPrompt:
      'You are the Coordinator Agent. Your role is to understand user requirements, decompose complex problems into discrete tasks, and assign them to specialist agents with dependencies.',
    boundSkillIds: ['project-understanding'],
    defaultPermissions: {
      filesystem: { read: true, write: false },
      terminal: { execute: false },
      network: { allowed: false }
    },
    defaultIsModifying: false
  },
  architect: {
    role: 'architect',
    title: 'Architect Specialist Agent',
    description: 'Designs high-level contracts, database schemas, interfaces, and module boundaries.',
    systemPrompt:
      'You are the Architect Specialist Agent. Your focus is on clean architectural separation, interface contracts, schema designs, and avoiding premature coupling or complexity.',
    boundSkillIds: ['project-understanding', 'code-explanation'],
    defaultPermissions: {
      filesystem: { read: true, write: false },
      terminal: { execute: false },
      network: { allowed: false }
    },
    defaultIsModifying: false
  },
  backend: {
    role: 'backend',
    title: 'Backend Specialist Agent',
    description: 'Implements server-side logic, controllers, repositories, queries, and APIs.',
    systemPrompt:
      'You are the Backend Specialist Agent. Your focus is on writing robust, clean, and performant backend code, database queries, and API endpoints with strict error handling.',
    boundSkillIds: ['refactoring', 'bug-fixing', 'performance-analysis'],
    defaultPermissions: {
      filesystem: { read: true, write: true },
      terminal: { execute: false },
      network: { allowed: false }
    },
    defaultIsModifying: true
  },
  frontend: {
    role: 'frontend',
    title: 'Frontend Specialist Agent',
    description: 'Builds responsive React components, manages UI state, styling, and user experiences.',
    systemPrompt:
      'You are the Frontend Specialist Agent. Your focus is on constructing responsive, accessible, and delightful React components adhering to clean component composition and state management.',
    boundSkillIds: ['refactoring', 'code-review'],
    defaultPermissions: {
      filesystem: { read: true, write: true },
      terminal: { execute: false },
      network: { allowed: false }
    },
    defaultIsModifying: true
  },
  testing: {
    role: 'testing',
    title: 'Testing Specialist Agent',
    description: 'Authors unit, integration, and property test suites with high edge-case coverage.',
    systemPrompt:
      'You are the Testing Specialist Agent. Your focus is on writing maintainable, deterministic Vitest/Jest test suites that thoroughly verify happy paths, boundary conditions, and failure modes.',
    boundSkillIds: ['test-generation', 'bug-investigation'],
    defaultPermissions: {
      filesystem: { read: true, write: true },
      terminal: { execute: false },
      network: { allowed: false }
    },
    defaultIsModifying: true
  },
  security: {
    role: 'security',
    title: 'Security & Vulnerability Specialist',
    description: 'Audits code for OWASP vulnerabilities, path traversal, injection, and secrets leaks.',
    systemPrompt:
      'You are the Security Specialist Agent. Your focus is on evaluating code changes against OWASP guidelines, checking for command injection, unauthorized file access, and credential leakage.',
    boundSkillIds: ['security-review'],
    defaultPermissions: {
      filesystem: { read: true, write: false },
      terminal: { execute: false },
      network: { allowed: false }
    },
    defaultIsModifying: false
  },
  documentation: {
    role: 'documentation',
    title: 'Technical Documentation Specialist',
    description: 'Writes comprehensive JSDoc/TSDoc annotations, READMEs, and technical markdown docs.',
    systemPrompt:
      'You are the Documentation Specialist Agent. Your focus is on producing clear, synchronized, and developer-friendly technical documentation and architecture diagrams.',
    boundSkillIds: ['documentation', 'code-explanation'],
    defaultPermissions: {
      filesystem: { read: true, write: true },
      terminal: { execute: false },
      network: { allowed: false }
    },
    defaultIsModifying: true
  },
  reviewer: {
    role: 'reviewer',
    title: 'Independent Reviewer Agent',
    description: 'Performs adversarial code review, diff verification, and quality gate enforcement.',
    systemPrompt:
      'You are the Reviewer Agent. Your mission is to provide an objective, adversarial audit of code diffs, verifying acceptance criteria and demanding remediation for defects.',
    boundSkillIds: ['code-review', 'security-review'],
    defaultPermissions: {
      filesystem: { read: true, write: false },
      terminal: { execute: false },
      network: { allowed: false }
    },
    defaultIsModifying: false
  }
};
