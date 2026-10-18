# iPhone rest alerts — verified 18 October 2026

## Supported behavior

Apple supports standards-based Web Push for Home Screen web apps on iOS/iPadOS 16.4 or later. A user must install the app and explicitly grant notification permission from a user gesture. Notifications can appear on the Lock Screen and while another app is open. HTTPS and a running application server are required for this implementation; this is not supported from Auctus's current local HTTP URL on an iPhone.

Sources: [WebKit: Web Push for Home Screen apps](https://webkit.org/blog/13878/), [WebKit: Meet Web Push](https://webkit.org/blog/12945/meet-web-push/).

Web Push is not an exact, persistent alarm. Delivery can be delayed by connectivity, device settings, or Focus. A received push must display a visible notification; it cannot be used as a silent background execution loophole. A notification already sent cannot reliably be recalled when a user changes a timer.

Safari/iOS does not implement navigator.vibrate. Notifications may request non-silent presentation and a vibration pattern on supported platforms, but iOS controls its own notification presentation. No web API guarantees a custom ringing sound, vibration, or bypass of silent/Focus settings. Historical WebKit reports about silent iOS notifications are not proof that every current iPhone behaves the same way; physical-device validation remains necessary.

Sources: [MDN compatibility data, Navigator.vibrate](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json), [Notifications silent property](https://developer.mozilla.org/en-US/docs/Web/API/Notification/silent), [WebKit notification sound report](https://bugs.webkit.org/show_bug.cgi?id=254969).

Without push, an iPhone can suspend the web page and its timers after app switching. Keeping a JavaScript timeout or an AudioContext alive is not a dependable background alarm. A native iOS implementation can use AlarmKit for scheduled alarms, including authorization and system alarm presentations; that requires a native app, not a PWA-only change.

Sources: [WebKit background audio suspension](https://bugs.webkit.org/show_bug.cgi?id=261554), [Apple AlarmKit](https://developer.apple.com/documentation/alarmkit/scheduling-an-alarm-with-alarmkit).

## Implementation

Foreground audio now uses a shared AudioContext, remembered preference, gesture-based resume, immediate Test sound preview, and a three-tone chime. Only successfully scheduled sound consumes an alert. A session-scoped completion key prevents repeated alerts on screen remount/reload. Where supported, the Audio Session API selects playback during the chime and restores auto afterward. No silent audio loop is used to keep the app alive. Browser audio cannot detect whether device volume or output routing made the sound physically audible.

Sources: [AudioContext.resume](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume), [AudioSession.type](https://developer.mozilla.org/en-US/docs/Web/API/AudioSession/type), [WebKit iOS silent-switch behavior](https://bugs.webkit.org/show_bug.cgi?id=237322).

Settings offers per-device background alert enrollment, test notification, and disable. Permission is requested only on the Enable button tap. Authenticated subscription endpoints accept only known HTTPS browser push services. Subscriptions reference login sessions; logout/password-reset revocation and expiration stop delivery. The server stores VAPID keys in the database, keeps them out of client state, and includes them in database backups.

The persistent Node server starts a one-second scheduler through Next.js instrumentation. It reads authoritative workout and rest state, including pauses and extensions, instead of trusting client deadlines. SQLite delivery claims prevent concurrent duplicate sends; failed deliveries receive bounded retries. Expired endpoints are deleted. Rest completion, workout completion, and paused timers suppress unsent notifications. Alarms more than 30 seconds overdue are dropped, with a 30-second push TTL. Network acknowledgements can still be ambiguous, so exactly-once external delivery is not promised. Background pushes are visible even when the app is open, as required by Safari.

Source: [web-push Node library](https://github.com/web-push-libs/web-push). Installed Next.js instrumentation documentation was inspected for server startup behavior.

## Deployment and validation

Set BETTER_AUTH_URL to the actual public HTTPS origin and run the regular persistent Node/Docker deployment. No separate scheduler process or Apple Developer membership is needed. VAPID keys are generated once and persisted automatically. Allow outbound HTTPS to the browser push services. An always-running Node server is required; this scheduler is not suitable for a sleeping/serverless deployment.

On the iPhone: open the HTTPS site in Safari, Add to Home Screen, launch Auctus there, sign in, open Settings → Rest alerts, and tap Enable background alerts. Allow the OS prompt. Use Test notification, then test a short rest while another app is open and while the screen is locked. Check iOS notification permissions, volume, sound/haptic settings, and Focus separately.

Automated coverage exercises audio scheduling, mute/suspension recovery, push deadline calculation, pause/extension/end behavior, deduplication, retries, endpoint validation, session revocation, service-worker notification display and click, and authenticated API boundaries. A physical iPhone and a public HTTPS deployment were not available in this session; real APNs delivery, audible speaker output, and iPhone haptics are not claimed as verified.
