# Idlewild brand assets

[← Back to Idlewild](../../README.md) · [Screenshot gallery](../GALLERY.md)

Original vector artwork using the resort’s warm cream, sage, sea-glass, and terracotta palette. These assets are included under the project’s [MIT license](../../LICENSE).

| Asset                                | Preview                                                                             | Use                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [Resort banner](idlewild-banner.svg) | <img src="idlewild-banner.svg" alt="Idlewild illustrated banner" width="520" />     | README headers and project introductions; 1600 × 480 SVG.      |
| [Guest lineup](guests.svg)           | <img src="guests.svg" alt="Robot, cat, plant, and orb guest avatars" width="520" /> | Introduce the four avatar styles; 1440 × 300 SVG.              |
| [Palm mark](idlewild-mark.svg)       | <img src="idlewild-mark.svg" alt="Idlewild palm mark" width="64" />                 | Small project icons and repository documentation; 64 × 64 SVG. |

| Badge                     | Preview                                                     |
| ------------------------- | ----------------------------------------------------------- |
| [License](license.svg)    | <img src="license.svg" alt="MIT license badge" />           |
| [Agents](agents.svg)      | <img src="agents.svg" alt="MCP and WebMCP badge" />         |
| [Hosting](cloudflare.svg) | <img src="cloudflare.svg" alt="Cloudflare Workers badge" /> |

The banner reuses the actual island illustration. The lineup uses the actual check-in avatar artwork. The SVGs are self-contained, with no scripts, external images, remote fonts, or private guest data.

Regenerate them alongside the screenshots with `npm run docs:screenshots`. The app’s source artwork stays in `src/main.tsx` and `public/favicon.svg`. Font license files remain in `public/fonts/`.
