---
name: youmair-design-systems-tokenize
description: Extract hard-coded values and organize into a structured design token system (global, semantic, component tiers). Use when establishing or refactoring CSS/theme design tokens.
license: MIT
---

---
name: design-systems-tokenize
type: slash-command / design-systems
category: commands
platforms: [marie-claire-dean-designer-skills]
invocation: /design-systems:tokenize
source: https://github.com/Owl-Listener/designer-skills/blob/main/design-systems/commands/tokenize.md
license: MIT
fetched_at: 2026-05-13
status: enriched
---

# /design-systems:tokenize

---
description: Extract and organize design tokens from an existing design or stylesheet.
argument-hint: "[CSS file, design file, or description of values to tokenize]"
---
# /tokenize
Extract hard-coded values and organize into a structured token system.
## Steps
1. **Extract** â€” Scan for all visual values.
2. **Deduplicate** â€” Group similar values using `design-token` skill.
3. **Categorize** â€” Organize by category.
4. **Hierarchy** â€” Define global/semantic/component tiers using `design-token` skill.
5. **Naming** â€” Apply conventions using `naming-convention` skill.
6. **Themes** â€” Map variants using `theming-system` skill.
7. **Document** â€” Generate reference using `documentation-template` skill.
## Output
Token specification with inventory, hierarchy, theme mapping, and migration guide.
Consider following up with `/audit-system`.

