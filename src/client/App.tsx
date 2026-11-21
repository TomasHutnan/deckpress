import React, { useEffect, useMemo, useState } from 'react';
import type { ControlsSchema } from '../shared/controls';
import { expandCards, serializeCsv } from '../shared/csv';
import { renderProjectDocHtml } from '../shared/docs';
import { compileTemplateFiles } from '../shared/runtime';
import type {
  CardOverrides,
  CardRow,
  DesignConfig,
  ExportOptions,
  ProjectConfig,
  ProjectDocsMap,
} from '../shared/types';
import { api, type LoadedProject, type ProjectSummary } from './api';
import { CardGrid } from './components/CardGrid';
import { DataEditor } from './components/DataEditor';
import { DesignPanel } from './components/DesignPanel';
import { DocsStudio } from './components/DocsStudio';
import {
  AssetsModal,
  ExportModal,
  GitModal,
  NewProjectModal,
  SaveVersionModal,
  TemplateModal,
} from './components/Modals';

export function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activeSlug, setActiveSlug] = useState<string>('');
  const [savedProject, setSavedProject] = useState<LoadedProject | null>(null);

  // Live working draft (editable without affecting saved/committed design)
  const [draftConfig, setDraftConfig] = useState<ProjectConfig | null>(null);
  const [draftDesign, setDraftDesign] = useState<DesignConfig | null>(null);
  const [draftControls, setDraftControls] = useState<ControlsSchema>([]);
  const [draftTemplateFiles, setDraftTemplateFiles] = useState<Record<string, string>>({});
  const [draftDocs, setDraftDocs] = useState<ProjectDocsMap>({});
  const [draftOverrides, setDraftOverrides] = useState<CardOverrides>({});
  const [draftCustomCss, setDraftCustomCss] = useState<string>('');

  const [activeView, setActiveView] = useState<'cards' | 'data' | 'docs'>('cards');
  const [activeDocId, setActiveDocId] = useState<string>('');
  const [exportingDoc, setExportingDoc] = useState(false);
  const [docExportError, setDocExportError] = useState('');

  const [cardColumns, setCardColumns] = useState<string[]>([]);
  const [savedCardRows, setSavedCardRows] = useState<CardRow[]>([]);
  const [draftCardRows, setDraftCardRows] = useState<CardRow[]>([]);
  const cards = useMemo(() => expandCards(draftCardRows), [draftCardRows]);
  const [cardsWarning, setCardsWarning] = useState<string>('');
  const [syncing, setSyncing] = useState(false);

  const [modal, setModal] = useState<
    'none' | 'new' | 'save' | 'git' | 'assets' | 'export' | 'template'
  >('none');
  const [assetsTab, setAssetsTab] = useState<'images' | 'icons' | 'fonts'>('images');

  const applyLoadedProject = (proj: LoadedProject) => {
    setSavedProject(proj);
    setDraftConfig(structuredClone(proj.config));
    setDraftDesign(structuredClone(proj.design));
    setDraftControls(structuredClone(proj.controls));
    setDraftTemplateFiles(structuredClone(proj.templateFiles));
    setDraftDocs(structuredClone(proj.docs || {}));
    setDraftOverrides(structuredClone(proj.overrides));
    setDraftCustomCss(proj.customCss);
  };

  const loadCardsFor = async (slug: string) => {
    setSyncing(true);
    try {
      const res = await api.fetchCards(slug);
      setCardColumns(res.columns || []);
      setSavedCardRows(structuredClone(res.rows));
      setDraftCardRows(structuredClone(res.rows));
      setCardsWarning(res.warning || '');
    } catch (err: unknown) {
      setCardsWarning(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  };

  const selectProject = async (slug: string) => {
    setActiveSlug(slug);
    const proj = await api.loadProject(slug);
    applyLoadedProject(proj);
    await loadCardsFor(slug);
  };

  const refreshProjectList = async (preferredSlug?: string) => {
    const res = await api.listProjects();
    setProjects(res.projects);
    const target = preferredSlug || activeSlug || res.projects[0]?.slug || '';
    if (target) {
      await selectProject(target);
    }
  };

  useEffect(() => {
    refreshProjectList().catch(console.error);
  }, []);

  const cardsDirty = useMemo(
    () => JSON.stringify(draftCardRows) !== JSON.stringify(savedCardRows),
    [draftCardRows, savedCardRows],
  );

  const isDirty = useMemo(() => {
    if (!savedProject || !draftConfig || !draftDesign) return false;
    return (
      cardsDirty ||
      JSON.stringify(draftConfig) !== JSON.stringify(savedProject.config) ||
      JSON.stringify(draftDesign) !== JSON.stringify(savedProject.design) ||
      JSON.stringify(draftControls) !== JSON.stringify(savedProject.controls) ||
      JSON.stringify(draftTemplateFiles) !== JSON.stringify(savedProject.templateFiles) ||
      JSON.stringify(draftDocs) !== JSON.stringify(savedProject.docs || {}) ||
      JSON.stringify(draftOverrides) !== JSON.stringify(savedProject.overrides) ||
      draftCustomCss !== savedProject.customCss
    );
  }, [
    cardsDirty,
    savedProject,
    draftConfig,
    draftDesign,
    draftControls,
    draftTemplateFiles,
    draftDocs,
    draftOverrides,
    draftCustomCss,
  ]);

  const handleSaveCommit = async (commitMessage: string, push: boolean) => {
    if (!activeSlug || !draftConfig || !draftDesign) return;
    const updated = await api.saveDesign(activeSlug, {
      config: draftConfig,
      design: draftDesign,
      controls: draftControls,
      templateFiles: draftTemplateFiles,
      docs: draftDocs,
      ...(cardsDirty ? { cardsCsv: serializeCsv(draftCardRows, cardColumns) } : {}),
      overrides: draftOverrides,
      customCss: draftCustomCss,
      commitMessage,
      push,
    });
    applyLoadedProject(updated);
    if (cardsDirty) {
      setSavedCardRows(structuredClone(draftCardRows));
    }
  };

  const handleDiscard = () => {
    if (!savedProject) return;
    if (!confirm('Discard unsaved draft changes?')) return;
    applyLoadedProject(savedProject);
    setDraftCardRows(structuredClone(savedCardRows));
  };

  const handleSyncSheet = async () => {
    if (!activeSlug || !draftConfig) return;
    // Persist sheet URL first if edited, then fetch fresh cards
    if (draftConfig.googleSheetUrl !== savedProject?.config.googleSheetUrl) {
      await api.saveConfig(activeSlug, draftConfig, 'chore: update Google Sheet URL');
    }
    await loadCardsFor(activeSlug);
  };

  const handleUploadCsv = async (file: File) => {
    if (!activeSlug) return;
    const res = await api.uploadCsv(activeSlug, file);
    setCardColumns(res.columns || []);
    setSavedCardRows(structuredClone(res.rows));
    setDraftCardRows(structuredClone(res.rows));
    setCardsWarning('');
  };

  const activeVariant = useMemo(() => {
    if (!draftDesign) return null;
    return (
      draftDesign.variants[draftDesign.activeVariant] ||
      Object.values(draftDesign.variants)[0] ||
      null
    );
  }, [draftDesign]);

  const customFontFacesCss = useMemo(() => {
    if (!savedProject || !activeSlug) return '';
    const base = `/api/projects/${encodeURIComponent(activeSlug)}/assets/fonts`;
    return savedProject.assets.fonts
      .map((file) => {
        const family = file.replace(/\.[^.]+$/, '').replace(/'/g, '');
        return `@font-face { font-family: '${family}'; font-weight: 100 900; src: url('${base}/${encodeURIComponent(file)}'); font-display: swap; }`;
      })
      .join('\n');
  }, [savedProject, activeSlug]);

  const typeGroups = useMemo(() => {
    return Array.from(new Set(cards.map((c) => String(c.type_group || '')).filter(Boolean)));
  }, [cards]);

  const handleExportPdf = async (options: ExportOptions) => {
    if (!activeSlug || !activeVariant) return;
    const compiled = compileTemplateFiles(draftTemplateFiles);
    if (compiled.error) {
      throw new Error(`Fix template error before exporting: ${compiled.error}`);
    }
    const filteredCards = Array.isArray(options.filterTypes)
      ? cards.filter((c) => options.filterTypes!.includes(String(c.type_group || '')))
      : options.filterType && options.filterType !== 'all'
        ? cards.filter((c) => c.type_group === options.filterType)
        : cards;
    const exportCardSize = {
      widthMm: options.cardWidthMm,
      heightMm: options.cardHeightMm,
      bleedMm: options.bleedMm,
    };
    const assetBaseUrl = `/api/projects/${encodeURIComponent(activeSlug)}/assets`;
    const sides = options.sides || 'front';
    const preRenderedCardsHtml = filteredCards.map((card, idx) =>
      compiled.renderer.renderCard({
        card,
        variant: activeVariant,
        overrides: draftOverrides,
        assetBaseUrl,
        cardIndex: idx,
        cardSize: exportCardSize,
        docs: draftDocs,
      }),
    );
    const preRenderedBacksHtml =
      sides === 'back' || sides === 'duplex'
        ? filteredCards.map((card, idx) =>
            compiled.renderer.renderCardBack({
              card,
              variant: activeVariant,
              overrides: draftOverrides,
              assetBaseUrl,
              cardIndex: idx,
              cardSize: exportCardSize,
              docs: draftDocs,
            }),
          )
        : undefined;
    const preRenderedBaseCss = compiled.renderer.getBaseCss(
      exportCardSize,
      draftCustomCss,
    );

    const blob = await api.exportPdf(activeSlug, {
      options,
      draftVariant: activeVariant,
      draftOverrides,
      draftCustomCss,
      preRenderedCardsHtml,
      preRenderedBacksHtml,
      preRenderedBaseCss,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSlug}-${options.mode}-${sides}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportActiveDoc = async () => {
    if (!activeSlug || !activeVariant || !draftConfig) return;
    const docIds = Object.keys(draftDocs).sort();
    const docId = draftDocs[activeDocId] ? activeDocId : docIds[0];
    const activeDoc = docId ? draftDocs[docId] : undefined;
    if (!activeDoc) return;

    setExportingDoc(true);
    setDocExportError('');
    try {
      const compiled = compileTemplateFiles(draftTemplateFiles);
      if (compiled.error) {
        throw new Error(`Fix template error before exporting: ${compiled.error}`);
      }
      const zeroBleedSize = {
        widthMm: draftConfig.cardSize.widthMm,
        heightMm: draftConfig.cardSize.heightMm,
        bleedMm: 0,
      };
      const assetBaseUrl = `/api/projects/${encodeURIComponent(activeSlug)}/assets`;
      const rendered = renderProjectDocHtml({
        doc: activeDoc,
        cards,
        variant: activeVariant,
        cardSize: zeroBleedSize,
        overrides: draftOverrides,
        renderer: compiled.renderer,
        assetBaseUrl,
      });
      if (rendered.error) throw new Error(rendered.error);
      const cardBaseCss = compiled.renderer.getBaseCss(zeroBleedSize, draftCustomCss);
      const blob = await api.exportDocPdf(activeSlug, {
        docId: activeDoc.id,
        title: activeDoc.meta.title || activeDoc.id,
        bodyHtml: rendered.bodyHtml,
        docCss: rendered.css,
        cardBaseCss,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeSlug}-${activeDoc.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setDocExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExportingDoc(false);
    }
  };

  return (
    <div className="studio-shell">
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand">
            <span className="brand-dot" />
            DeckPress
          </div>
          <select
            value={activeSlug}
            onChange={(e) => selectProject(e.target.value)}
            style={{ width: 200 }}
          >
            {projects.length === 0 && <option value="">No projects yet</option>}
            {projects.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn" onClick={() => setModal('new')}>
            + New / Clone
          </button>
          {savedProject && (
            <div className="view-tabs">
              <button
                type="button"
                className={`view-tab ${activeView === 'cards' ? 'active' : ''}`}
                onClick={() => setActiveView('cards')}
              >
                Cards
              </button>
              <button
                type="button"
                className={`view-tab ${activeView === 'data' ? 'active' : ''}`}
                onClick={() => setActiveView('data')}
              >
                Data
              </button>
              <button
                type="button"
                className={`view-tab ${activeView === 'docs' ? 'active' : ''}`}
                onClick={() => setActiveView('docs')}
              >
                Rules &amp; Docs
              </button>
            </div>
          )}
          {isDirty && <span className="draft-badge">Unsaved Draft</span>}
        </div>

        <div className="topbar-right">
          {savedProject && (
            <>
              <button type="button" className="btn" onClick={() => setModal('assets')}>
                Assets
              </button>
              <button
                type="button"
                className="btn"
                title="Edit renderer.js, controls.json, and custom.css live"
                onClick={() => setModal('template')}
              >
                &lt;/&gt; Template
              </button>
              <button type="button" className="btn" onClick={() => setModal('git')}>
                History &amp; Git
              </button>
              {isDirty && (
                <button type="button" className="btn" onClick={handleDiscard}>
                  Revert Draft
                </button>
              )}
              <button
                type="button"
                className="btn btn-dark"
                disabled={!isDirty && !savedProject.git.dirty}
                onClick={() => setModal('save')}
              >
                Save Version
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={activeView === 'docs' && (exportingDoc || Object.keys(draftDocs).length === 0)}
                onClick={() => {
                  if (activeView === 'docs') {
                    handleExportActiveDoc();
                  } else {
                    setModal('export');
                  }
                }}
              >
                {activeView === 'docs' && exportingDoc ? 'Exporting...' : 'Export PDF'}
              </button>
            </>
          )}
        </div>
      </header>

      {cardsWarning && <div className="banner">{cardsWarning}</div>}

      {savedProject && draftConfig && draftDesign && activeVariant ? (
        activeView === 'docs' ? (
          <DocsStudio
            slug={activeSlug}
            docs={draftDocs}
            activeDocId={activeDocId}
            onActiveDocIdChange={setActiveDocId}
            cards={cards}
            cardSize={draftConfig.cardSize}
            variant={activeVariant}
            templateFiles={draftTemplateFiles}
            overrides={draftOverrides}
            customCss={draftCustomCss}
            customFontFacesCss={customFontFacesCss}
            exportError={docExportError}
            onDocsChange={setDraftDocs}
          />
        ) : activeView === 'data' ? (
          <DataEditor
            slug={activeSlug}
            columns={cardColumns}
            rows={draftCardRows}
            onColumnsChange={setCardColumns}
            onRowsChange={setDraftCardRows}
            onUploadCsv={handleUploadCsv}
          />
        ) : (
        <div className="workspace">
          <DesignPanel
            config={draftConfig}
            design={draftDesign}
            controls={draftControls}
            assets={savedProject.assets}
            onConfigChange={setDraftConfig}
            onDesignChange={setDraftDesign}
            onSyncSheet={handleSyncSheet}
            onUploadCsv={handleUploadCsv}
            onOpenAssets={(tab) => {
              setAssetsTab(tab);
              setModal('assets');
            }}
          />
          <CardGrid
            slug={activeSlug}
            cards={cards}
            cardSize={draftConfig.cardSize}
            variant={activeVariant}
            templateFiles={draftTemplateFiles}
            docs={draftDocs}
            overrides={draftOverrides}
            customCss={draftCustomCss}
            customFontFacesCss={customFontFacesCss}
            onRerollCard={(key) =>
              setDraftOverrides((prev) => ({
                ...prev,
                [key]: {
                  ...prev[key],
                  seed: Math.floor(Math.random() * 1_000_000),
                },
              }))
            }
            onToggleMark={(key) =>
              setDraftOverrides((prev) => ({
                ...prev,
                [key]: {
                  ...prev[key],
                  hideMark: !prev[key]?.hideMark,
                },
              }))
            }
            onResetCard={(key) =>
              setDraftOverrides((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
              })
            }
          />
        </div>
        )
      ) : (
        <div style={{ padding: 48, textAlign: 'center', color: '#6b7280' }}>
          <h2>Welcome to DeckPress</h2>
          <p>Create a new card game project or clone an existing Git repository to begin.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModal('new')}
          >
            + Create / Clone Project
          </button>
        </div>
      )}

      {modal === 'new' && (
        <NewProjectModal
          onClose={() => setModal('none')}
          onCreated={async (created) => {
            setModal('none');
            await refreshProjectList(created.config.slug);
          }}
        />
      )}

      {modal === 'save' && savedProject && (
        <SaveVersionModal
          canPush={Boolean(savedProject.git.remoteUrl && savedProject.git.hasSavedToken)}
          onClose={() => setModal('none')}
          onSave={handleSaveCommit}
        />
      )}

      {modal === 'git' && savedProject && (
        <GitModal
          slug={activeSlug}
          git={savedProject.git}
          onClose={() => setModal('none')}
          onProjectReloaded={(p) => {
            applyLoadedProject(p);
            loadCardsFor(activeSlug);
          }}
        />
      )}

      {modal === 'assets' && savedProject && (
        <AssetsModal
          slug={activeSlug}
          assets={savedProject.assets}
          initialTab={assetsTab}
          onClose={() => setModal('none')}
          onAssetsUpdated={(nextAssets) =>
            setSavedProject((prev) => (prev ? { ...prev, assets: nextAssets } : prev))
          }
        />
      )}

      {modal === 'template' && savedProject && (
        <TemplateModal
          templateFiles={draftTemplateFiles}
          controls={draftControls}
          customCss={draftCustomCss}
          onTemplateFilesChange={setDraftTemplateFiles}
          onControlsChange={setDraftControls}
          onCustomCssChange={setDraftCustomCss}
          onClose={() => setModal('none')}
        />
      )}

      {modal === 'export' && draftConfig && (
        <ExportModal
          cardSize={draftConfig.cardSize}
          typeGroups={typeGroups}
          onClose={() => setModal('none')}
          onExport={handleExportPdf}
        />
      )}
    </div>
  );
}
