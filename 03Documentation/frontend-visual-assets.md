# Frontend Visual Assets

This document records the public landing-page media used by American Latin Class so the defense can distinguish local assets, generated assets, and third-party licensed footage.

## Hero Video

- Local file: `06Code/frontend/public/assets/hero-dance-class-pexels-6939802.mp4`
- Source: [Dancers Practicing in the Studio by Pavel Danilyuk](https://www.pexels.com/video/dancers-practicing-in-the-studio-6939802/)
- License status: marked by Pexels as free to use and download.
- Delivery: stored locally at 1280 x 720 instead of streamed from Pexels.
- Playback: muted, looping, inline, and paused by the page when the hero is outside the viewport. Reduced-motion users receive the poster instead of automatic motion.

## Program Photography

The six `program-*-v2.jpg` files were generated specifically for this project. Each image has a different subject, composition, and visual cue so visitors can identify the dance offering before reading its title.

| File | Intended subject |
| --- | --- |
| `program-salsa-v2.jpg` | Group salsa partnerwork in a bright studio |
| `program-bachata-v2.jpg` | Bachata couple connection in an evening studio |
| `program-hiphop-v2.jpg` | Synchronized urban choreography |
| `program-heels-v2.jpg` | Professional heels technique class |
| `program-afro-v2.jpg` | Afro, House, and Dancehall group movement |
| `program-ecuador-v2.jpg` | Ecuadorian traditional dance rehearsal |

All prompts required realistic adult dancers, a landscape website composition, no text, no logos, no watermark, and a restrained yellow accent compatible with the Cyber-Industrial Grid identity. The delivered PNG originals remain in the local Codex generated-image directory; optimized JPEG copies are the project assets.

## UX Rules

- Media must identify the dance style rather than function as generic decoration.
- Buttons use rectangular geometry and maintain readable foreground/background contrast.
- Branch controls must wrap long addresses without clipping or leaving their container.
- The embedded map and all media provide a static fallback or independent navigation path.
