# Marketing media

Served from the site root: `public/media/hero.jpg` → `/media/hero.jpg`.

| File | Where it appears | Notes |
| --- | --- | --- |
| `hero.jpg` | Landing hero, 16:9 | Also the poster if a hero video is added |
| `shot-1.jpg` | Landing, "Tell it the goal" | |
| `shot-2.jpg` | Landing, "Today's task lands…" | |
| `shot-3.jpg` | Landing, "What you did versus what you said" | |
| `signup-loop.mp4` | Sign-up page right panel, 9:16 | Autoplays muted, desktop only |

All five are generated cinematic imagery, not screenshots. That is deliberate:
an invented interface on the marketing page is a promise the product has to keep
the moment someone signs up.

## Swapping in the real product

The slots take a real asset without any layout change:

- **Three feature images** — take three screenshots (chat with a plan card, the
  daily task email, a weekly report) and point `HERO_PHOTOS[].src` at them in
  `src/pages/HomePage.tsx`. The captions already carry the explanation.
- **Hero video** — record a demo, drop it here, set `HERO_VIDEO_SRC`. The hero
  swaps from still to video in the same 16:9 box, with `hero.jpg` as the poster.

## Regenerating

Keep the look consistent: pre-dawn blue hour, deep crushed blacks, a single warm
terracotta light source, 35mm grain, shallow depth of field. Every prompt must
say **no text, no logos, no legible screen content** — otherwise the model
invents an interface.

JPEGs are `sips`-encoded at quality 80–82 (hero 1600px wide, shots 1100px).
The five files total ~1.5 MB; keep it there.
