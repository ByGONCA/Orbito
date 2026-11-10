# Strict Invariant: Zero White Borders (Anti-Boxiness & Clean Layout)

## The Rule
**NO VISIBLE WHITE OR LIGHT BORDERS ANYWHERE IN THE APPLICATION.**
Under no circumstance should components, cards, buttons, lists, previews, theme options, settings panels, or containers be wrapped in visible white or light borders (such as `border`, `border-border`, `border-white/*`, `border-accent/*`, `ring-1`, etc.).

## Detailed Standards
1. **Never Wrap Cards in Outlines:**
   - Do NOT use `border border-border`, `border-white/*`, or `ring-1 ring-accent/*` to enclose sections, cards, or theme pickers.
   - Use surface contrast alone (`bg-white/[0.02]`, `bg-white/[0.04]`, `hover:bg-white/[0.06]`) and vertical whitespace to delineate elements.

2. **No Bordered Preview Containers:**
   - Previews (such as Git file trees, code snippet boxes, and miniature app mocks) must float seamlessly on the dark background without rounded rectangle borders enclosing them.
   - Remove dividing header lines (`border-b border-border`) and footer lines (`border-t border-border`).

3. **No Boxy Outlines on Buttons or Pills:**
   - Selection indicators, status pills, and toggle buttons must never have harsh white or gray stroke outlines.
   - Represent selection with subtle background fills (e.g. `bg-white/[0.08]`) and clean typography.

4. **Borderless Inputs:**
   - Search bars and text inputs must be borderless (`border-0`), using subtle background fills (`bg-white/[0.03]` to `bg-white/[0.06]`).

5. **Dividers Prohibited:**
   - Do not use `divide-y divide-border` or `border-b` / `border-t` to slice lists. Use whitespace (`space-y-1` or `space-y-0.5`) and subtle hover effects (`hover:bg-white/[0.03]`).
