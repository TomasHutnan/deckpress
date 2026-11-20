import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs/promises';
import path from 'node:path';
import { renderPrintDocumentHtml } from '../shared/renderCard.js';
import type {
  CardOverrides,
  DesignConfig,
  DesignVariant,
  ExportOptions,
  ProjectConfig,
} from '../shared/types.js';
import { createBasicAuthVerifier } from './auth.js';
import {
  clearProjectGitToken,
  connectRemote,
  disconnectRemote,
  getGitLog,
  pullRemote,
  pushRemote,
  rollbackToCommit,
  writeProjectGitToken,
} from './git.js';
import { renderHtmlToPdf } from './pdf.js';
import {
  buildCustomFontFacesCss,
  createProject,
  deleteAsset,
  isAssetKind,
  listAssets,
  listProjects,
  loadCustomIconsSvg,
  loadProject,
  resolveProjectDir,
  sanitizeFilename,
  saveAsset,
  saveProjectConfig,
  saveProjectDesign,
} from './projects.js';
import { fetchProjectCards } from './sheets.js';

const PORT = Number.parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const STATIC_DIR = process.env.DECKPRESS_STATIC_DIR || path.resolve(process.cwd(), 'dist/client');
const AUTH_USER = (process.env.DECKPRESS_USER || '').trim();
const AUTH_PASSWORD_HASH = (process.env.DECKPRESS_PASSWORD_HASH || '').trim();

const app = Fastify({ logger: true });

await app.register(multipart, {
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB per asset
  },
});

// Optional Basic Auth using scrypt password hash (skips /healthz)
if (AUTH_PASSWORD_HASH) {
  const verifyBasicAuth = createBasicAuthVerifier(AUTH_USER, AUTH_PASSWORD_HASH);
  app.addHook('onRequest', async (req, reply) => {
    if (req.url === '/healthz') return;
    if (await verifyBasicAuth(req.headers.authorization)) return;
    reply.header('WWW-Authenticate', 'Basic realm="DeckPress"');
    return reply.code(401).send({ error: 'Authentication required' });
  });
}

app.get('/healthz', async () => ({ ok: true }));

// --- Projects CRUD ---
app.get('/api/projects', async () => {
  const projects = await listProjects();
  return { projects };
});

app.post<{
  Body: {
    name: string;
    mode: 'blank' | 'template' | 'clone';
    repoUrl?: string;
    token?: string;
    saveToken?: boolean;
    googleSheetUrl?: string;
  };
}>('/api/projects', async (req, reply) => {
  try {
    const project = await createProject(req.body);
    return reply.code(201).send(project);
  } catch (err: unknown) {
    return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get<{ Params: { slug: string } }>('/api/projects/:slug', async (req, reply) => {
  try {
    return await loadProject(req.params.slug);
  } catch {
    return reply.code(404).send({ error: 'Project not found' });
  }
});

app.put<{
  Params: { slug: string };
  Body: { config: ProjectConfig; commitMessage?: string };
}>('/api/projects/:slug/config', async (req, reply) => {
  try {
    const config = await saveProjectConfig(
      req.params.slug,
      req.body.config,
      req.body.commitMessage || 'chore: update project settings',
    );
    return { config };
  } catch (err: unknown) {
    return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.put<{
  Params: { slug: string };
  Body: {
    config?: ProjectConfig;
    design?: DesignConfig;
    overrides?: CardOverrides;
    customCss?: string;
    commitMessage?: string;
    push?: boolean;
  };
}>('/api/projects/:slug/design', async (req, reply) => {
  try {
    await saveProjectDesign(req.params.slug, req.body);
    if (req.body.push) {
      const dir = resolveProjectDir(req.params.slug);
      await pushRemote(dir);
    }
    return await loadProject(req.params.slug);
  } catch (err: unknown) {
    return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
});

// --- Cards / Google Sheets ---
app.get<{
  Params: { slug: string };
  Querystring: { local?: string };
}>('/api/projects/:slug/cards', async (req, reply) => {
  try {
    const loaded = await loadProject(req.params.slug);
    return await fetchProjectCards(
      req.params.slug,
      loaded.config,
      req.query.local === '1',
    );
  } catch (err: unknown) {
    return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post<{ Params: { slug: string } }>('/api/projects/:slug/cards/upload', async (req, reply) => {
  try {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: 'CSV file required' });
    const buf = await file.toBuffer();
    const dir = resolveProjectDir(req.params.slug);
    const loaded = await loadProject(req.params.slug);
    await fs.writeFile(path.join(dir, loaded.config.localCsv || 'cards.csv'), buf);
    return await fetchProjectCards(req.params.slug, loaded.config, true);
  } catch (err: unknown) {
    return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
});

// --- Assets (fonts, icons, images) ---
app.get<{ Params: { slug: string } }>('/api/projects/:slug/assets', async (req) => {
  return listAssets(req.params.slug);
});

app.post<{ Params: { slug: string; kind: string } }>(
  '/api/projects/:slug/assets/:kind',
  async (req, reply) => {
    if (!isAssetKind(req.params.kind)) {
      return reply.code(400).send({ error: 'Invalid asset kind' });
    }
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: 'File required' });
    const buf = await file.toBuffer();
    const saved = await saveAsset(req.params.slug, req.params.kind, file.filename, buf);
    return { filename: saved, assets: await listAssets(req.params.slug) };
  },
);

app.get<{ Params: { slug: string; kind: string; filename: string } }>(
  '/api/projects/:slug/assets/:kind/:filename',
  async (req, reply) => {
    if (!isAssetKind(req.params.kind)) {
      return reply.code(400).send({ error: 'Invalid asset kind' });
    }
    try {
      const dir = resolveProjectDir(req.params.slug);
      const safeName = sanitizeFilename(req.params.filename);
      const fullPath = path.join(dir, 'assets', req.params.kind, safeName);
      const buf = await fs.readFile(fullPath);
      const ext = path.extname(safeName).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.woff2': 'font/woff2',
        '.woff': 'font/woff',
        '.ttf': 'font/ttf',
        '.otf': 'font/otf',
      };
      reply.type(mimeMap[ext] || 'application/octet-stream');
      return buf;
    } catch {
      return reply.code(404).send({ error: 'Asset not found' });
    }
  },
);

app.delete<{ Params: { slug: string; kind: string; filename: string } }>(
  '/api/projects/:slug/assets/:kind/:filename',
  async (req, reply) => {
    if (!isAssetKind(req.params.kind)) {
      return reply.code(400).send({ error: 'Invalid asset kind' });
    }
    try {
      await deleteAsset(req.params.slug, req.params.kind, req.params.filename);
      return { assets: await listAssets(req.params.slug) };
    } catch (err: unknown) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

// --- Git Versioning & Optional Remote Sync ---
app.get<{ Params: { slug: string } }>('/api/projects/:slug/git/log', async (req) => {
  const dir = resolveProjectDir(req.params.slug);
  return { commits: await getGitLog(dir, 30) };
});

app.post<{ Params: { slug: string }; Body: { hash: string } }>(
  '/api/projects/:slug/git/rollback',
  async (req, reply) => {
    try {
      const dir = resolveProjectDir(req.params.slug);
      await rollbackToCommit(dir, req.body.hash);
      return await loadProject(req.params.slug);
    } catch (err: unknown) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

app.post<{
  Params: { slug: string };
  Body: { action: 'connect' | 'disconnect'; remoteUrl?: string };
}>('/api/projects/:slug/git/remote', async (req, reply) => {
  try {
    const dir = resolveProjectDir(req.params.slug);
    if (req.body.action === 'disconnect') {
      await disconnectRemote(dir);
    } else {
      await connectRemote(dir, req.body.remoteUrl || '');
    }
    return await loadProject(req.params.slug);
  } catch (err: unknown) {
    return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post<{ Params: { slug: string }; Body: { token?: string } }>(
  '/api/projects/:slug/git/token',
  async (req, reply) => {
    try {
      const dir = resolveProjectDir(req.params.slug);
      const tok = (req.body?.token || '').trim();
      if (tok) {
        await writeProjectGitToken(dir, tok);
      } else {
        await clearProjectGitToken(dir);
      }
      return await loadProject(req.params.slug);
    } catch (err: unknown) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

app.post<{ Params: { slug: string }; Body: { token?: string } }>(
  '/api/projects/:slug/git/pull',
  async (req, reply) => {
    try {
      const dir = resolveProjectDir(req.params.slug);
      const output = await pullRemote(dir, req.body?.token);
      return { output, project: await loadProject(req.params.slug) };
    } catch (err: unknown) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

app.post<{ Params: { slug: string }; Body: { token?: string } }>(
  '/api/projects/:slug/git/push',
  async (req, reply) => {
    try {
      const dir = resolveProjectDir(req.params.slug);
      const output = await pushRemote(dir, req.body?.token);
      return { output, project: await loadProject(req.params.slug) };
    } catch (err: unknown) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

// --- PDF Export via Alpine + System Chromium ---
app.post<{
  Params: { slug: string };
  Body: {
    options: ExportOptions;
    draftVariant?: DesignVariant;
    draftOverrides?: CardOverrides;
    draftCustomCss?: string;
  };
}>('/api/projects/:slug/export/pdf', async (req, reply) => {
  try {
    const slug = req.params.slug;
    const loaded = await loadProject(slug);
    const cardsRes = await fetchProjectCards(slug, loaded.config);

    const opts = req.body.options;
    const variantKey = opts.variantKey || loaded.design.activeVariant;
    const variant =
      req.body.draftVariant ||
      loaded.design.variants[variantKey] ||
      Object.values(loaded.design.variants)[0];

    const filteredCards =
      opts.filterType && opts.filterType !== 'all'
        ? cardsRes.cards.filter((c) => c.type_group === opts.filterType)
        : cardsRes.cards;

    // Point Chromium at local loopback so uploaded images & fonts load cleanly
    const assetBaseUrl = `http://127.0.0.1:${PORT}/api/projects/${encodeURIComponent(slug)}/assets`;
    const [customFontFacesCss, customIconsSvg] = await Promise.all([
      buildCustomFontFacesCss(slug, assetBaseUrl),
      loadCustomIconsSvg(slug),
    ]);

    const html = renderPrintDocumentHtml({
      cards: filteredCards,
      variant,
      overrides: req.body.draftOverrides ?? loaded.overrides,
      options: opts,
      assetBaseUrl,
      customCss: req.body.draftCustomCss ?? loaded.customCss,
      customFontFacesCss,
      customIconsSvg,
    });

    const pdfBuffer = await renderHtmlToPdf(html, req.headers.authorization);
    reply
      .header('Content-Type', 'application/pdf')
      .header(
        'Content-Disposition',
        `attachment; filename="${slug}-${opts.mode}.pdf"`,
      );
    return reply.send(pdfBuffer);
  } catch (err: unknown) {
    req.log.error(err);
    return reply.code(500).send({ error: err instanceof Error ? err.message : String(err) });
  }
});

// --- Serve built React SPA in production ---
try {
  await fs.access(STATIC_DIR);
  await app.register(fastifyStatic, {
    root: STATIC_DIR,
    prefix: '/',
  });
  app.setNotFoundHandler(async (_req, reply) => {
    return reply.sendFile('index.html');
  });
} catch {
  app.get('/', async () => ({
    app: 'DeckPress API',
    note: 'Run Vite dev server for frontend or run npm run build first.',
  }));
}

await app.listen({ port: PORT, host: HOST });
