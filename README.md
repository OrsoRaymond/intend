# Intend

**More life. Less noise.**

Intend's companion website and interactive app preview, based on the supplied October 14, 2026 product vision. Editorial and calm: limewash, travertine and bronze, Instrument Serif headlines with Geist text, the brand photograph full-bleed in the hero, line icons only (no emoji or symbol glyphs), gentle depth and scroll reveals, and quiet generated sounds. The app preview is a calm daily dashboard: intention, progress ring, a 1 to 5 mood scale, habits, eight water glasses, a mood chart with tooltips, one-question reflections, quiet milestone notes, and a day and evening look.

## Run

Node.js 20 or newer. There are **no runtime or build dependencies**, no package installation, API keys, database, or accounts.

```sh
npm start
# http://localhost:4173
```

```sh
npm test
npm run build
npm run check
```

## Pages

| Route | Experience |
| --- | --- |
| `/` | Editorial marketing website, dimensional journal/phone composition, day/night story, product vision, FAQ, and OTORO attribution |
| `/app/` | Interactive memory-only app preview |
| `/privacy/` | Privacy notice describing the actual preview behavior |
| `/terms/` | Basic terms for the preview |
| `/404.html` | Friendly missing-page screen |

## Working in mock version 1

- First-open preview disclosure, direct dashboard entry, optional personalization, one question per reflection screen.
- Morning intention and evening reflection; edit them from the Journal.
- Mood selections, gratitude, daily priorities, movement, three good things, and a word for the day.
- Custom habits, check/uncheck, removal, and water logging.
- Today dashboard: a sky that follows the time of day, activity rings, a mood scale, and a glass that fills with animated water (pour, splash, waves) and a generated pouring sound. Taps update only what changed, so the page never flashes or reloads.
- Day and dark appearance, responsive dashboard cards, floating mobile navigation, keyboard controls, and reduced-motion support.
- Weekly reflection note; illustrative 7/30-day patterns and sample 30-day recipe.
- Preference controls, clear-preview confirmation, mobile navigation, legal links.

Personal input exists **only in JavaScript memory**. Refreshing, closing, or leaving the app clears it. The app does not use browser storage, cookies, service workers, a database, analytics, network requests, or an AI provider. Back/forward cache restoration starts a fresh preview. Hosting infrastructure may independently process normal access metadata or provide an access gate.

## Clearly planned, not implemented

Native iOS/Android binaries, user accounts, persistent history, notifications, health connections, photo access, OCR, paper-journal ordering, and real personal pattern analysis. Screens labeled illustrative use fictional data. The preview does not make medical recommendations or claim causal effects.

## Deploy

The `dist/` directory is the deployable site. `npm run build` updates SEO metadata, the sitemap, and content-based asset version tags; it does not need a bundler. Set `SITE_URL` to the final public origin before building, or change `site.config.json`.

```sh
SITE_URL=https://your-real-domain.example npm run build
```

Vercel: import the repository with the repository root as the Root Directory. The included `vercel.json` sets the static framework preset, build command `npm run build`, and output directory `dist`, overriding the default `public` directory. It also supplies security headers, app HTML `Cache-Control: no-store`, asset caching, and trailing-slash redirects. Set `SITE_URL` in Vercel's environment variables to the final public origin. Deploy the latest `main` commit; redeploying an older commit will not include this configuration.

Other static hosts should support directory indexes and a real 404 fallback. Cloudflare Pages: build command `npm run build`, output `dist`. The provided `_headers` and `_redirects` implement security headers and clean route redirects on compatible hosts. On other hosts, translate these rules into the equivalent server configuration; keep app HTML `Cache-Control: no-store`. The included Node server also enforces the security headers and serves 404/405 responses correctly. HTTPS must be provided by your production host.

`.openai/hosting.json` identifies the associated private Sites preview. The GitHub repository is the source handoff. Changing the public host requires updating `SITE_URL`; do not assume this preview's canonical URL is your final public domain.

## Before a full product launch

This release is ready to demonstrate **as a mock preview**. It is not the data-storing, native product described in the roadmap. The terms/privacy pages are a practical draft for this preview, not an assurance of legal protection. Have the intended operator confirm ownership, contact routing, applicable obligations, and hosting behavior before a public commercial release. Replace the policy before adding accounts, health data, photos, tracking, or retention. No independent security certification is claimed by the footer attribution.

## Project structure

- `dist/index.html`: semantic, pre-rendered website content.
- `dist/assets/styles.css`: shared responsive design system (website, legal pages, fonts).
- `dist/assets/app.css`: the app dashboard design, day and evening looks, and animations.
- `dist/assets/site.js`: website dialogs, navigation, story controls, and motion.
- `dist/assets/state.js`: small, pure app state operations.
- `dist/assets/app.js`: app views, forms, navigation, and ephemeral session behavior. Views are morphed onto the page so only changed parts update.
- `dist/assets/sound.js`: soft sounds synthesised with the Web Audio API. The water pour plays `dist/assets/sounds/pour.mp3`, with a generated pour as a fallback.
- `scripts/`: no-dependency server, metadata build, and static verification.
- `tests/`: state isolation, reflection validation, habits, hydration bounds, and escaping.

## Credits and assets

Product vision supplied by the project owner, attributed in the brief to Jeannette Breitfuss. Built and secured with Orso Solutions × [OTORO](https://otoro.si). These credits are not a representation of an independent audit.

`dist/assets/quiet-room.webp` is an original image generated with the built-in image-generation tool for this project. Prompt: an editorial architectural photograph of an espresso linen journal on travertine in an ivory limewash room, with a brass sun ornament, olive branch, and soft morning shadows; no text, logos, or people. The asset was encoded to WebP for delivery. The dimensional phone, decorative shapes, and interface are HTML/CSS; icons are inline SVG. Instrument Serif and Geist are hosted locally in `dist/assets/fonts/` (`instrument-serif.woff2`, `instrument-serif-italic.woff2`, `geist-variable.woff2`, Latin subsets from Fontsource), each under the SIL Open Font License (`OFL-instrument-serif.txt`, `OFL-geist.txt`). Font sources: https://github.com/google/fonts/tree/main/ofl/instrumentserif and https://github.com/google/fonts/tree/main/ofl/geist. No third-party font calls are made.

`dist/assets/sounds/pour.mp3` is a pouring-water recording supplied by the project owner (original file name `freesound_community-pouring-glass-of-water-104819.mp3`, which suggests the Pixabay user freesound_community; confirm its licence before a commercial release).

Privacy implementation reference: [FTC mobile health app developer guidance](https://www.ftc.gov/business-guidance/resources/mobile-health-app-developers-ftc-best-practices), consulted October 17, 2026.
