import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import test from 'node:test';
import { createAuthRateLimiter, createBasicAuthVerifier } from './auth.js';
import { validateGitRemoteUrl } from './git.js';
import { resolveProjectCsvPath, sanitizeCsvFilename } from './projects.js';
import { validateExternalSheetUrl } from './sheets.js';

function makeScryptHash(password: string): string {
  const salt = 'testsalt12345678';
  const derived = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `$scrypt$N=16384,r=8,p=1$${salt}$${derived.toString('base64url')}`;
}

test('createAuthRateLimiter blocks after maxFailures and resets on success', () => {
  const limiter = createAuthRateLimiter({ maxFailures: 3, windowMs: 60_000, blockMs: 30_000 });
  const t0 = 1_000_000;

  assert.equal(limiter.check('1.2.3.4', t0).allowed, true);
  limiter.recordFailure('1.2.3.4', t0);
  limiter.recordFailure('1.2.3.4', t0 + 100);
  assert.equal(limiter.check('1.2.3.4', t0 + 200).allowed, true);

  limiter.recordFailure('1.2.3.4', t0 + 300);
  const blocked = limiter.check('1.2.3.4', t0 + 400);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec >= 29);

  // Other IPs unaffected
  assert.equal(limiter.check('5.6.7.8', t0 + 400).allowed, true);

  // Unblocks after blockMs
  assert.equal(limiter.check('1.2.3.4', t0 + 31_000).allowed, true);

  // Success clears failures
  limiter.recordFailure('9.9.9.9', t0);
  limiter.recordSuccess('9.9.9.9');
  assert.equal(limiter.check('9.9.9.9', t0).allowed, true);
});

test('createBasicAuthVerifier validates credentials with constant-time username and scrypt check', async () => {
  const hash = makeScryptHash('s3cret-pass');
  const verify = createBasicAuthVerifier('tomas', hash);

  const valid = 'Basic ' + Buffer.from('tomas:s3cret-pass').toString('base64');
  const wrongUser = 'Basic ' + Buffer.from('admin:s3cret-pass').toString('base64');
  const wrongPass = 'Basic ' + Buffer.from('tomas:wrong').toString('base64');

  assert.equal(await verify(undefined), false);
  assert.equal(await verify(wrongUser), false);
  assert.equal(await verify(wrongPass), false);
  assert.equal(await verify(valid), true);
  // Cached hit
  assert.equal(await verify(valid), true);
});

test('sanitizeCsvFilename and resolveProjectCsvPath prevent path traversal', () => {
  assert.equal(sanitizeCsvFilename('cards.csv'), 'cards.csv');
  assert.equal(sanitizeCsvFilename(''), 'cards.csv');
  assert.throws(() => sanitizeCsvFilename('../.env'));
  assert.throws(() => sanitizeCsvFilename('../../etc/passwd'));
  assert.throws(() => sanitizeCsvFilename('sub/cards.csv'));
  assert.throws(() => sanitizeCsvFilename('.env'));

  const okPath = resolveProjectCsvPath('my-game', 'deck.csv');
  assert.ok(okPath.endsWith('/projects/my-game/deck.csv'));
  assert.throws(() => resolveProjectCsvPath('my-game', '../other/cards.csv'));
});

test('validateExternalSheetUrl allows HTTPS public hosts and blocks private/local targets', () => {
  assert.equal(
    validateExternalSheetUrl('https://docs.google.com/spreadsheets/d/abc/pub?output=csv'),
    'https://docs.google.com/spreadsheets/d/abc/pub?output=csv',
  );
  assert.throws(() => validateExternalSheetUrl('http://docs.google.com/sheet.csv'));
  assert.throws(() => validateExternalSheetUrl('file:///etc/passwd'));
  assert.throws(() => validateExternalSheetUrl('https://localhost/secret'));
  assert.throws(() => validateExternalSheetUrl('https://127.0.0.1:8080/healthz'));
  assert.throws(() => validateExternalSheetUrl('https://169.254.169.254/latest/meta-data/'));
  assert.throws(() => validateExternalSheetUrl('https://172.20.0.2/admin'));
  assert.throws(() => validateExternalSheetUrl('https://caddy/config'));
});

test('validateGitRemoteUrl rejects flag injection, file://, localhost, and inline credentials', () => {
  assert.equal(
    validateGitRemoteUrl('https://github.com/tomashutnan/deckpress.git'),
    'https://github.com/tomashutnan/deckpress.git',
  );
  assert.throws(() => validateGitRemoteUrl('--upload-pack=evil'));
  assert.throws(() => validateGitRemoteUrl('file:///etc/passwd'));
  assert.throws(() => validateGitRemoteUrl('https://user:pass@github.com/a/b.git'));
  assert.throws(() => validateGitRemoteUrl('https://localhost/repo.git'));
});
