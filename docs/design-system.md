# Ruvox design system ("Caderno")

Source of truth for the look of the app. Every screen uses these tokens and components;
no hard-coded colors, no one-off spacing.

## Intent

- **Who**: a Brazilian adult learning Russian from zero, 5 to 10 minutes at a time, usually on
  a phone, often at night. They want to feel progress and not feel stupid.
- **Verb**: play a short session, then see it counted.
- **Feel**: a well-kept Russian school notebook. Warm paper, blue-black ink, one red margin
  line of accent, a little gold when you do well. Calm, a bit literary, never childish and
  never "SaaS dashboard".

## Domain, color world, signature

- Domain: Cyrillic letterforms, the school notebook (тетрадь) with its margin line, index cards,
  chalkboard, birch and snow, postage stamps, Moscow metro signage, onion-dome gilding.
- Color world: ink (чернила) blue-black, brick red, birch-bark white, winter sky grey, gilt gold,
  pine green, chalkboard green-black.
- **Signature**: the Cyrillic letter is the hero object. Letters and words are set big in a serif
  (Source Serif 4) on paper "cards" that have the notebook's red margin line, with the pt-BR
  pronunciation as a small tag beneath. Streak and progress use a gold "stamp" treatment.
- Rejected defaults: flat white SaaS cards with gray borders -> paper cards with a soft layered
  shadow and a red margin rule; a text-only tab bar -> icon plus label tabs; plain progress
  bars -> rings and letter tiles.

## Tokens (CSS variables in `style.css`, mapped in Tailwind `@theme`)

Light ("papel"):

| token | value | use |
| --- | --- | --- |
| `--paper` | `#f6f1e7` | page background (the desk) |
| `--sheet` | `#fffdf8` | cards (the notebook page) |
| `--sheet-2` | `#f0e9da` | inset areas, inputs |
| `--ink` | `#1b2433` | primary text |
| `--ink-2` | `#434d60` | secondary text |
| `--ink-3` | `#5f6878` | tertiary / metadata (still 4.5:1) |
| `--rule` | `#a99f8b` | control borders (3:1 on paper) |
| `--hairline` | `rgba(27,36,51,.10)` | dividers, card edges |
| `--accent` | `#b8352a` | primary action, active tab, margin line |
| `--on-accent` | `#fffdf8` | text on accent |
| `--gold` | `#b7791f` | streak, stars, achievements (text on sheet >= 4.5:1: use `--gold-ink` `#8a5a12`) |
| `--gold-soft` | `#f6e7c1` | gold stamp background |
| `--success` | `#2f6b45` / `--success-soft` `#dcefe1` | correct |
| `--danger` | `#a8281e` / `--danger-soft` `#f7dcd8` | wrong |

Dark ("lousa", chalkboard at night): `--paper #0f171e`, `--sheet #17222c`, `--sheet-2 #1f2d39`,
`--ink #f2ecde`, `--ink-2 #c9c3b3`, `--ink-3 #a8a496`, `--rule #6c7f8c`, `--hairline
rgba(242,236,222,.12)`, `--accent #ee7a68`, `--on-accent #1a0f0d`, `--gold #e3b04b`,
`--gold-soft #3a3018`, `--success #8fd0a0`, `--danger #ff9d90`. Same hue family, only lightness
shifts. Keep every text/background pair at 4.5:1 and control borders at 3:1.

Depth strategy (one, committed): **layered soft shadows on paper cards**, no dark borders.
Light: `0 0 0 1px var(--hairline), 0 1px 2px rgba(27,36,51,.06), 0 6px 16px -8px rgba(27,36,51,.18)`.
Dark: a 1px ring `0 0 0 1px var(--hairline)` only (shadows do not read on dark).

Radius scale (concentric): control 10px, card 16px, hero/sheet 20px, pill 999px. Nested element
radius = parent radius minus padding.

Spacing: 4px base, multiples only (4 8 12 16 20 24 32 40 56). Density: comfortable on mobile
(card padding 16 to 20), page gutter 20, section gap 32.

## Type

- UI and body: **Golos Text** (variable, made for Cyrillic and Latin).
- Letters, words and display: **Source Serif 4** (variable, with Cyrillic). Headings (h1/h2) also
  use Source Serif 4, semibold, slightly tight tracking (-0.01em to -0.02em).
- Scale, ratio 1.25 on a 16px body: caption 12, small 14, body 16, h3 20, h2 25, h1 31, display 40,
  letter-hero 72 to 96 (letters) . Hierarchy by weight and color as much as size
  (value 600 `--ink`, label 500 `--ink-2`, meta 400 `--ink-3`). `font-variant-numeric:
  tabular-nums` on every number. `text-wrap: balance` on headings, `pretty` on paragraphs.
  Line-height 1.5 body, 1.15 headings.

## Components (src/components, reuse; extract on the second use)

`Button` (primary accent / secondary sheet / ghost / danger; sizes md 44px and lg 52px; leading
icon; loading state; press scale .97), `Card` (sheet surface, optional red margin rule on the
left via `margin` prop), `Badge`/`Chip`, `Icon` (Lucide, stroke 1.75, size 20), `PageHeader`
(eyebrow, title, description, action), `Stat` (label, value, hint), `ProgressRing` (SVG, value
over total), `Tabs` bar with icons, `Field` (label, help, error) with `Input`/`Select`/`Textarea`,
`Switch` (role switch), `Segmented`, `Notice` (info/success/warning/danger with icon),
`LetterCard` (big serif glyph + pronunciation tag).

States are not optional: default, hover, active, focus-visible (2px accent ring, 2px offset),
disabled, loading, empty, error for everything interactive and every data view.

## Motion

Felt, not watched. Under 300ms. `cubic-bezier(0.23, 1, 0.32, 1)` ease-out, never ease-in.
Only `transform` and `opacity`. Press: `scale(.97)`. Page and card entrance: 8px rise plus
fade, 180ms, stagger 40ms. Correct answer: a soft gold or green pulse; wrong: a 2px shake once.
Everything respects `prefers-reduced-motion` (keep fades, drop movement). No animation on
keyboard shortcuts or repeated taps of the same control.

## Navigation (v2: no sidebar)

See "Design v2" below: a floating dock at the bottom on every window size.

## Copy

All UI text is Brazilian Portuguese, warm and direct ("Vamos praticar?"), no jargon. Russian
shown with its approximate pronunciation, e.g. `Привет (pri-VIÉT)`.


# Design v2 (owner feedback: below the expected standard; no sidebar; must scale with the window)

Binding. Where this section and the earlier ones disagree, this section wins.

## Window and scaling

- The desktop window has a **minimum of 480x680 and no maximum** (maximize and full screen work).
  Default 1100x780.
- **The whole UI scales continuously with the window width.** Set a fluid root size, for example
  `html { font-size: clamp(15px, 11px + 0.65vw, 21px); }`, and size EVERYTHING in `rem`/`em`/`%`
  (padding, gaps, radii, icon size, control heights, max widths); `px` only for hairlines. Tailwind
  spacing and type utilities are already `rem`, so they scale. Target: body about 16px near 480px
  wide, about 18px at 1100px, about 20px from 1600px; verify at 480x680, 800x700, 1100x780,
  1600x1000 and 2200x1200 that proportions hold (nothing tiny on a big window, nothing cramped on
  a small one). Content max widths are in `rem` (reading column 40rem, wide layouts 68rem) and
  content is centered with generous breathing room.
- **Layouts compose to the window, not just stack.** Wide windows (>= about 60rem) use real
  multi-column compositions (for example Home: hero on the left, alphabet map and stats on the
  right; Play: modes grid beside a sticky summary), narrow windows stack. No wasted empty bands.

## Navigation: the floating dock

- No sidebar and no full-width tab bar. A **floating pill dock**, centered, fixed at the bottom
  (`bottom: calc(1rem + env(safe-area-inset-bottom))`), the same on every window size.
- Five items (Início, Jogar, Músicas, Progresso, Configurações), icon plus label. Below about
  36rem the labels of inactive items collapse so only the active item shows its label. The active
  item sits on an accent pill that slides between items (transform only).
- Surface: sheet color at about 85% opacity with `backdrop-filter: blur`, hairline ring, layered
  soft shadow. Hit targets at least 2.75rem. Keep `<nav aria-label="Navegação principal">` with
  exactly five links, skip link, page titles.
- A slim header at the top of every screen: the "Ruvox" wordmark (Source Serif 4) on the left, the
  streak stamp on the right. Content gets bottom padding so the dock never covers it.
- **The dock hides during a running session** (Quiz, Flashcard, Pairs, Result keeps it) so the
  session is focused; provide a React context so the session screens can request it. Sticky action
  bars inside sessions sit at the bottom edge.

## Look: richer, more crafted

The first pass was flat and template-like. Raise it with these concrete moves (all in the
Caderno world, none decorative without meaning):

1. **Atmosphere**: a very subtle paper grain over the page (inline SVG `feTurbulence` as a data
   URI, opacity about 0.04 light and 0.06 dark) and a faint ruled-notebook line pattern behind
   hero areas. Dark mode ("lousa") gets a soft vignette.
2. **Illustration**: a small set of crisp line-art SVG components in `components/art/`, drawn with
   the tokens (stroke `--ink-2`, accents in `--accent`/`--gold`): an onion-dome skyline for the
   Home hero, a laurel for achievements, a postage-stamp frame, a notebook corner. Ghosted giant
   Cyrillic letters (Я, Ж, Ш) as background watermarks at 4 to 6 percent opacity.
3. **Signature: the alphabet map ("Mapa do alfabeto")**: all 33 letters as a tile grid grouped in
   the three groups, each tile colored by mastery (`new` outlined, `learning` accent-soft,
   `familiar` gold-soft, `mastered` solid success) with the letter in Source Serif 4. Data from
   `GET /api/progress/letters` (`id`, `text`, `pronunciation`, `group`, `status`). It is the hero
   data visualization on Home and on Progress, with a legend and a text alternative; tiles link to
   the alphabet. This is what makes the product recognizable.
4. **Hierarchy**: one focal element per screen with real scale contrast (display letters at
   6 to 9rem on heroes and question cards, UI at 1rem), tighter tracking on display, weight and
   color for secondary levels, tabular numbers.
5. **Depth**: layered shadows and one raised level (cards) plus a floating level (dock, dialogs).
   Gold used for streaks and achievements only, with a foil-like gradient (subtle) and a stamp
   treatment.
6. **Motion that feels good**: page entrance (rise + fade, stagger), dock pill slide, a
   stamp-in (scale from 0.9 with a 2 degree rotation, 220ms) on a correct answer and on streak
   updates, tile hover lift, number count-up under 600ms on Home stats. All transform/opacity,
   under 300ms for interactions, `prefers-reduced-motion` respected.
7. **Empty and first-run states are designed** (illustration, one clear action), not blank.
8. **Details**: concentric radii, optical alignment, `tabular-nums`, `text-wrap: balance/pretty`,
   focus rings, press feedback `scale(.97)`, consistent 4px grid.

## Skills and critique

Before building and before finishing, run the design skills available in the session
(`interface-design`, `design-skills:design-elevation`, `better-typography`,
`design-skills:interaction-design`, `design-skills:design-critique`) and apply what they flag.
Judge every result from real screenshots at the five window sizes above in light and dark.
