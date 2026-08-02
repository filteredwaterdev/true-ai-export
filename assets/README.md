# Assets — Save to File / Transcript Portability

Icon assets for the proposed native "Save to file" export
button for claude.ai and other AI web interfaces.

## Icon concept

Document with folded top-right corner and right-facing arrow.

The document represents the conversation transcript. The
right-facing arrow represents the act of moving that content
out of the platform and into the user's local environment —
distinct from copy (clipboard), download (from internet),
and save (local file that already exists).

This icon represents a new function category:
**Transcript Portability** — the retrieval of conversation
data from a remote platform backend and its materialisation
as a portable local file, on demand, in a format of the
user's choosing, and unhindered by any virtualized rendering.

## Proposed UI behaviour

Button label: **Save to file**
Function category: **Transcript Portability**

Clicking the button opens a format picker menu:

```
Save to file
─────────────────
Markdown
Markdown (clean)
Plain text
Plain text (clean)
HTML
HTML (clean)
JSON
PDF — serif
PDF — serif (clean)
PDF — sans-serif
PDF — sans-serif (clean)
─────────────────
About these formats →
```

## Visual style

Matches the claude.ai interface icon style:
- Outlined, no fill
- stroke="currentColor" for full theme compatibility
- stroke-width="1.5" (increased to 2 at 16px for legibility)
- stroke-linecap="round"
- stroke-linejoin="round"
- 24×24 viewBox canonical master

## Files

| File | Format | Size |
|------|--------|------|
| `svg/export-icon.svg` | SVG | 24×24 canonical |
| `svg/export-icon-16.svg` | SVG | 16×16 |
| `svg/export-icon-32.svg` | SVG | 32×32 |
| `svg/export-icon-64.svg` | SVG | 64×64 |
| `svg/export-icon-128.svg` | SVG | 128×128 |
| `react/ExportIcon.jsx` | React | Configurable |
| `react/ExportIcon.tsx` | TypeScript React | Configurable |
| `png/export-icon.png` | PNG | 24×24 canonical |
| `png/export-icon-16.png` | PNG | 16×16 |
| `png/export-icon-32.png` | PNG | 32×32 |
| `png/export-icon-48.png` | PNG | 48×48 |
| `png/export-icon-64.png` | PNG | 64×64 |
| `png/export-icon-96.png` | PNG | 96×96 |
| `png/export-icon-128.png` | PNG | 128×128 |
| `png/export-icon-256.png` | PNG | 256×256 |

## PNG generation

PNG versions were generated from the corresponding SVG file
at each size using Affinity Designer. The SVG source files
are the canonical assets. To regenerate PNGs:

```bash
# Using Inkscape
inkscape export-icon.svg --export-type=png \
  --export-filename=export-icon-32.png --export-width=32

# Using ImageMagick
convert -background none export-icon.svg \
  -resize 32x32 export-icon-32.png
```

Note: the 16px PNG was generated from `export-icon-16.svg`
which uses stroke-width="2" for improved legibility at small
sizes. The canonical 24×24 PNG, 48x48 PNG, 96x96 PNG, and 256×256 PNG were all
generated from `export-icon.svg`. All other PNGs were
generated from their corresponding size-specific SVG files
using stroke-width="1.5".

## License

MIT. Use freely without attribution. If any platform
implements a native export feature using these assets,
no credit is required. Fixing the problem is the goal.
