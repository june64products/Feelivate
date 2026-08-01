# Marketing media

Files dropped here are served from the site root, so `public/media/demo.mp4`
is reachable at `/media/demo.mp4`.

## Hero (src/pages/HomePage.tsx)

| Constant             | Suggested file            | Notes                                       |
| -------------------- | ------------------------- | ------------------------------------------- |
| `HERO_VIDEO_SRC`     | `demo.mp4`                | 16:9, H.264, keep it under ~8 MB            |
| `HERO_VIDEO_POSTER`  | `demo-poster.jpg`         | First frame — shown before playback         |
| `HERO_PHOTOS[].src`  | `shot-1.jpg` … `shot-3.jpg` | 16:10, ~1200px wide                       |

Until a constant is filled in, the slot renders a labelled placeholder at the
final size, so adding the real asset never shifts the layout.

## Testimonial avatars (src/components/site/Testimonials.tsx)

`avatar: '/media/avatars/<file>.jpg'`, square, ~200px. Optional — entries
without an avatar fall back to initials.

Only add a testimonial once a real user said it and agreed to it being
published. See the comment block at the top of `Testimonials.tsx`.
