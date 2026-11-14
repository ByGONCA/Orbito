import type {
  AgentRoleType,
  RoleContextPackage,
  ProjectIntelligenceData
} from '../../shared/project-intelligence';

export class RoleContextAssemblerService {
  public assembleForRole(
    role: AgentRoleType,
    taskDescription: string,
    intel: ProjectIntelligenceData,
    maxTokens = 4000
  ): RoleContextPackage {
    const modules = intel.architecture.modules || [];
    let relevantModules: string[] = [];
    let relevantFiles: string[] = [];
    const suggestedSkills: string[] = [];
    const systemConstraints: string[] = [];

    // 1. Role-specific module and file selection
    switch (role) {
      case 'architect':
        relevantModules = modules.map((m) => m.name);
        relevantFiles = intel.architecture.entryPoints.map((e) => e.path);
        suggestedSkills.push('architect', 'audit', 'graphify');
        break;

      case 'frontend':
        relevantModules = modules.filter((m) => m.type === 'ui' || m.type === 'types').map((m) => m.name);
        relevantFiles = intel.architecture.entryPoints
          .filter((e) => e.type.includes('renderer') || e.type.includes('web') || e.type.includes('react'))
          .map((e) => e.path);
        suggestedSkills.push('frontend-design', 'ui-ux-pro-max', 'emil-design-eng');
        break;

      case 'backend':
        relevantModules = modules
          .filter((m) => m.type === 'service' || m.type === 'data-access' || m.type === 'ipc')
          .map((m) => m.name);
        relevantFiles = intel.architecture.entryPoints
          .filter((e) => e.type.includes('main') || e.type.includes('entry'))
          .map((e) => e.path);
        suggestedSkills.push('debug', 'mcp-builder');
        break;

      case 'security':
        relevantModules = modules
          .filter((m) => m.type === 'ipc' || m.type === 'service' || m.type === 'data-access')
          .map((m) => m.name);
        relevantFiles = ['.env.example', 'package.json'];
        suggestedSkills.push('ponytail-review', 'audit');
        break;

      case 'reviewer':
        relevantModules = intel.git.modifiedFiles.map((f) => f.split('/')[0]).filter(Boolean);
        relevantFiles = intel.git.modifiedFiles.slice(0, 15);
        suggestedSkills.push('check', 'ponytail-review', 'web-design-guidelines');
        break;

      case 'tester':
        relevantModules = modules.filter((m) => m.type === 'tests' || m.type === 'service').map((m) => m.name);
        relevantFiles = intel.techStack.testFrameworks.length > 0 ? ['vitest.config.ts', 'jest.config.js'] : [];
        suggestedSkills.push('test', 'webapp-testing');
        break;

      default:
        relevantModules = modules.slice(0, 5).map((m) => m.name);
        relevantFiles = intel.architecture.entryPoints.map((e) => e.path).slice(0, 5);
        suggestedSkills.push('develop', 'debug');
    }

    if (relevantModules.length === 0 && modules.length > 0) {
      relevantModules = modules.slice(0, 4).map((m) => m.name);
    }

    // 2. Extract key conventions from knowledge entries
    const keyConventions = intel.knowledgeEntries
      .filter((k) => k.category === 'convention')
      .map((k) => `${k.title}: ${k.content}`);

    if (keyConventions.length === 0) {
      keyConventions.push('Follow existing naming conventions, file boundaries and linting standards in repository.');
    }

    // 3. Extract system constraints
    if (intel.techStack.packageManagers.length > 0) {
      systemConstraints.push(`Use package manager: ${intel.techStack.packageManagers.join(', ')}.`);
    }
    if (intel.techStack.languages.length > 0) {
      systemConstraints.push(`Primary languages: ${intel.techStack.languages.map((l) => l.name).join(', ')}.`);
    }
    if (intel.git.isDirty) {
      systemConstraints.push(`Working tree has uncommitted modifications (${intel.git.modifiedFiles.length} files). Do not overwrite.`);
    }

    // 4. Architectural notes
    const architecturalNotes = `
Project Architecture Style: ${intel.architecture.style}
Summary: ${intel.architecture.summary}
Relevant Modules: ${relevantModules.join(', ') || 'Root repository'}
Active Branch: ${intel.git.branch} (Head: ${intel.git.headCommit || 'N/A'})
`.trim();

    return {
      role,
      relevantModules,
      relevantFiles,
      keyConventions,
      architecturalNotes,
      systemConstraints,
      suggestedSkills
    };
  }

  public formatContextPrompt(pkg: RoleContextPackage): string {
    return `
### [PROJECT INTELLIGENCE CONTEXT — ${pkg.role.toUpperCase()}]
${pkg.architecturalNotes}

**Relevant Modules & Boundaries:**
${pkg.relevantModules.map((m) => `- ${m}`).join('\n') || '- None specified'}

**Key Architecture Conventions:**
${pkg.keyConventions.map((c) => `- ${c}`).join('\n')}

**System Constraints:**
${pkg.systemConstraints.map((sc) => `- ${sc}`).join('\n')}

**Recommended Specialized Skills:**
${pkg.suggestedSkills.map((s) => `\`${s}\``).join(', ')}
`.trim();
  }
}

export const roleContextAssemblerService = new RoleContextAssemblerService();
