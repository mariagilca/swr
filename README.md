# Backcountry Swiftwater Rescue — Website

Docusaurus site for the Backcountry Swiftwater Rescue awareness project, in
collaboration with the Washington Mountain Rescue Association (WMRA).

## Content map

- `docs/intro.mdx` — project overview and landing for the doc sidebar
- `docs/the-problem.mdx` — structural issues in SAR, sourced from
  interviews
- `docs/what-is-swiftwater-rescue.mdx` — working definition of backcountry
  swiftwater rescue
- `docs/certification-maze.mdx` — FEMA/NFPA/WAC/NASAR credential stack
  (Jesse)
- `docs/the-gap.mdx` — recreational experts vs. official response
- `docs/the-bridge.mdx` — proposed WMRA-hosted resource
- `docs/resources.mdx` — photos, video, partner orgs
- `docs/get-involved.mdx` — calls to action by audience
- `blog/*.mdx` — interview notes (Jesse, Brent)

## Local development

```bash
npm install
npm start
```

The dev server runs on <http://localhost:3000>.

## Production build

```bash
npm run build
npm run serve
```

## Deployment

Intended to be hosted by WMRA. For a static host, deploy the `build/`
directory. For GitHub Pages:

```bash
GIT_USER=<github-username> npm run deploy
```
