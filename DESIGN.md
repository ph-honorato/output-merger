---
version: "alpha"
name: "Aurora UI"
description: "Gradientes fluxo animado, efeito Northern Lights, cores complementares. Interface luminosa e atmosférica. Prompt para gradientes dinâmicos."
colors:
  primary: "#3b82f6"
  secondary: "#8b5cf6"
  tertiary: "#00FFFF"

typography:
  h1:
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif'
    fontSize: 2.5rem
    fontWeight: 700
  body-md:
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif'
    fontSize: 1rem
    fontWeight: 400
  label-caps:
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif'
    fontSize: 0.75rem
    fontWeight: 500
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    padding: 12px
---

## Overview

Gradientes fluxo animado, efeito Northern Lights, cores complementares. Interface luminosa e atmosférica. Prompt para gradientes dinâmicos. Mesh gradients (2021+) e CSS Houdini trazem animações fluidas tipo Northern Lights. Popular em SaaS premium e creative tools.

- Density: 5/10 — Balanced
- Variance: 4/10 — Moderate
- Motion: 6/10 — Expressive

- **Style:** Ethereal, Gradient, Premium, Animated
- **Keywords:** Vibrant gradients, smooth blend, Northern Lights effect, mesh gradient, luminous, atmospheric, abstract
- **Era:** 2020s Modern
- **Light/Dark:** ✓ Full / ✓ Full

## Colors

### Light Mode
- **Primary Blue** (#3b82f6) — Accent highlight, links, focus states, primary actions
- **Primary Light** (#60a5fa) — Hover states, lighter accents
- **Primary Dark** (#2563eb) — Active/pressed states
- **Secondary Violet** (#8b5cf6) — Decorative accent, secondary actions
- **Secondary Light** (#a78bfa) — Hover states for secondary
- **Secondary Dark** (#7c3aed) — Active states for secondary
- **Background Default** (#f8fafc) — Page background
- **Background Paper** (#ffffff) — Card/surface background
- **Text Primary** (#1e293b) — Main text content
- **Text Secondary** (#64748b) — Secondary text, labels, counters

### Dark Mode
- **Primary Blue** (#60a5fa) — Accent highlight, links, focus states
- **Primary Light** (#93c5fd) — Hover states
- **Primary Dark** (#3b82f6) — Active states
- **Secondary Violet** (#a78bfa) — Decorative accent
- **Secondary Light** (#c4b5fd) — Hover states
- **Secondary Dark** (#8b5cf6) — Active states
- **Background Default** (#0f172a) — Page background
- **Background Paper** (#1e293b) — Card/surface background
- **Text Primary** (#f1f5f9) — Main text content
- **Text Secondary** (#94a3b8) — Secondary text, labels, counters

## Typography

- **Display / Hero:** "Inter", "Roboto", "Helvetica", "Arial", sans-serif — Weight 700, tight tracking, used for headline impact
- **Body:** "Inter", "Roboto", "Helvetica", "Arial", sans-serif — Weight 400, 16px/1.6 line-height, max 72ch per line
- **UI Labels / Captions:** "Inter", "Roboto", "Helvetica", "Arial", sans-serif — 0.75rem (0.875rem for body2), weight 500, slight letter-spacing (0.04em), uppercase for labels
- **Monospace:** JetBrains Mono — Used for code, metadata, and technical values

Scale:
- Hero: clamp(2.5rem, 5vw, 4rem)
- H1: 2.5rem
- H2: 2rem
- H3: 1.5rem
- H4: 1.25rem
- H5: 1.125rem
- H6: 1rem
- Body1: 1rem / 1.6
- Body2: 0.875rem / 1.6
- Small/Label: 0.75rem

## Layout

- **Grid:** CSS Grid primary for page-level layout. Max-width containment: 1280px centered with 1.5rem side padding (MUI Container).
- **Spacing rhythm:** Balanced. Base unit: 0.5rem (8px) via MUI spacing(1).
- **Section vertical gaps:** clamp(4rem, 8vw, 8rem).
- **Hero layout:** Split-screen (text left, visual right).
- **Feature sections:** Zig-zag alternating text+image rows. No 3-equal-columns.
- **Mobile collapse:** All multi-column layouts collapse below 900px (MUI `md` breakpoint). No horizontal overflow.
- **z-index contract:** base (0) / sticky-nav (100) / overlay (200) / modal (300) / toast (500).
- **Card Height:** Fixed 400px for MergeSession cards (text inputs + preview area) — content scrolls internally.

## Elevation & Depth

Large flowing CSS/SVG gradients, subtle 8-12s animations, depth via color layering, smooth morph

- **Physics:** Spring — stiffness 120, damping 20. Confident, weighted transitions.
- **Entry animations:** Fade + translate-Y (100px → 0) over 800ms ease-out. Staggered cascades for lists: 100ms between items (via $entranceDelay prop).
- **Hover states:** Scale(1.03) + shadow lift over 200ms (MUI defaults + custom card shadows).
- **Page transitions:** Fade + slide (300ms).
- **Performance:** Only transform and opacity animated. No layout-triggering properties.
- **Card Shadow:** `0 2px 12px rgba(0, 0, 0, 0.06)` (light) / elevated in dark mode via MUI Paper.
- **Focus Ring:** 2px solid accent color, 2px offset — consistent across inputs, buttons, chips.

## Shapes

- **Base corner radius:** 0.5rem (8px) — exported as `borderRadius` token, used across all components (cards, buttons, inputs, menus, modals).
- **Button radius:** 0.5rem (via theme.shape.borderRadius)
- **Input radius:** 0.5rem (via theme.shape.borderRadius)
- **Card radius:** 0.5rem
- **Menu/Modal radius:** 0.5rem

## Components

### Primary Button (MUI Button with theme overrides)
- Moderately rounded (0.5rem) shape. Accent color fill (#3b82f6 light / #60a5fa dark).
- Hover: 8% darken + subtle lift shadow.
- Active: -1px translate tactile press.
- Font weight 600.
- Text transform: none (disabled uppercase).
- No outer glows.

### Secondary / Ghost Button
- Outline variant. 1.5px border in muted color.
- Text in primary color.
- Hover: subtle background fill (action.hover).

### Cards (TextInput, PreviewArea, ActionsBar)
- Moderately rounded (0.5rem) corners.
- Surface background (palette.background.paper).
- Subtle shadow: `0 2px 12px rgba(0,0,0,0.06)`.
- 1px border stroke (palette.divider).
- Fixed height: 400px for MergeSession cards; content scrolls internally.

### Inputs (TextInput)
- Label above input: 0.75rem, weight 500, letter-spacing 0.04em, uppercase, text-secondary color.
- 1px border stroke (palette.divider).
- Focus ring: 2px solid primary.main (#3b82f6), offset 2px, transition 200ms ease.
- Error text below in semantic red (MUI standard).
- No floating labels.
- Textarea fills card, scrolls natively, resize: none.

### Navigation (Header)
- Primary surface background (palette.background.paper).
- Sticky top, z-index: appBar.
- Border-bottom: 1px solid divider.
- Box-shadow: shadows[1].
- Active item: accent color indicator (not explicitly implemented; selected menu item uses action.selected background + weight 600).
- Font weight 500 when active.
- Logo: 1.5rem (1.25rem mobile), weight 700.
- Config menu: dropdown with divider, icons, toggle switches.

### Skeletons
- Shimmer animation matching component dimensions.
- No circular spinners.

### Empty States
- Icon-based composition with descriptive text and action button (not fully implemented yet; placeholder text used).

## Do's and Don'ts

- No emojis in UI — use icon system only (Lucide, Heroicons / MUI Icons)
- No pure black (#000000) — use off-black or charcoal variants (text-primary: #1e293b light, #f1f5f9 dark)
- No oversaturated accent colors (saturation cap: 80%) — current primaries are within range
- No 3-column equal-width feature layouts — use zig-zag or asymmetric grid
- No `h-screen` — use `min-h-[100dvh]` or flex: 1 layouts
- No AI copywriting clichés: "Elevate", "Seamless", "Unleash", "Next-Gen"
- No broken external image links — use picsum.photos or inline SVG
- No generic lorem ipsum in demos

- Do Mesh/flowing gradients applied (aspirational — current implementation uses solid theme colors; gradients reserved for future hero/background elements)
- Do 8-12s animation loop (aspirational — current: 800ms entrance animations)
- Do Complementary colors used (Blue + Violet primary/secondary)
- Do Smooth color transitions (200ms ease on focus/hover)
- Do Iridescent effect subtle (aspirational)
- Do Text contrast verified (WCAG AA target)

## Use Case

SaaS premium, Creative tools, Agência moderna, Brand exclusiva

## Implementation Notes (Actual Codebase)

- **Theme System:** MUI `createTheme` + styled-components integration via `StyledTheme` type (extends both MUI Theme and styled-components DefaultTheme + `borderRadius` token).
- **Dark Mode:** Full support via `ThemeContext` with localStorage persistence; toggles between `theme` and `darkTheme`.
- **Animations:** `slideUpFadeIn` keyframes (800ms ease-out, translateY 100px → 0) used on TextInputRoot, PreviewAreaRoot via `$entranceDelay` prop for staggered entrance.
- **Responsive:** Mobile-first breakpoints at 600px (MUI `sm`), 900px (MUI `md`).
- **Accessibility:** Focus rings, ARIA labels, keyboard navigation (dnd-kit KeyboardSensor), prefers-reduced-motion respected.
- **Icons:** MUI Icons (@mui/icons-material) — Settings, KeyboardReturn, ContentCopy, DragIndicator, Globe/Language, DarkMode/LightMode, CheckCircle, etc.

<!-- Source: https://designmd.app.br/library/aurora-ui · designmd.app -->