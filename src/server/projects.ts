import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createDefaultControlsSchema,
  type ControlsSchema,
} from '../shared/controls.js';
import {
  createBlankDesign,
  createStarterDesign,
  createStarterProjectConfig,
  STARTER_CSV,
} from '../shared/defaults.js';
import { DEFAULT_RENDERER_JS } from '../shared/runtime.js';
import type {
  AssetList,
  CardOverrides,
  DesignConfig,
  GitStatusInfo,
  ProjectConfig,
  ProjectDoc,
  ProjectDocMeta,
  ProjectDocsMap,
} from '../shared/types.js';
import {
  cloneProjectRepo,
  commitAll,
  getGitStatus,
  initProjectRepo,
  writeProjectGitToken,
} from './git.js';

export function getProjectsRoot(): string {
  if (process.env.DECKPRESS_DATA_DIR) {
    return path.resolve(process.env.DECKPRESS_DATA_DIR, 'projects');
  }
  return path.resolve(process.cwd(), 'projects');
}

export function getDemoProjectDir(): string {
  return path.resolve(process.cwd(), 'examples', 'classic-playing-cards');
}

export function sanitizeSlug(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  if (!slug) throw new Error('Project name must contain letters or numbers');
  return slug;
}

export function resolveProjectDir(slug: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    throw new Error('Invalid project slug');
  }
  const root = getProjectsRoot();
  const dir = path.resolve(root, slug);
  if (!dir.startsWith(root + path.sep)) {
    throw new Error('Invalid project path');
  }
  return dir;
}

export function sanitizeCsvFilename(input?: string): string {
  const clean = (input || 'cards.csv').trim();
  if (!clean) return 'cards.csv';
  if (clean.includes('/') || clean.includes('\\') || clean.includes('..')) {
    throw new Error('CSV filename must be a plain filename inside the project directory');
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.csv$/i.test(clean)) {
    throw new Error('CSV filename must end in .csv and contain only safe characters');
  }
  return clean;
}

export function resolveProjectCsvPath(slug: string, localCsv?: string): string {
  const dir = resolveProjectDir(slug);
  const safeCsv = sanitizeCsvFilename(localCsv);
  const resolved = path.resolve(dir, safeCsv);
  if (!resolved.startsWith(dir + path.sep)) {
    throw new Error('Invalid CSV path');
  }
  return resolved;
}

async function readJsonOrDefault<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function readTextOrDefault(filePath: string, fallback = ''): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return fallback;
  }
}

export interface ProjectSummary {
  slug: string;
  name: string;
  description: string;
  remoteUrl: string | null;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const root = getProjectsRoot();
  await fs.mkdir(root, { recursive: true });
  let entries = await fs.readdir(root, { withFileTypes: true });

  // Seed the bundled Classic Playing Cards showcase on first run when projects/ is empty
  const hasAnyProject = entries.some((e) => e.isDirectory() && !e.name.startsWith('.'));
  if (!hasAnyProject) {
    try {
      await fs.access(getDemoProjectDir());
      await createProject({ name: 'Classic Playing Cards', mode: 'demo' });
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
      // No bundled demo directory available; continue with empty list
    }
  }

  const projects: ProjectSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const dir = path.join(root, entry.name);
    const config = await readJsonOrDefault<ProjectConfig>(
      path.join(dir, 'project.json'),
      createStarterProjectConfig(entry.name, entry.name),
    );
    const git = await getGitStatus(dir);
    projects.push({
      slug: entry.name,
      name: config.name || entry.name,
      description: config.description || '',
      remoteUrl: git.remoteUrl,
    });
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

export interface LoadedProject {
  config: ProjectConfig;
  design: DesignConfig;
  controls: ControlsSchema;
  templateFiles: Record<string, string>;
  docs: ProjectDocsMap;
  overrides: CardOverrides;
  customCss: string;
  git: GitStatusInfo;
  assets: AssetList;
}

function isValidTemplateFilename(name: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(js|css)$/.test(name);
}

function isValidDocId(name: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name);
}

function isValidDocFile(name: string, ext: 'md' | 'html'): boolean {
  return new RegExp(`^[a-zA-Z0-9][a-zA-Z0-9._-]*\\.${ext}$`).test(name);
}

async function readProjectDocs(dir: string): Promise<ProjectDocsMap> {
  const docsRoot = path.join(dir, 'docs');
  const result: ProjectDocsMap = {};
  let entries;
  try {
    entries = await fs.readdir(docsRoot, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !isValidDocId(entry.name)) continue;
    const docDir = path.join(docsRoot, entry.name);
    const meta = await readJsonOrDefault<ProjectDocMeta>(path.join(docDir, 'doc.json'), {
      title: entry.name,
      pageSize: 'A4',
      orientation: 'portrait',
      columns: 1,
      marginMm: 9.5,
    });
    const stylesCss = await readTextOrDefault(path.join(docDir, 'styles.css'), '');
    const renderJsRaw = await readTextOrDefault(path.join(docDir, 'render.js'), '');

    const sections: Record<string, string> = {};
    const secEntries = await fs
      .readdir(path.join(docDir, 'sections'), { withFileTypes: true })
      .catch(() => []);
    for (const se of secEntries) {
      if (!se.isFile() || !isValidDocFile(se.name, 'md')) continue;
      sections[se.name] = await fs.readFile(path.join(docDir, 'sections', se.name), 'utf8');
    }

    const diagrams: Record<string, string> = {};
    const diagEntries = await fs
      .readdir(path.join(docDir, 'diagrams'), { withFileTypes: true })
      .catch(() => []);
    for (const de of diagEntries) {
      if (!de.isFile() || !isValidDocFile(de.name, 'html')) continue;
      diagrams[de.name] = await fs.readFile(path.join(docDir, 'diagrams', de.name), 'utf8');
    }

    const doc: ProjectDoc = {
      id: entry.name,
      meta,
      stylesCss,
      sections,
      diagrams,
      ...(renderJsRaw ? { renderJs: renderJsRaw } : {}),
    };
    result[entry.name] = doc;
  }

  return result;
}

async function writeProjectDocs(dir: string, docs: ProjectDocsMap): Promise<void> {
  const docsRoot = path.join(dir, 'docs');
  await fs.mkdir(docsRoot, { recursive: true });

  for (const [docId, doc] of Object.entries(docs)) {
    if (!isValidDocId(docId)) {
      throw new Error(`Invalid doc id: ${docId}`);
    }
    const docDir = path.join(docsRoot, docId);
    await fs.mkdir(docDir, { recursive: true });
    await fs.writeFile(
      path.join(docDir, 'doc.json'),
      JSON.stringify(doc.meta, null, 2) + '\n',
      'utf8',
    );
    await fs.writeFile(path.join(docDir, 'styles.css'), doc.stylesCss || '', 'utf8');
    if (doc.renderJs !== undefined) {
      await fs.writeFile(path.join(docDir, 'render.js'), doc.renderJs, 'utf8');
    }

    const secDir = path.join(docDir, 'sections');
    if (Object.keys(doc.sections || {}).length > 0) {
      await fs.mkdir(secDir, { recursive: true });
      const keepSec = new Set<string>();
      for (const [name, content] of Object.entries(doc.sections)) {
        if (!isValidDocFile(name, 'md')) {
          throw new Error(`Invalid section filename: ${name}`);
        }
        keepSec.add(name);
        await fs.writeFile(path.join(secDir, name), content, 'utf8');
      }
      const existingSec = await fs.readdir(secDir).catch(() => []);
      for (const file of existingSec) {
        if (isValidDocFile(file, 'md') && !keepSec.has(file)) {
          await fs.unlink(path.join(secDir, file)).catch(() => {});
        }
      }
    }

    const diagDir = path.join(docDir, 'diagrams');
    if (Object.keys(doc.diagrams || {}).length > 0) {
      await fs.mkdir(diagDir, { recursive: true });
      const keepDiag = new Set<string>();
      for (const [name, content] of Object.entries(doc.diagrams)) {
        if (!isValidDocFile(name, 'html')) {
          throw new Error(`Invalid diagram filename: ${name}`);
        }
        keepDiag.add(name);
        await fs.writeFile(path.join(diagDir, name), content, 'utf8');
      }
      const existingDiag = await fs.readdir(diagDir).catch(() => []);
      for (const file of existingDiag) {
        if (isValidDocFile(file, 'html') && !keepDiag.has(file)) {
          await fs.unlink(path.join(diagDir, file)).catch(() => {});
        }
      }
    }
  }
}

async function readTemplateFiles(dir: string): Promise<Record<string, string>> {
  const tplDir = path.join(dir, 'template');
  const files: Record<string, string> = {};
  try {
    const entries = await fs.readdir(tplDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !isValidTemplateFilename(entry.name)) continue;
      files[entry.name] = await fs.readFile(path.join(tplDir, entry.name), 'utf8');
    }
  } catch {
    // No template/ folder yet; fall back to legacy renderer.js
  }
  if (Object.keys(files).length === 0) {
    const legacy = await readTextOrDefault(path.join(dir, 'renderer.js'), DEFAULT_RENDERER_JS);
    files['index.js'] = legacy;
  }
  return files;
}

async function writeTemplateFiles(
  dir: string,
  templateFiles: Record<string, string>,
): Promise<void> {
  const tplDir = path.join(dir, 'template');
  await fs.mkdir(tplDir, { recursive: true });

  const keep = new Set<string>();
  for (const [name, content] of Object.entries(templateFiles)) {
    if (!isValidTemplateFilename(name)) {
      throw new Error(`Invalid template filename: ${name} (must end in .js or .css)`);
    }
    keep.add(name);
    await fs.writeFile(path.join(tplDir, name), content, 'utf8');
  }

  // Remove deleted template files
  const existing = await fs.readdir(tplDir).catch(() => []);
  for (const file of existing) {
    if (isValidTemplateFilename(file) && !keep.has(file)) {
      await fs.unlink(path.join(tplDir, file)).catch(() => {});
    }
  }
}

export async function loadProject(slug: string): Promise<LoadedProject> {
  const dir = resolveProjectDir(slug);
  await fs.access(dir);

  const [config, design, controls, templateFiles, docs, overrides, customCss, git, assets] =
    await Promise.all([
      readJsonOrDefault<ProjectConfig>(
        path.join(dir, 'project.json'),
        createStarterProjectConfig(slug, slug),
      ),
      readJsonOrDefault<DesignConfig>(
        path.join(dir, 'design.json'),
        createStarterDesign(),
      ),
      readJsonOrDefault<ControlsSchema>(
        path.join(dir, 'controls.json'),
        createDefaultControlsSchema(),
      ),
      readTemplateFiles(dir),
      readProjectDocs(dir),
      readJsonOrDefault<CardOverrides>(path.join(dir, 'overrides.json'), {}),
      readTextOrDefault(path.join(dir, 'custom.css'), ''),
      getGitStatus(dir),
      listAssets(slug),
    ]);

  return { config, design, controls, templateFiles, docs, overrides, customCss, git, assets };
}

export async function createProject(params: {
  name: string;
  mode: 'blank' | 'template' | 'demo' | 'clone';
  repoUrl?: string;
  token?: string;
  saveToken?: boolean;
  googleSheetUrl?: string;
}): Promise<LoadedProject> {
  const slug = sanitizeSlug(params.name);
  const dir = resolveProjectDir(slug);

  try {
    await fs.access(dir);
    throw new Error(`Project "${slug}" already exists`);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') throw err;
  }

  if (params.mode === 'clone') {
    if (!params.repoUrl?.trim()) {
      throw new Error('Repository URL is required for clone mode');
    }
    await cloneProjectRepo(params.repoUrl.trim(), dir, params.token);
    if (params.saveToken && params.token?.trim()) {
      await writeProjectGitToken(dir, params.token);
    }
    // Ensure required project files exist even if cloning an empty/partial repo
    await ensureProjectScaffold(dir, params.name, slug, 'template');
    return loadProject(slug);
  }

  if (params.mode === 'demo') {
    const demoDir = getDemoProjectDir();
    await fs.access(demoDir);
    await fs.cp(demoDir, dir, { recursive: true });
    const cfgPath = path.join(dir, 'project.json');
    const cfg = await readJsonOrDefault<ProjectConfig>(
      cfgPath,
      createStarterProjectConfig(params.name, slug),
    );
    cfg.name = params.name;
    cfg.slug = slug;
    if (params.googleSheetUrl) cfg.googleSheetUrl = params.googleSheetUrl;
    await fs.writeFile(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
    await initProjectRepo(dir, `chore: initialize ${params.name} from demo`);
    return loadProject(slug);
  }

  await fs.mkdir(dir, { recursive: true });
  await ensureProjectScaffold(dir, params.name, slug, params.mode, params.googleSheetUrl);
  await initProjectRepo(dir, `chore: initialize ${params.name} project`);
  return loadProject(slug);
}

async function ensureProjectScaffold(
  dir: string,
  name: string,
  slug: string,
  mode: 'blank' | 'template',
  googleSheetUrl?: string,
): Promise<void> {
  for (const sub of ['assets/fonts', 'assets/icons', 'assets/images', 'template']) {
    await fs.mkdir(path.join(dir, sub), { recursive: true });
  }

  const writeIfMissing = async (file: string, content: string) => {
    try {
      await fs.access(file);
    } catch {
      await fs.writeFile(file, content, 'utf8');
    }
  };

  const config = createStarterProjectConfig(name, slug);
  if (googleSheetUrl) config.googleSheetUrl = googleSheetUrl;
  const design = mode === 'blank' ? createBlankDesign() : createStarterDesign();

  await writeIfMissing(path.join(dir, 'project.json'), JSON.stringify(config, null, 2) + '\n');
  await writeIfMissing(path.join(dir, 'design.json'), JSON.stringify(design, null, 2) + '\n');
  await writeIfMissing(
    path.join(dir, 'controls.json'),
    JSON.stringify(createDefaultControlsSchema(), null, 2) + '\n',
  );
  await writeIfMissing(path.join(dir, 'template', 'index.js'), DEFAULT_RENDERER_JS);
  await writeIfMissing(path.join(dir, 'overrides.json'), '{}\n');
  await writeIfMissing(path.join(dir, 'custom.css'), '/* Project CSS overrides */\n');
  await writeIfMissing(path.join(dir, 'cards.csv'), STARTER_CSV);
  await writeIfMissing(path.join(dir, '.gitignore'), '.DS_Store\n*.tmp\n.env\n');
}

export async function saveProjectConfig(
  slug: string,
  config: ProjectConfig,
  commitMessage?: string,
): Promise<ProjectConfig> {
  const dir = resolveProjectDir(slug);
  const safeConfig: ProjectConfig = {
    ...config,
    slug,
    localCsv: sanitizeCsvFilename(config.localCsv),
  };
  await fs.writeFile(
    path.join(dir, 'project.json'),
    JSON.stringify(safeConfig, null, 2) + '\n',
    'utf8',
  );
  if (commitMessage) {
    await commitAll(dir, commitMessage);
  }
  return safeConfig;
}

export async function saveProjectDesign(
  slug: string,
  payload: {
    config?: ProjectConfig;
    design?: DesignConfig;
    controls?: ControlsSchema;
    templateFiles?: Record<string, string>;
    docs?: ProjectDocsMap;
    cardsCsv?: string;
    overrides?: CardOverrides;
    customCss?: string;
    commitMessage?: string;
  },
): Promise<void> {
  const dir = resolveProjectDir(slug);
  if (payload.config) {
    const safeConfig: ProjectConfig = {
      ...payload.config,
      slug,
      localCsv: sanitizeCsvFilename(payload.config.localCsv),
    };
    await fs.writeFile(
      path.join(dir, 'project.json'),
      JSON.stringify(safeConfig, null, 2) + '\n',
      'utf8',
    );
  }
  if (payload.design) {
    await fs.writeFile(
      path.join(dir, 'design.json'),
      JSON.stringify(payload.design, null, 2) + '\n',
      'utf8',
    );
  }
  if (payload.controls) {
    await fs.writeFile(
      path.join(dir, 'controls.json'),
      JSON.stringify(payload.controls, null, 2) + '\n',
      'utf8',
    );
  }
  if (payload.templateFiles) {
    await writeTemplateFiles(dir, payload.templateFiles);
  }
  if (payload.docs) {
    await writeProjectDocs(dir, payload.docs);
  }
  if (payload.cardsCsv !== undefined) {
    const cfg =
      payload.config ||
      (await readJsonOrDefault<ProjectConfig>(
        path.join(dir, 'project.json'),
        createStarterProjectConfig(slug, slug),
      ));
    await fs.writeFile(
      resolveProjectCsvPath(slug, cfg.localCsv),
      payload.cardsCsv,
      'utf8',
    );
  }
  if (payload.overrides) {
    await fs.writeFile(
      path.join(dir, 'overrides.json'),
      JSON.stringify(payload.overrides, null, 2) + '\n',
      'utf8',
    );
  }
  if (payload.customCss !== undefined) {
    await fs.writeFile(path.join(dir, 'custom.css'), payload.customCss, 'utf8');
  }
  await commitAll(dir, payload.commitMessage || 'chore: save design update');
}

export type AssetKind = 'fonts' | 'icons' | 'images';

export function isAssetKind(kind: string): kind is AssetKind {
  return kind === 'fonts' || kind === 'icons' || kind === 'images';
}

export async function listAssets(slug: string): Promise<AssetList> {
  const dir = resolveProjectDir(slug);
  const readList = async (kind: AssetKind): Promise<string[]> => {
    try {
      const files = await fs.readdir(path.join(dir, 'assets', kind));
      return files.filter((f) => !f.startsWith('.')).sort();
    } catch {
      return [];
    }
  };
  const [fonts, icons, images] = await Promise.all([
    readList('fonts'),
    readList('icons'),
    readList('images'),
  ]);
  return { fonts, icons, images };
}

export function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._\-\u00C0-\u024F ]+/g, '_').trim();
  if (!base || base.startsWith('.')) throw new Error('Invalid filename');
  return base;
}

export async function saveAsset(
  slug: string,
  kind: AssetKind,
  filename: string,
  buffer: Buffer,
): Promise<string> {
  const dir = resolveProjectDir(slug);
  const safeName = sanitizeFilename(filename);
  const targetDir = path.join(dir, 'assets', kind);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, safeName), buffer);
  await commitAll(dir, `assets: upload ${kind}/${safeName}`);
  return safeName;
}

export async function deleteAsset(
  slug: string,
  kind: AssetKind,
  filename: string,
): Promise<void> {
  const dir = resolveProjectDir(slug);
  const safeName = sanitizeFilename(filename);
  await fs.unlink(path.join(dir, 'assets', kind, safeName));
  await commitAll(dir, `assets: remove ${kind}/${safeName}`);
}

export async function loadCustomIconsSvg(slug: string): Promise<string[]> {
  const dir = resolveProjectDir(slug);
  const iconsDir = path.join(dir, 'assets', 'icons');
  try {
    const files = (await fs.readdir(iconsDir)).filter((f) => f.toLowerCase().endsWith('.svg'));
    const contents: string[] = [];
    for (const file of files) {
      const raw = await fs.readFile(path.join(iconsDir, file), 'utf8');
      // Extract inner SVG markup so it renders inside our uniform 24x24 icon wrapper
      const match = raw.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
      if (match && match[1]) contents.push(match[1]);
    }
    return contents;
  } catch {
    return [];
  }
}

export async function buildInlineCustomFontFacesCss(slug: string): Promise<string> {
  const dir = resolveProjectDir(slug);
  const assets = await listAssets(slug);
  const rules: string[] = [];

  for (const file of assets.fonts) {
    const family = path.parse(file).name.replace(/'/g, '');
    const ext = path.extname(file).toLowerCase();
    const format =
      ext === '.woff2'
        ? 'woff2'
        : ext === '.woff'
          ? 'woff'
          : ext === '.otf'
            ? 'opentype'
            : 'truetype';
    const mime =
      ext === '.woff2'
        ? 'font/woff2'
        : ext === '.woff'
          ? 'font/woff'
          : ext === '.otf'
            ? 'font/otf'
            : 'font/ttf';
    try {
      const buf = await fs.readFile(path.join(dir, 'assets', 'fonts', file));
      rules.push(
        `@font-face { font-family: '${family}'; font-weight: 100 900; src: url('data:${mime};base64,${buf.toString('base64')}') format('${format}'); font-display: block; }`,
      );
    } catch {
      // Ignore unreadable font file
    }
  }

  return rules.join('\n');
}
