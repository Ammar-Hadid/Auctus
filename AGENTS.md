<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Repository workflow

- Inspect the current branch, worktree status, and recent commits before editing. Preserve unrelated work.
- Reuse a suitable task branch. Create a short-lived `codex/<topic>` branch from the intended base when the work needs isolation; use a separate worktree when another agent is using the checkout. Verify the deployed ref before preparing a release; GitHub's default branch is not necessarily live.
- Commit a verified logical increment when it forms a useful review or rollback point, then continue the task. There is no fixed number of commits per task. Stage only intended files and write a clear `<type>: <specific outcome>` subject (`feat`, `fix`, `docs`, `test`, `refactor`, or `chore`). Explain a non-obvious reason in the body. Keep secrets, generated output, and unrelated formatting out of commits. Do not rewrite shared history.
- When asked to push or deploy, finish the relevant checks, push the intended commits, and report the commit SHA and result. For an isolated branch, integrate its reviewed commits into the deployed branch before updating the VPS.

## Production deployment

For **any Auctus deployment, VPS update, rollback, or production diagnostic**, read and follow [docs/nexo-vps-deployment.md](docs/nexo-vps-deployment.md) first. It contains the `ssh nexo-vps` access path, exact Auctus Compose file, backup and rollback procedure, deployment commands, and post-deployment checks. Inspect the live host before changing it; keep all operations scoped to Auctus and leave other VPS services untouched. A documentation-only repository update needs no image build or container restart.
