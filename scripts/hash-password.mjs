// Prints a scrypt password hash as a ready-to-paste .env line.
// The password comes from a hidden prompt, or from stdin when piped.
import { createInterface } from 'node:readline';
import { randomBytes, scryptSync } from 'node:crypto';

function ask() {
  if (!process.stdin.isTTY) {
    const lines = createInterface({ input: process.stdin });
    return new Promise((resolve) => {
      let first;
      lines.on('line', (line) => {
        first ??= line;
      });
      lines.on('close', () => resolve(first ?? ''));
    });
  }
  process.stderr.write('Password: ');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve) => {
    let value = '';
    process.stdin.on('data', (chunk) => {
      for (const ch of chunk.toString('utf8')) {
        if (ch === '\r' || ch === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stderr.write('\n');
          resolve(value);
          return;
        }
        if (ch === '\u0003') process.exit(130);
        if (ch === '\u007f') value = value.slice(0, -1);
        else value += ch;
      }
    });
  });
}

const password = await ask();
if (!password) {
  console.error('Empty password.');
  process.exit(1);
}

const N = 16384;
const r = 8;
const p = 1;
const salt = randomBytes(16).toString('base64url');
const derived = scryptSync(password, salt, 64, { N, r, p }).toString('base64url');
const encoded = `$scrypt$N=${N},r=${r},p=${p}$${salt}$${derived}`;

// Compose expands $ signs. In .env single quotes prevent that, and in an
// environment: list each $ is doubled instead.
console.log(`# For .env:\nDECKPRESS_PASSWORD_HASH='${encoded}'`);
console.log(
  `# For an environment: list in a compose file:\n- DECKPRESS_PASSWORD_HASH=${encoded.replaceAll('$', '$$$$')}`,
);
