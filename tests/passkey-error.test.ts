import { expect, it } from 'vitest';
import { passkeyError } from '../src/lib/passkey-error';

it('distinguishes setup, device, and server failures without treating cancellation as verification', () => {
  expect(passkeyError(new Error('Sign in again.'), 'options')).toContain('Could not start');
  expect(passkeyError(new Error('Passkey not found.'), 'verify')).toContain(
    'Auctus could not verify',
  );
  const wrapped = new Error('Unable to sign in using passkey', {
    cause: new DOMException('Unavailable', 'NotAllowedError'),
  });
  expect(passkeyError(wrapped, 'device')).toContain('Device: NotAllowedError');
  expect(passkeyError(new DOMException('Invalid domain', 'SecurityError'), 'device')).toContain(
    'Device: SecurityError',
  );
});
