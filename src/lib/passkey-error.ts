export type PasskeyStage = 'options' | 'device' | 'verify';

export function passkeyError(error: unknown, stage: PasskeyStage) {
  const message = error instanceof Error ? error.message : 'Please try again.';
  if (stage === 'options') return `Could not start passkey verification. ${message}`;
  if (stage === 'verify') return `Auctus could not verify this passkey. ${message}`;

  // SimpleWebAuthn wraps some DOMExceptions; retain the underlying browser name.
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
  const name = cause instanceof Error ? cause.name : 'UnknownError';
  if (name === 'NotAllowedError')
    return 'Your device did not return a passkey. The request may have been cancelled, timed out, or no available passkey matched. In your password manager, check that the Auctus item contains a passkey for this website. Then try again. (Device: NotAllowedError)';
  return `Your device could not use the passkey. ${message} (Device: ${name})`;
}
