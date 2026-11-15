# stargazer

Star history for any GitHub repository: cumulative stars plus new stars per day, week or month, and a profile of who starred it — countries, companies, sign-up years, account age, followers, activity and the most-followed stargazers, from up to 1,000 public profiles sampled evenly across the star history. Zooming the chart narrows sign-ups and most-followed stargazers to the people who starred in that period.

Since June 2026 GitHub lists who starred a repository only to its admins and collaborators. For other repositories the chart is drawn from GitHub's daily star history (UTC days) and there is no stargazer profile.

Profiles are cached in the browser (IndexedDB) per user: identity for 30 days, followers and pushes for a day, contribution counts for a week.

The repository page refreshes itself in place every 5 minutes by default (10, 15, 30 or 60 minutes, or off, chosen next to the chart and remembered per browser). A refresh reads only new stargazer pages, or the latest 30 weeks of history, and pauses while the tab is hidden.

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
