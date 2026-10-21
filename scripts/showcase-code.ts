import { createHash, randomBytes } from 'node:crypto';
const code = randomBytes(18).toString('base64url');
console.log('Share this showcase code privately:\n' + code);
console.log(
  '\nSet this in your server environment:\nSHOWCASE_CODE_HASH=' +
    createHash('sha256').update(code).digest('hex'),
);
console.log('\nChanging the hash revokes existing showcase sessions after the process restarts.');
