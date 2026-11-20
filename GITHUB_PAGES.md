# GitHub Pages deployment

Source repository: https://github.com/serbannegoita-design/judge-the-sample-starter

Expected public app address after a successful deployment:
https://serbannegoita-design.github.io/judge-the-sample-starter/

## Enable deployment

1. Sign in to GitHub and open the repository's Settings, then Pages.
2. Under Build and deployment, choose GitHub Actions as Source.
3. Push the committed changes to main with `git push` from this project folder.
4. Open Actions and watch Deploy app to GitHub Pages. A successful deployment provides
   the public URL. If the workflow ran before Pages was enabled, rerun its failed job.
5. Open that URL and confirm the data loads and sampling controls work.

The workflow runs on every push to main and can also be started manually. It installs
the lockfile dependencies with npm ci, runs the correctness checks, builds dist, and
uploads and deploys the built site. node_modules and dist remain ignored by git.

## CSV and asset paths

Vite's base is /judge-the-sample-starter/. The app fetches
import.meta.env.BASE_URL + 'heart_rate_week.csv', with loading and failure messages.
public/heart_rate_week.csv is an unchanged copy of data/heart_rate_week.csv. The original
data directory is retained; a test checks that the public copy matches byte for byte.
If the source dataset is intentionally updated later, update its public copy too.

The local development address now includes the base path:
http://127.0.0.1:5173/judge-the-sample-starter/

For local production verification, run npm run build, then npm run preview. Open the
printed address with /judge-the-sample-starter/ appended. Stop the preview with Ctrl+C.

## Checks completed before publication

All 28 automated checks and the production build passed. The built app was opened under
its repository subpath, loaded the data, and handled changing n to 1 and back to 100.
No browser console errors were observed. Repeated investigations were not run on the
student's behalf. The remote deployment still needs a successful push and Pages enablement.

Reference workflow: https://vite.dev/guide/static-deploy.html#github-pages
