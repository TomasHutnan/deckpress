import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { GitCommitInfo, GitStatusInfo } from '../shared/types.js';

const execFileAsync = promisify(execFile);

function authArgsForToken(token?: string): string[] {
  if (!token || !token.trim()) return [];
  // Ephemeral Basic auth header for HTTPS remotes; never persisted into .git/config.
  const encoded = Buffer.from(`x-access-token:${token.trim()}`).toString('base64');
  return ['-c', `http.extraheader=AUTHORIZATION: Basic ${encoded}`];
}

async function runGit(cwd: string, args: string[], token?: string): Promise<string> {
  const finalArgs = [...authArgsForToken(token), ...args];
  const { stdout } = await execFileAsync('git', finalArgs, {
    cwd,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
    },
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout.trim();
}

const PROJECT_ENV_FILE = '.env';

export async function readProjectGitToken(dir: string): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(path.join(dir, PROJECT_ENV_FILE), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (key !== 'GIT_TOKEN') continue;
      const val = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^['"]|['"]$/g, '');
      if (val) return val;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export async function writeProjectGitToken(dir: string, token: string): Promise<void> {
  const clean = token.trim();
  if (!clean) {
    await clearProjectGitToken(dir);
    return;
  }
  await ensureDotEnvGitignored(dir);
  const envPath = path.join(dir, PROJECT_ENV_FILE);
  await fs.writeFile(envPath, `GIT_TOKEN=${clean}\n`, { encoding: 'utf8', mode: 0o600 });
}

export async function clearProjectGitToken(dir: string): Promise<void> {
  try {
    await fs.unlink(path.join(dir, PROJECT_ENV_FILE));
  } catch {
    // Already absent
  }
}

async function ensureDotEnvGitignored(dir: string): Promise<void> {
  const giPath = path.join(dir, '.gitignore');
  try {
    const existing = await fs.readFile(giPath, 'utf8');
    const lines = existing.split(/\r?\n/).map((l) => l.trim());
    if (!lines.includes('.env')) {
      const sep = existing.endsWith('\n') || existing.length === 0 ? '' : '\n';
      await fs.writeFile(giPath, `${existing}${sep}.env\n`, 'utf8');
    }
  } catch {
    await fs.writeFile(giPath, '.DS_Store\n*.tmp\n.env\n', 'utf8');
  }
}

export async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await fs.access(path.join(dir, '.git'));
    return true;
  } catch {
    return false;
  }
}

export async function initProjectRepo(dir: string, initialMessage: string): Promise<void> {
  if (!(await isGitRepo(dir))) {
    await runGit(dir, ['init', '-b', 'main']);
  }
  await runGit(dir, ['config', 'user.name', 'DeckPress']);
  await runGit(dir, ['config', 'user.email', 'deckpress@local']);
  await runGit(dir, ['add', '-A', '--', ':!.env']);
  const status = await runGit(dir, ['status', '--porcelain']);
  if (status) {
    await runGit(dir, ['commit', '--no-gpg-sign', '-m', initialMessage]);
  }
}

export async function cloneProjectRepo(
  repoUrl: string,
  targetDir: string,
  token?: string,
): Promise<void> {
  const parent = path.dirname(targetDir);
  await fs.mkdir(parent, { recursive: true });
  await runGit(parent, ['clone', '--depth', '50', repoUrl, targetDir], token);
  await runGit(targetDir, ['config', 'user.name', 'DeckPress']);
  await runGit(targetDir, ['config', 'user.email', 'deckpress@local']);
}

export async function getGitStatus(dir: string): Promise<GitStatusInfo> {
  const hasSavedToken = Boolean(await readProjectGitToken(dir));
  if (!(await isGitRepo(dir))) {
    return { isRepo: false, branch: '', dirty: false, remoteUrl: null, hasSavedToken };
  }
  let branch = 'main';
  try {
    branch = await runGit(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
  } catch {
    branch = 'main';
  }
  const porcelain = await runGit(dir, ['status', '--porcelain']);
  let remoteUrl: string | null = null;
  try {
    const url = await runGit(dir, ['remote', 'get-url', 'origin']);
    // Never leak credentials if someone manually configured a URL with user:pass@
    remoteUrl = url.replace(/\/\/[^@/]+@/, '//');
  } catch {
    remoteUrl = null;
  }
  return {
    isRepo: true,
    branch,
    dirty: porcelain.length > 0,
    remoteUrl,
    hasSavedToken,
  };
}

export async function commitAll(dir: string, message: string): Promise<boolean> {
  if (!(await isGitRepo(dir))) {
    await initProjectRepo(dir, message);
    return true;
  }
  await runGit(dir, ['add', '-A', '--', ':!.env']);
  const status = await runGit(dir, ['status', '--porcelain']);
  if (!status) return false;
  await runGit(dir, ['commit', '--no-gpg-sign', '-m', message || 'chore: update design']);
  return true;
}

export async function getGitLog(dir: string, limit = 25): Promise<GitCommitInfo[]> {
  if (!(await isGitRepo(dir))) return [];
  try {
    const out = await runGit(dir, [
      'log',
      `-n`,
      String(limit),
      '--pretty=format:%H%x1f%h%x1f%cI%x1f%s',
    ]);
    if (!out) return [];
    return out.split('\n').map((line) => {
      const [hash, shortHash, date, message] = line.split('\x1f');
      return { hash, shortHash, date, message };
    });
  } catch {
    return [];
  }
}

export async function rollbackToCommit(dir: string, hash: string): Promise<void> {
  if (!/^[a-f0-9]{7,40}$/i.test(hash)) {
    throw new Error('Invalid commit hash');
  }
  // Restore tree contents from the target commit onto HEAD without rewriting history
  await runGit(dir, ['checkout', hash, '--', '.']);
  await commitAll(dir, `revert: restore design snapshot ${hash.slice(0, 7)}`);
}

export async function connectRemote(dir: string, remoteUrl: string): Promise<void> {
  const clean = remoteUrl.trim();
  if (!clean) throw new Error('Remote URL is required');
  // Reject URLs embedding inline credentials
  if (/^https?:\/\/[^/]+@/.test(clean)) {
    throw new Error('Do not embed credentials in the remote URL; pass a token only during Pull/Push.');
  }
  try {
    await runGit(dir, ['remote', 'get-url', 'origin']);
    await runGit(dir, ['remote', 'set-url', 'origin', clean]);
  } catch {
    await runGit(dir, ['remote', 'add', 'origin', clean]);
  }
}

export async function disconnectRemote(dir: string): Promise<void> {
  try {
    await runGit(dir, ['remote', 'remove', 'origin']);
  } catch {
    // Already disconnected
  }
}

export async function pullRemote(dir: string, token?: string): Promise<string> {
  const status = await getGitStatus(dir);
  if (!status.remoteUrl) throw new Error('No Git remote is connected');
  const effectiveToken = token?.trim() || (await readProjectGitToken(dir));
  return runGit(dir, ['pull', '--ff-only', 'origin', status.branch || 'main'], effectiveToken);
}

export async function pushRemote(dir: string, token?: string): Promise<string> {
  const status = await getGitStatus(dir);
  if (!status.remoteUrl) throw new Error('No Git remote is connected');
  const effectiveToken = token?.trim() || (await readProjectGitToken(dir));
  return runGit(dir, ['push', '-u', 'origin', status.branch || 'main'], effectiveToken);
}
