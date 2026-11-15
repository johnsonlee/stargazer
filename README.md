# stargazer

Star history for any GitHub repository: cumulative stars plus new stars per day, week or month.

Live at <https://stargazer.johnsonlee.io>. Deep links look like `#/owner/repo?by=week` (`by` is `day` by default, or `week` / `month`).

## Development

Requires Node.js 26 LTS (see `.nvmrc`).

```sh
nvm use
npm install
npm start          # dev server with hot reload
npm run lint
npm run build      # production build into docs/
npm run preview    # serve the production build locally
```

## Deployment

Every push to `master` builds the site and publishes it to GitHub Pages via `.github/workflows/pages.yml`. `docs/` is build output and is not committed.
