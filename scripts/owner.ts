import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { openDatabase } from '../src/server/db/connection';
import { provisionOwner } from '../src/server/owner';

const readline = createInterface({ input: stdin, output: stdout });
const email = await readline.question('Owner email: ');
readline.close();
if (!stdin.isTTY) throw new Error('Run interactively in a terminal to enter a hidden password.');
stdout.write('Password (12+ characters; input hidden): ');
const password = await new Promise<string>((resolve, reject) => {
  let value = '';
  stdin.setRawMode(true);
  stdin.resume();
  const handler = (buffer: Buffer) => {
    const text = buffer.toString();
    if (text.includes('\u0003')) {
      cleanup();
      reject(new Error('Cancelled'));
      return;
    }
    if (text.includes('\r') || text.includes('\n')) {
      cleanup();
      resolve(value);
      return;
    }
    if (text === '\u007f') value = value.slice(0, -1);
    else value += text;
  };
  function cleanup() {
    stdin.setRawMode(false);
    stdin.off('data', handler);
    stdin.pause();
    stdout.write('\n');
  }
  stdin.on('data', handler);
});
const store = openDatabase();
try {
  await provisionOwner(store, email.trim(), password);
  console.log('Owner provisioned. Previous login sessions revoked.');
} finally {
  store.sqlite.close();
}
