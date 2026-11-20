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
  await runGit(dir, ['add', '-A']);
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
  if (!(await isGitRepo(dir))) {
    return { isRepo: false, branch: '', dirty: false, remoteUrl: null };
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
  };
}

export async function commitAll(dir: string, message: string): Promise<boolean> {
  if (!(await isGitRepo(dir))) {
    await initProjectRepo(dir, message);
    return true;
  }
  await runGit(dir, ['add', '-A']);
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
  return runGit(dir, ['pull', '--ff-only', 'origin', status.branch || 'main'], token);
}

export async function pushRemote(dir: string, token?: string): Promise<string> {
  const status = await getGitStatus(dir);
  if (!status.remoteUrl) throw new Error('No Git remote is connected');
  return runGit(dir, ['push', '-u', 'origin', status.branch || 'main'], token);
}
