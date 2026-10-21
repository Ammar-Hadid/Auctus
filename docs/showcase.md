# Auctus showcase

Anonymous visitors see the Auctus product landing page at `/`. Its Sign in button opens `/login`, where a shared invitation code creates an independent, temporary journal. Existing users sign in at `/login/account`; the master password and passkey flow is unchanged. An authenticated visitor returns to their journal at `/`.

## Enable access

Run `pnpm showcase:code`. Share the generated code privately and put only its `SHOWCASE_CODE_HASH` value in the application environment (`.env.local` for local development). Restart the application after changing it. The generator uses 18 cryptographically random bytes; do not replace it with a short numeric PIN. The hash is deliberately not a `NEXT_PUBLIC_` variable.

An empty or invalid hash disables showcase login. Changing or removing the hash also invalidates existing demo sessions; the cleanup worker removes their journals. The generic Compose file forwards the variable. The VPS Compose file already loads its private environment file. Any production update must follow [the VPS deployment runbook](nexo-vps-deployment.md); implementing this feature does not deploy it.

## Isolation and lifecycle

Each successful code entry creates a new UUID identity, six fictional exercises, three workout templates, three weeks of fictional history, and one recent session if the current training week has enough elapsed time. No permanent account data is read or copied. Each visitor uses the same existing account-scoped training engine and database ownership constraints.

Showcase identities have a `showcase_visitor` marker and no `account_access`, credential, passkey, or Better Auth session row. `profile()` derives the `showcase` role from that marker. A random 256-bit bearer token lives in an HttpOnly, SameSite=Lax cookie; only its SHA-256 digest is stored. HTTPS adds Secure and the `__Host-` prefix. Sessions expire after two hours with no sliding renewal. Expiry is enforced on the server, even if client timers are suspended. The UI also returns to code entry at expiry.

Exit deletes the visitor's journal and clears the cookie. A process-wide worker cleans expired/revoked journals every minute and on startup; login also runs cleanup. Deletion checks for the showcase marker and explicitly removes related training records in foreign-key order. Permanent accounts are never cleanup targets. Historical database backups follow the existing backup retention policy and can retain demo records until those backups expire. Do not enter personal information in the demo.

## Permission contract

`viewerSession()` always prefers a real Better Auth session over a demo cookie. A pending master passkey therefore cannot be bypassed using a showcase cookie.

All protected routes must use `authorize()`. Its default rejects showcase sessions. Only `/api/state` and `/api/command` opt into `training.read` and `training.write`. Account management, passkey enrollment, and push subscriptions remain unavailable. `requireMaster()` separately rejects showcase identities at the service layer.

`requireShowcaseCommand()` permits only the listed training commands and session sub-actions. A future AI endpoint using the default `authorize()` is denied to showcase users, and adding an AI command to dispatch does not make it available. Do not opt paid/external integrations into training capabilities or add side effects to existing permitted commands without reviewing this boundary. Future features must keep these checks; no current code can guard a future endpoint that deliberately omits authentication.

The code endpoint enforces same-origin JSON requests and strict input validation. A database-backed global budget permits 20 attempts per minute, including failures. It intentionally ignores untrusted proxy IP headers. This protects code guessing but means a burst can briefly block other visitors. At most 100 journals may exist; each demo permits 400 successful commands and command payloads are limited to 32 KB. No external AI or notification calls are made by demo sessions.

## Verification

- Unit tests: identity/data isolation, missing/wrong codes, persistent rate limit, role restrictions, unknown future commands, expiry, code rotation, cleanup and preservation of permanent accounts.
- Browser tests: public page, invalid and valid code entry, independent browser sessions, real set completion, direct forbidden API calls, exit/revocation, and the existing master password/passkey flow.
- The product images are screenshots of the real app using fictional demo data. The hero is generated training photography. Geist is self-hosted under the included SIL Open Font License.

Verified locally on Node 24.22.0: 89 unit/integration tests, production build, type checking and lint. Chromium verifies the master password/passkey/account-provisioning flow; Chromium and mobile WebKit verify showcase access and the workout flow. Landing and login were checked at 320, 390, 768 and 1440 pixels with loaded images, keyboard FAQ access, no horizontal overflow and no uncaught browser errors. Physical iPhone testing remains separate from WebKit emulation.

The production dependency audit has no high or critical findings. One existing moderate esbuild development-server advisory remains in Better Auth's optional Drizzle tooling dependency; this change adds no npm dependencies.
