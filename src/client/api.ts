import type { ControlsSchema } from '../shared/controls';
import type {
  AssetList,
  CardOverrides,
  CardRow,
  DesignConfig,
  DesignVariant,
  ExpandedCard,
  ExportOptions,
  GitCommitInfo,
  GitStatusInfo,
  ProjectConfig,
  ProjectDocsMap,
} from '../shared/types';

export interface ProjectSummary {
  slug: string;
  name: string;
  description: string;
  remoteUrl: string | null;
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

export interface CardsResponse {
  source: 'google-sheet' | 'local-csv';
  warning?: string;
  rows: CardRow[];
  cards: ExpandedCard[];
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listProjects: () => jsonFetch<{ projects: ProjectSummary[] }>('/api/projects'),

  createProject: (body: {
    name: string;
    mode: 'blank' | 'template' | 'clone';
    repoUrl?: string;
    token?: string;
    saveToken?: boolean;
    googleSheetUrl?: string;
  }) =>
    jsonFetch<LoadedProject>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  loadProject: (slug: string) =>
    jsonFetch<LoadedProject>(`/api/projects/${encodeURIComponent(slug)}`),

  saveConfig: (slug: string, config: ProjectConfig, commitMessage?: string) =>
    jsonFetch<{ config: ProjectConfig }>(`/api/projects/${encodeURIComponent(slug)}/config`, {
      method: 'PUT',
      body: JSON.stringify({ config, commitMessage }),
    }),

  saveDesign: (
    slug: string,
    payload: {
      config?: ProjectConfig;
      design?: DesignConfig;
      controls?: ControlsSchema;
      templateFiles?: Record<string, string>;
      docs?: ProjectDocsMap;
      overrides?: CardOverrides;
      customCss?: string;
      commitMessage?: string;
      push?: boolean;
    },
  ) =>
    jsonFetch<LoadedProject>(`/api/projects/${encodeURIComponent(slug)}/design`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  fetchCards: (slug: string, forceLocal = false) =>
    jsonFetch<CardsResponse>(
      `/api/projects/${encodeURIComponent(slug)}/cards${forceLocal ? '?local=1' : ''}`,
    ),

  uploadCsv: (slug: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return jsonFetch<CardsResponse>(
      `/api/projects/${encodeURIComponent(slug)}/cards/upload`,
      { method: 'POST', body: fd },
    );
  },

  uploadAsset: (slug: string, kind: 'fonts' | 'icons' | 'images', file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return jsonFetch<{ filename: string; assets: AssetList }>(
      `/api/projects/${encodeURIComponent(slug)}/assets/${kind}`,
      { method: 'POST', body: fd },
    );
  },

  deleteAsset: (slug: string, kind: 'fonts' | 'icons' | 'images', filename: string) =>
    jsonFetch<{ assets: AssetList }>(
      `/api/projects/${encodeURIComponent(slug)}/assets/${kind}/${encodeURIComponent(filename)}`,
      { method: 'DELETE' },
    ),

  gitLog: (slug: string) =>
    jsonFetch<{ commits: GitCommitInfo[] }>(
      `/api/projects/${encodeURIComponent(slug)}/git/log`,
    ),

  gitRollback: (slug: string, hash: string) =>
    jsonFetch<LoadedProject>(`/api/projects/${encodeURIComponent(slug)}/git/rollback`, {
      method: 'POST',
      body: JSON.stringify({ hash }),
    }),

  gitRemote: (slug: string, action: 'connect' | 'disconnect', remoteUrl?: string) =>
    jsonFetch<LoadedProject>(`/api/projects/${encodeURIComponent(slug)}/git/remote`, {
      method: 'POST',
      body: JSON.stringify({ action, remoteUrl }),
    }),

  gitSaveToken: (slug: string, token: string) =>
    jsonFetch<LoadedProject>(`/api/projects/${encodeURIComponent(slug)}/git/token`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  gitPull: (slug: string, token?: string) =>
    jsonFetch<{ output: string; project: LoadedProject }>(
      `/api/projects/${encodeURIComponent(slug)}/git/pull`,
      { method: 'POST', body: JSON.stringify({ token }) },
    ),

  gitPush: (slug: string, token?: string) =>
    jsonFetch<{ output: string; project: LoadedProject }>(
      `/api/projects/${encodeURIComponent(slug)}/git/push`,
      { method: 'POST', body: JSON.stringify({ token }) },
    ),

  exportPdf: async (
    slug: string,
    payload: {
      options: ExportOptions;
      draftVariant?: DesignVariant;
      draftOverrides?: CardOverrides;
      draftCustomCss?: string;
      preRenderedCardsHtml?: string[];
      preRenderedBaseCss?: string;
    },
  ): Promise<Blob> => {
    const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/export/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(data.error || 'PDF export failed');
    }
    return res.blob();
  },

  exportDocPdf: async (
    slug: string,
    payload: {
      docId: string;
      title: string;
      bodyHtml: string;
      docCss: string;
      cardBaseCss: string;
    },
  ): Promise<Blob> => {
    const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/export/doc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(data.error || 'Document PDF export failed');
    }
    return res.blob();
  },
};
