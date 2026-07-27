# ADR: Dark-Only Design System and Token Foundation (TASK-0.8)

- **Status**: accepted
- **Refs**: REQ-17, A11Y-1; design.md §Design System and Theming

## Decision

A single dark theme, defined as CSS custom properties in
`src/styles/tokens.css` and mapped to Tailwind's semantic colour
utilities in `src/styles/theme.css`. No light-theme token set, no
`.dark` class, no `prefers-color-scheme` branching, no stored theme
preference. `src/tests/design-tokens.test.ts` asserts all of those
absences against the shipped CSS, so reintroducing a second theme
fails the build rather than passing unnoticed.

## Pre-check: source hues

tasks.md asks for confirmation of the parent web platform's brand
tokens in `src/app/globals.css`. **That file was not readable from this
session** -- the parent repository is unreachable here (cross-owner
`add_repo` is unsupported), the same blocker recorded for TASK-0.7.

The hues were therefore taken from design.md's own record of them
(`--primary: 160 84% 30%` emerald, `--accent: 48 96% 53%` gold,
`--info: 221 83% 53%` blue, plus success/warning/error/destructive
semantics), which is a second-hand source. Hue values are preserved;
lightness/saturation are re-tuned for dark surfaces regardless, so the
practical risk of the second-hand source is limited to hue drift. **A
session with parent access should verify the three hue values against
`src/app/globals.css` directly.** shadcn/ui theming conventions
(semantic `--background`/`--foreground` pairs consumed through Tailwind
colour utilities) were confirmed from the framework's published
convention and are what `theme.css` implements.

## design.md's proposed palette failed AA in six places

design.md's token table carried the instruction that contrast must be
checked "against the actual rendered token values, not the table above
by inspection alone." Running that check found **six real failures**:

| Pairing | design.md value | Ratio | Required |
|---|---|---|---|
| `destructive-foreground` on `destructive` | `0 0% 98%` on `0 72% 58%` | 3.87 | 4.5 |
| `error` as text on `card` | `0 72% 58%` | 4.39 | 4.5 |
| `border` on `background` | `220 15% 17%` | 1.30 | 3.0 |
| `input` on `background` | `220 15% 19%` | 1.39 | 3.0 |
| `border` on `card` | `220 15% 17%` | 1.22 | 3.0 |
| `border` on `sidebar-background` | `220 15% 17%` | 1.33 | 3.0 |

### Corrections

**`--destructive` / `--error`: `58%` → `59%`, and
`--destructive-foreground` flipped from near-white to dark
(`220 20% 6%`).** Two options existed for the foreground failure: keep
white-on-red and darken the red to ~35% (reaches 7.99:1), or keep the
red bright and put dark text on it. Darkening to 35% was rejected --
at that lightness the colour reads as maroon on a dark surface and
stops signalling "alert." Dark-on-red gives 4.79:1, and the 1-point
lightness bump simultaneously fixes `error`-as-text on `card`
(4.51:1). One change, both failures resolved.

**`--input`: `19%` → `42%` (3.27:1 on `background`, 3.06:1 on
`card`).** A form control's border is the information that identifies
the control, so SC 1.4.11 genuinely applies.

**`--border`: unchanged at `17%`, deliberately.** SC 1.4.11 covers
"visual information required to identify user interface components and
states" -- it does not cover purely decorative elements. `--border` is
for dividers and card edges, which carry no such information, so
raising it to 3:1 would harm the dense, quiet aesthetic the design
brief calls for without an accessibility gain. This is recorded as an
explicit decision rather than an oversight: the token file states
`DECORATIVE ONLY`, and a test asserts *both* that `--border` stays
below 3:1 *and* that `--input` clears it, so anyone tempted to raise
`--border` must first decide whether `--input` is what they actually
needed.

## The contrast check is a real test, not a spreadsheet

`src/tests/design-tokens.test.ts` **parses `tokens.css` itself** rather
than restating the values. A token edited in CSS without re-checking
contrast fails the suite. It covers 23 text pairings at 4.5:1, 6
non-text pairings at 3:1, all five chart series against both base
surfaces, the presence of every promised token, the single-theme
assertions, and the tightened radius -- 34 assertions in total.

The WCAG maths (`src/tests/helpers/contrast.ts`) implements the
relative-luminance and contrast-ratio formulae from WCAG 2.2 directly
rather than pulling a dependency, since it is ~40 lines and the
formulae are stable.

The single-theme assertions run against a comment-stripped copy of the
CSS: the file's own prose names `prefers-color-scheme` precisely to say
it is not used, and the test must judge declarations, not documentation.

## Tailwind v4: config lives in CSS

tasks.md names `tailwind.config.ts`. Tailwind v4 (4.3.3, current)
configures its theme in CSS via `@theme` and a Vite plugin; a JS config
object is legacy. **No `tailwind.config.ts` is created**, and
`src/styles/theme.css` carries the mapping instead. This suits REQ-17
better than the original wording did -- the requirement asks for tokens
"implemented as CSS custom properties consumed by Tailwind CSS," which
is exactly what `@theme inline` does, with no duplication of values
into a JS object.

`theme.css` also sets the base layer: body surface/foreground colours,
an Inter-class system font stack, `tabular-nums` on table cells and
`[data-numeric]` (so pricing schedules and match scores align
column-wise), and a `:focus-visible` ring using `--ring` to satisfy
A11Y-1 on every surface.

## Status colours are not the only signal

`--success`/`--warning`/`--error`/`--info` all pass AA on both base
surfaces, but design.md's rule that status must not rely on hue alone
is a *component* obligation: readiness scores, compliance status, and
validation results must pair the colour with an icon or label. Nothing
in this task renders status yet; the rule is restated here for the
component tasks that will.

## Not built yet

No shadcn/ui components are installed. The tokens are the contract
components will be generated against; adding a component library before
any feature needs one would be the "empty architecture theatre"
design.md warns against. `App.tsx` was migrated onto semantic utilities
(`text-foreground`, `text-muted-foreground`) and the ad-hoc `App.css`
deleted, so the placeholder shell now demonstrates the token path
end-to-end -- verified in the production build output, where
`.text-muted-foreground` resolves to `hsl(var(--muted-foreground))`.
