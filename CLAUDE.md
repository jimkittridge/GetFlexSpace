# Working in this repo

**Read [README.md](./README.md) first.** It covers the stack, project structure,
how content is edited, the build/deploy failure modes, and the open issues.
Everything there applies — this file only adds the working conventions.

## Conventions

- Work on `claude/build-flexspace-site-dSsmL`. **Do not push to `master`** — it
  is protected and pushes are rejected. Changes reach master via a PR.
- **Run `npm run build` before pushing** any content or schema change. A failing
  build does not surface as an error on the live site; it just silently stops
  publishing, so the site goes stale with no warning. This has been the root
  cause of "the site isn't updating" twice.
- The CMS commits straight to the branch named in `public/admin/config.yml`, so
  expect to `git pull --rebase` before pushing — content commits land out of
  band while you work.

## Environment limits

- The sandbox **cannot reach `getflexspace.com`** (egress blocked), so a deploy
  cannot be verified from here. Say the deploy is unverified rather than
  assuming it landed.
- Repository **settings** writes (rename, visibility, etc.) are blocked by the
  GitHub proxy. Read access and git push work; settings changes must be done by
  hand in the GitHub UI.
