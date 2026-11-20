import React, { useEffect, useState } from 'react';
import type {
  AssetList,
  CardSize,
  CutGuidelines,
  ExportMode,
  ExportOptions,
  GitCommitInfo,
  GitStatusInfo,
  SheetFormat,
} from '../../shared/types';
import { api, type LoadedProject } from '../api';

/* ---------- New Project Modal ---------- */
export function NewProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (project: LoadedProject) => void;
}) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'template' | 'blank' | 'clone'>('template');
  const [repoUrl, setRepoUrl] = useState('');
  const [token, setToken] = useState('');
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const created = await api.createProject({
        name,
        mode,
        repoUrl: mode === 'clone' ? repoUrl : undefined,
        token: mode === 'clone' ? token : undefined,
        googleSheetUrl: mode !== 'clone' ? googleSheetUrl : undefined,
      });
      onCreated(created);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-header">
          <h2>New Card Game Project</h2>
          <button type="button" className="btn btn-xs" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="field">
          <label>Project Name</label>
          <input
            type="text"
            required
            placeholder="e.g. The Menu"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Initialization Mode</label>
          <div className="pill-group">
            <button
              type="button"
              className={`pill ${mode === 'template' ? 'active' : ''}`}
              onClick={() => setMode('template')}
            >
              Swiss Template
            </button>
            <button
              type="button"
              className={`pill ${mode === 'blank' ? 'active' : ''}`}
              onClick={() => setMode('blank')}
            >
              Blank
            </button>
            <button
              type="button"
              className={`pill ${mode === 'clone' ? 'active' : ''}`}
              onClick={() => setMode('clone')}
            >
              Clone Git Repo
            </button>
          </div>
        </div>

        {mode === 'clone' ? (
          <>
            <div className="field">
              <label>Git Repository URL (HTTPS)</label>
              <input
                type="text"
                required
                placeholder="https://github.com/user/the-menu-cards.git"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Access Token (optional, for private repos — never saved)</label>
              <input
                type="password"
                placeholder="ghp_..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
          </>
        ) : (
          <div className="field">
            <label>Google Sheet Published CSV URL (optional)</label>
            <input
              type="text"
              placeholder="https://docs.google.com/spreadsheets/.../pub?output=csv"
              value={googleSheetUrl}
              onChange={(e) => setGoogleSheetUrl(e.target.value)}
            />
          </div>
        )}

        {error && <div style={{ color: '#dc2626', fontSize: 12 }}>{error}</div>}

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Git History & Remote Sync Modal ---------- */
export function GitModal({
  slug,
  git,
  onClose,
  onProjectReloaded,
}: {
  slug: string;
  git: GitStatusInfo;
  onClose: () => void;
  onProjectReloaded: (project: LoadedProject) => void;
}) {
  const [commits, setCommits] = useState<GitCommitInfo[]>([]);
  const [remoteInput, setRemoteInput] = useState(git.remoteUrl || '');
  const [token, setToken] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const loadLog = async () => {
    const res = await api.gitLog(slug);
    setCommits(res.commits);
  };

  useEffect(() => {
    loadLog().catch(() => {});
  }, [slug]);

  const handleAction = async (fn: () => Promise<void>) => {
    setBusy(true);
    setStatusMsg('');
    try {
      await fn();
      await loadLog();
    } catch (err: unknown) {
      setStatusMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Version History &amp; Git Remote</h2>
          <button type="button" className="btn btn-xs" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="section">
          <div className="section-body">
            <div className="field">
              <label>
                Remote Repository {git.remoteUrl ? '(Connected)' : '(Local only)'}
              </label>
              <input
                type="text"
                placeholder="https://github.com/user/the-menu-cards.git"
                value={remoteInput}
                onChange={(e) => setRemoteInput(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() =>
                  handleAction(async () => {
                    const p = await api.gitRemote(slug, 'connect', remoteInput);
                    onProjectReloaded(p);
                    setStatusMsg('Remote connected.');
                  })
                }
              >
                Connect Remote
              </button>
              {git.remoteUrl && (
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() =>
                    handleAction(async () => {
                      const p = await api.gitRemote(slug, 'disconnect');
                      setRemoteInput('');
                      onProjectReloaded(p);
                      setStatusMsg('Remote disconnected.');
                    })
                  }
                >
                  Disconnect
                </button>
              )}
            </div>

            {git.remoteUrl && (
              <>
                <div className="field">
                  <label>Personal Access Token (ephemeral, never stored)</label>
                  <input
                    type="password"
                    placeholder="ghp_... (optional for public pull)"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                </div>
                <div className="field-row">
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() =>
                      handleAction(async () => {
                        const res = await api.gitPull(slug, token);
                        onProjectReloaded(res.project);
                        setStatusMsg(res.output || 'Pulled latest changes.');
                      })
                    }
                  >
                    ↓ Pull
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() =>
                      handleAction(async () => {
                        const res = await api.gitPush(slug, token);
                        onProjectReloaded(res.project);
                        setStatusMsg(res.output || 'Pushed commits to remote.');
                      })
                    }
                  >
                    ↑ Push
                  </button>
                </div>
              </>
            )}
            {statusMsg && <div style={{ fontSize: 12, color: '#374151' }}>{statusMsg}</div>}
          </div>
        </div>

        <div className="field">
          <label>Saved Local Versions ({commits.length})</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {commits.map((c, idx) => (
              <div key={c.hash} className="commit-row">
                <div>
                  <div style={{ fontWeight: 600 }}>{c.message}</div>
                  <div style={{ color: '#6b7280', fontSize: 11 }}>
                    {c.shortHash} · {new Date(c.date).toLocaleString()}
                  </div>
                </div>
                {idx > 0 && (
                  <button
                    type="button"
                    className="btn btn-xs"
                    disabled={busy}
                    onClick={() =>
                      handleAction(async () => {
                        if (!confirm(`Restore design to version ${c.shortHash}?`)) return;
                        const p = await api.gitRollback(slug, c.hash);
                        onProjectReloaded(p);
                        setStatusMsg(`Restored ${c.shortHash}.`);
                      })
                    }
                  >
                    Restore
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Assets Modal ---------- */
export function AssetsModal({
  slug,
  assets,
  onClose,
  onAssetsUpdated,
}: {
  slug: string;
  assets: AssetList;
  onClose: () => void;
  onAssetsUpdated: (next: AssetList) => void;
}) {
  const [kind, setKind] = useState<'images' | 'icons' | 'fonts'>('images');
  const [busy, setBusy] = useState(false);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      let latest = assets;
      for (const file of Array.from(files)) {
        const res = await api.uploadAsset(slug, kind, file);
        latest = res.assets;
      }
      onAssetsUpdated(latest);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (filename: string) => {
    const res = await api.deleteAsset(slug, kind, filename);
    onAssetsUpdated(res.assets);
  };

  const list = assets[kind];
  const accept =
    kind === 'fonts'
      ? '.woff2,.woff,.ttf,.otf'
      : kind === 'icons'
        ? '.svg'
        : 'image/*';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Project Assets</h2>
          <button type="button" className="btn btn-xs" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="pill-group">
          {(['images', 'icons', 'fonts'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={`pill ${kind === k ? 'active' : ''}`}
              onClick={() => setKind(k)}
            >
              {k === 'images'
                ? `Card Art (${assets.images.length})`
                : k === 'icons'
                  ? `Pattern SVGs (${assets.icons.length})`
                  : `Fonts (${assets.fonts.length})`}
            </button>
          ))}
        </div>

        <label className="btn btn-primary" style={{ justifyContent: 'center', cursor: 'pointer' }}>
          {busy ? 'Uploading...' : `+ Upload ${kind}`}
          <input
            type="file"
            multiple
            accept={accept}
            style={{ display: 'none' }}
            onChange={(e) => handleUpload(e.target.files)}
          />
        </label>

        <div className="asset-list">
          {list.length === 0 ? (
            <div style={{ fontSize: 12, color: '#6b7280' }}>No {kind} uploaded yet.</div>
          ) : (
            list.map((file) => (
              <div key={file} className="asset-row">
                <span>{file}</span>
                <button
                  type="button"
                  className="btn btn-xs btn-danger"
                  onClick={() => handleDelete(file)}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- PDF Export Modal ---------- */
export function ExportModal({
  cardSize,
  typeGroups,
  onClose,
  onExport,
}: {
  cardSize: CardSize;
  typeGroups: string[];
  onClose: () => void;
  onExport: (options: ExportOptions) => Promise<void>;
}) {
  const [widthMm, setWidthMm] = useState(cardSize.widthMm);
  const [heightMm, setHeightMm] = useState(cardSize.heightMm);
  const [bleedMm, setBleedMm] = useState(cardSize.bleedMm);
  const [mode, setMode] = useState<ExportMode>('sheet');
  const [sheetFormat, setSheetFormat] = useState<SheetFormat>('a4');
  const [sheetWidthMm, setSheetWidthMm] = useState(210);
  const [sheetHeightMm, setSheetHeightMm] = useState(297);
  const [gapMm, setGapMm] = useState(2);
  const [guidelines, setGuidelines] = useState<CutGuidelines>('crop-marks');
  const [filterType, setFilterType] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onExport({
        cardWidthMm: widthMm,
        cardHeightMm: heightMm,
        bleedMm,
        mode,
        sheetFormat,
        sheetWidthMm: sheetFormat === 'custom' ? sheetWidthMm : undefined,
        sheetHeightMm: sheetFormat === 'custom' ? sheetHeightMm : undefined,
        gapMm,
        guidelines,
        filterType,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-header">
          <h2>Export Print-Ready PDF</h2>
          <button type="button" className="btn btn-xs" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="field-row-3">
          <div className="field">
            <label>Card W (mm)</label>
            <input
              type="number"
              min={20}
              max={200}
              value={widthMm}
              onChange={(e) => setWidthMm(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Card H (mm)</label>
            <input
              type="number"
              min={20}
              max={250}
              value={heightMm}
              onChange={(e) => setHeightMm(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Bleed (mm)</label>
            <input
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={bleedMm}
              onChange={(e) => setBleedMm(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="field">
          <label>Export Layout</label>
          <div className="pill-group">
            <button
              type="button"
              className={`pill ${mode === 'sheet' ? 'active' : ''}`}
              onClick={() => setMode('sheet')}
            >
              Packed on Sheet (Home / Print Shop)
            </button>
            <button
              type="button"
              className={`pill ${mode === 'individual' ? 'active' : ''}`}
              onClick={() => setMode('individual')}
            >
              1 Card per Page (MPC / Pro)
            </button>
          </div>
        </div>

        {mode === 'sheet' && (
          <>
            <div className="field-row">
              <div className="field">
                <label>Sheet Format</label>
                <select
                  value={sheetFormat}
                  onChange={(e) => setSheetFormat(e.target.value as SheetFormat)}
                >
                  <option value="a4">A4 (210 × 297 mm)</option>
                  <option value="a3">A3 (297 × 420 mm)</option>
                  <option value="letter">US Letter (215.9 × 279.4 mm)</option>
                  <option value="custom">Custom Size</option>
                </select>
              </div>
              <div className="field">
                <label>Card Spacing / Gap (mm)</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.5}
                  value={gapMm}
                  onChange={(e) => setGapMm(Number(e.target.value))}
                />
              </div>
            </div>

            {sheetFormat === 'custom' && (
              <div className="field-row">
                <div className="field">
                  <label>Sheet Width (mm)</label>
                  <input
                    type="number"
                    min={50}
                    max={1000}
                    value={sheetWidthMm}
                    onChange={(e) => setSheetWidthMm(Number(e.target.value))}
                  />
                </div>
                <div className="field">
                  <label>Sheet Height (mm)</label>
                  <input
                    type="number"
                    min={50}
                    max={1000}
                    value={sheetHeightMm}
                    onChange={(e) => setSheetHeightMm(Number(e.target.value))}
                  />
                </div>
              </div>
            )}

            <div className="field">
              <label>Cutting Guidelines</label>
              <div className="pill-group">
                {(['crop-marks', 'cut-grid', 'none'] as CutGuidelines[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`pill ${guidelines === g ? 'active' : ''}`}
                    onClick={() => setGuidelines(g)}
                  >
                    {g === 'crop-marks'
                      ? 'Corner Crop Marks'
                      : g === 'cut-grid'
                        ? 'Full Cut Grid'
                        : 'None'}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="field">
          <label>Cards to Include</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All Cards</option>
            {typeGroups.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {error && <div style={{ color: '#dc2626', fontSize: 12 }}>{error}</div>}

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Rendering PDF...' : 'Download PDF'}
          </button>
        </div>
      </form>
    </div>
  );
}
