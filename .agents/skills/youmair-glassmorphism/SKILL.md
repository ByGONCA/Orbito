---
name: youmair-glassmorphism
description: Frosted glass specifications, backdrop blur formulas, translucent layers, and luminous borders for depth and modern elegance from the Youmair design skill kit. Use when configuring glassmorphism style foundations and token specifications.
license: MIT
---

---
name: glassmorphism
type: style
category: styles
platforms: ['typeui', 'ui-ux-pro-max-skill']
url_sources:
  - https://github.com/bergside/awesome-design-skills/tree/main/skills/glassmorphism
  - local: ~/.claude/skills/ui-ux-pro-max/data/styles.csv
license: MIT
fetched_at: 2026-05-13
status: enriched
---

# Glassmorphism


## Source Profile â€” ui-ux-pro-max-skill

| Field | Value |
|---|---|
| Style Category | Glassmorphism |
| Type | General |
| Keywords | Frosted glass, transparent, blurred background, layered, vibrant background, light source, depth, multi-layer |
| Primary Colors | Translucent white: rgba(255,255,255,0.1-0.3) |
| Secondary Colors | Vibrant: Electric Blue #0080FF, Neon Purple #8B00FF, Vivid Pink #FF1493, Teal #20B2AA |
| Effects & Animation | Backdrop blur (10-20px), subtle border (1px solid rgba white 0.2), light reflection, Z-depth |
| Best For | Modern SaaS, financial dashboards, high-end corporate, lifestyle apps, modal overlays, navigation |
| Do Not Use For | Low-contrast backgrounds, critical accessibility, performance-limited, dark text on dark |
| Light Mode âœ“ | âœ“ Full |
| Dark Mode âœ“ | âœ“ Full |
| Performance | âš  Good |
| Accessibility | âš  Ensure 4.5:1 |
| Mobile-Friendly | âœ“ Good |
| Conversion-Focused | âœ“ High |
| Framework Compatibility | Tailwind 9/10, MUI 8/10, Chakra 8/10 |
| Era/Origin | 2020s Modern |
| Complexity | Medium |
| AI Prompt Keywords | Design a glassmorphic interface with frosted glass effect. Use backdrop blur (10-20px), translucent overlays (rgba 10-30% opacity), vibrant background colors, subtle borders, light source reflection, layered depth. Perfect for modern overlays and cards. |
| CSS/Technical Keywords | backdrop-filter: blur(15px), background: rgba(255, 255, 255, 0.15), border: 1px solid rgba(255,255,255,0.2), -webkit-backdrop-filter: blur(15px), z-index layering for depth |
| Implementation Checklist | â˜ Backdrop-filter blur 10-20px, â˜ Translucent white 15-30% opacity, â˜ Subtle border 1px light, â˜ Vibrant background verified, â˜ Text contrast 4.5:1 checked |
| Design System Variables | --blur-amount: 15px, --glass-opacity: 0.15, --border-color: rgba(255,255,255,0.2), --background: vibrant color, --text-color: light/dark based on BG |


---
## SKILL.md (TypeUI â€” agent procedure)

---
name: glassmorphism
description: Frosted glass effect with translucent layers, subtle blur, and luminous borders for depth and modern elegance.
license: MIT
metadata:
  author: typeui.sh
---

<!-- TYPEUI_SH_MANAGED_START -->
# Glassmorphism Design System Skill (Universal)

## Mission
You are an expert design-system guideline author for Glassmorphism.
Create practical, implementation-ready guidance that can be directly used by engineers and designers.

## Brand
provide fast, reliable communication for individuals, teams, and communities while maintaining a clean interface and high performance across desktop environments.

## Style Foundations
- Visual style: clean, high-contrast, bold, enterprise, liquidglass effect, glassmorphism
- Typography scale: mobile-first compact scale | Fonts: primary=Plus Jakarta Sans, display=Plus Jakarta Sans, mono=JetBrains Mono | weights=100, 200, 300, 400, 500, 600, 700, 800, 900
- Color palette: primary, neutral, success, warning, danger, info, surface/subtle layers | Tokens: primary=#1856FF, secondary=#3A344E, success=#07CA6B, warning=#E89558, danger=#EA2143, surface=#FFFFFF, text=#141414
- Spacing scale: comfortable density mode

- bento cards

## Accessibility
WCAG 2.2 AA, keyboard-first interactions, visible focus states

## Writing Tone
concise, confident, helpful, clear, friendly, professional

## Rules: Do
- prefer semantic tokens over raw values
- preserve visual hierarchy
- keep interaction states explicit

## Rules: Don't
- avoid low contrast text
- avoid inconsistent spacing rhythm
- avoid decorative motion without purpose
- avoid ambiguous labels
- avoid mixing multiple visual metaphors

## Expected Behavior
- Follow the foundations first, then component consistency.
- When uncertain, prioritize accessibility and clarity over novelty.
- Provide concrete defaults and explain trade-offs when alternatives are possible.
- Keep guidance opinionated, concise, and implementation-focused.

## Guideline Authoring Workflow
1. Restate the design intent in one sentence before proposing rules.
2. Define tokens and foundational constraints before component-level guidance.
3. Specify component anatomy, states, variants, and interaction behavior.
4. Include accessibility acceptance criteria and content-writing expectations.
5. Add anti-patterns and migration notes for existing inconsistent UI.
6. End with a QA checklist that can be executed in code review.

## Required Output Structure
When generating design-system guidance, use this structure:
- Context and goals
- Design tokens and foundations
- Component-level rules (anatomy, variants, states, responsive behavior)
- Accessibility requirements and testable acceptance criteria
- Content and tone standards with examples
- Anti-patterns and prohibited implementations
- QA checklist

## Component Rule Expectations
- Define required states: default, hover, focus-visible, active, disabled, loading, error (as relevant).
- Describe interaction behavior for keyboard, pointer, and touch.
- State spacing, typography, and color-token usage explicitly.
- Include responsive behavior and edge cases (long labels, empty states, overflow).

## Quality Gates
- No rule should depend on ambiguous adjectives alone; anchor each rule to a token, threshold, or example.
- Every accessibility statement must be testable in implementation.
- Prefer system consistency over one-off local optimizations.
- Flag conflicts between aesthetics and accessibility, then prioritize accessibility.

## Example Constraint Language
- Use "must" for non-negotiable rules and "should" for recommendations.
- Pair every do-rule with at least one concrete don't-example.
- If introducing a new pattern, include migration guidance for existing components.

<!-- TYPEUI_SH_MANAGED_END -->


---
## DESIGN.md (TypeUI â€” design tokens)

---
name: Glassmorphism
colors:
  primary: "#1856FF"
  secondary: "#3A344E"
  success: "#07CA6B"
  warning: "#E89558"
  danger: "#EA2143"
  surface: "#FFFFFF"
  text: "#141414"
  neutral: "#FFFFFF"
typography:
  h1:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 3rem
  body-md:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 1rem
  label-caps:
    fontFamily: "JetBrains Mono"
    fontSize: 0.75rem
  sourceScale: "mobile-first compact scale"
  weights: "100, 200, 300, 400, 500, 600, 700, 800, 900"
rounded:
  sm: 4px
  md: 8px
spacing:
  sm: 8px
  md: 16px
  sourceScale: "comfortable density mode"
---

## Overview

Frosted glass effect with translucent layers, subtle blur, and luminous borders for depth and modern elegance.

## Style Foundations

- **Visual style:** clean, high-contrast, bold, enterprise, liquidglass effect, glassmorphism
- **Typography scale:** mobile-first compact scale
- **Typography fonts:** primary=Plus Jakarta Sans, display=Plus Jakarta Sans, mono=JetBrains Mono
- **Typography weights:** 100, 200, 300, 400, 500, 600, 700, 800, 900
- **Color palette:** primary, neutral, success, warning, danger, info, surface/subtle layers
- **Spacing scale:** comfortable density mode

## Colors

- **Primary (#1856FF):** Token from style foundations.
- **Secondary (#3A344E):** Token from style foundations.
- **Success (#07CA6B):** Token from style foundations.
- **Warning (#E89558):** Token from style foundations.
- **Danger (#EA2143):** Token from style foundations.
- **Surface (#FFFFFF):** Token from style foundations.
- **Text (#141414):** Token from style foundations.
- **Neutral (#FFFFFF):** Derived from the surface token for official format compatibility.


