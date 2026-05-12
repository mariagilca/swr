# Backcountry Swiftwater Rescue (SWR) — Docusaurus site

Awareness resource for backcountry swiftwater rescue training, certification, and operational safety in Washington State. Built by Team ReelCraft for PTW 330.

## Project structure

```
swr-docusaurus/
├── docs/                              # Markdown content (sidebar order set per-file)
│   ├── about-this-site.md
│   ├── why-different.md
│   ├── certification-pathways.md
│   ├── training-gap.md
│   ├── risk-and-safety.md
│   ├── river-safety.md
│   ├── recommended-actions.md
│   └── resources.md
├── src/
│   ├── components/HomepageFeatures/   # Three teaser cards on the landing page
│   ├── pages/index.js                 # Custom landing page
│   ├── pages/index.module.css
│   └── css/custom.css                 # SAR-themed color variables and table styles
├── static/img/                        # Logo and social card SVGs
├── docusaurus.config.js
├── sidebars.js
└── package.json
```

## Run locally

Install Node 18 or later, then:

```bash
cd swr-docusaurus
npm install
npm start
```

The dev server opens at `http://localhost:3000/swr/`.

## Build for production

```bash
npm run build
```

Output is written to `build/`.

## Deploy to GitHub Pages

The config in `docusaurus.config.js` is pre-set for `https://mariagilca.github.io/swr/`. To deploy:

```bash
GIT_USER=mariagilca npm run deploy
```

That command builds the site and pushes to the `gh-pages` branch.

If your repo is named or owned differently, update `url`, `baseUrl`, `organizationName`, and `projectName` in `docusaurus.config.js` first.

## Editorial notes

Content follows the [Splunk Style Guide](https://help.splunk.com/en/splunk-style-guide/welcome-to-the-splunk-style-guide):

- Active voice, second person where appropriate
- Sentence-case headings
- "And" rather than "&" in body text
- Plain language for legal and technical references
- Tables for comparisons (instead of paragraphs)

## What's still TBD

These items are flagged in the source content and remain to be finalized:

- Embedded hero video on the home page (placeholder copy in place)
- Final 30-60 second video clip and 3-4 minute full awareness video
- A certification decision-map graphic for the Certification pathways page
- Updated stats from the Chelan County rescue-trend data once the source doc is finalized
- Permission confirmation for any third-party video footage referenced in `Video Table.docx`
