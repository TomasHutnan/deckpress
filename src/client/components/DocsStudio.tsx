import React, { Suspense, useEffect, useMemo, useState } from 'react';
import {
  appendCommentToLine,
  countDocComments,
  countSectionComments,
  deleteDocComment,
  findDocCommentRanges,
  getOrderedSectionNames,
  isNotesDoc,
  renderProjectDocHtml,
  updateDocComment,
} from '../../shared/docs';
import { compileTemplateFiles } from '../../shared/runtime';
import type {
  CardOverrides,
  CardSize,
  DesignVariant,
  ExpandedCard,
  ProjectDoc,
  ProjectDocsMap,
} from '../../shared/types';
import type { CodeLanguage, RevealLineRequest } from './CodeEditor';

const LazyCodeEditor = React.lazy(() => import('./CodeEditor'));

interface DocsStudioProps {
  slug: string;
  docs: ProjectDocsMap;
  activeDocId: string;
  onActiveDocIdChange: (id: string) => void;
  cards: ExpandedCard[];
  cardSize: CardSize;
  variant: DesignVariant;
  templateFiles: Record<string, string>;
  overrides: CardOverrides;
  customCss: string;
  customFontFacesCss: string;
  exportError?: string;
  onDocsChange: (next: ProjectDocsMap) => void;
}

type EditorTarget =
  | { kind: 'section'; name: string }
  | { kind: 'diagram'; name: string }
  | { kind: 'styles' }
  | { kind: 'renderJs' }
  | { kind: 'meta' };

type PreviewCommentPopover =
  | {
      mode: 'edit';
      section: string;
      line: number;
      commentIdx: number;
      text: string;
      x: number;
      y: number;
    }
  | {
      mode: 'add';
      section: string;
      line: number;
      text: string;
      x: number;
      y: number;
    };

export function DocsStudio({
  slug,
  docs,
  activeDocId,
  onActiveDocIdChange,
  cards,
  cardSize,
  variant,
  templateFiles,
  overrides,
  customCss,
  customFontFacesCss,
  exportError,
  onDocsChange,
}: DocsStudioProps) {
  const docIds = useMemo(
    () =>
      Object.keys(docs).sort((a, b) => {
        const na = isNotesDoc(docs[a]) ? 1 : 0;
        const nb = isNotesDoc(docs[b]) ? 1 : 0;
        if (na !== nb) return na - nb;
        const oa = docs[a].meta.order ?? 999;
        const ob = docs[b].meta.order ?? 999;
        return oa !== ob ? oa - ob : a.localeCompare(b);
      }),
    [docs],
  );
  const printDocIds = useMemo(() => docIds.filter((id) => !isNotesDoc(docs[id])), [docIds, docs]);
  const notesDocIds = useMemo(() => docIds.filter((id) => isNotesDoc(docs[id])), [docIds, docs]);
  const effectiveDocId = docs[activeDocId] ? activeDocId : docIds[0] || '';
  const activeDoc: ProjectDoc | undefined = effectiveDocId ? docs[effectiveDocId] : undefined;
  const activeIsNotes = isNotesDoc(activeDoc);

  const sectionNames = useMemo(
    () => (activeDoc ? getOrderedSectionNames(activeDoc) : []),
    [activeDoc],
  );
  const diagramNames = useMemo(
    () => (activeDoc ? Object.keys(activeDoc.diagrams || {}).sort() : []),
    [activeDoc],
  );

  const [target, setTarget] = useState<EditorTarget>(() =>
    activeDoc?.renderJs
      ? { kind: 'renderJs' }
      : sectionNames[0]
        ? { kind: 'section', name: sectionNames[0] }
        : { kind: 'styles' },
  );
  const [zoom, setZoom] = useState(
    () => activeDoc?.meta.defaultZoom ?? (isNotesDoc(activeDoc) ? 1 : 0.75),
  );
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const [commentMode, setCommentMode] = useState(
    () =>
      !isNotesDoc(activeDoc) &&
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 768px)').matches,
  );
  const [showComments, setShowComments] = useState(true);
  const [revealLine, setRevealLine] = useState<RevealLineRequest | null>(null);
  const [mobileSectionsOpen, setMobileSectionsOpen] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [previewPopover, setPreviewPopover] = useState<PreviewCommentPopover | null>(null);
  const [metaDraft, setMetaDraft] = useState(() =>
    activeDoc ? JSON.stringify(activeDoc.meta, null, 2) : '{}',
  );
  const [metaError, setMetaError] = useState('');

  // Keep target valid whenever the active document or its files change (prevents creating phantom files)
  useEffect(() => {
    if (!activeDoc) return;
    const isValid =
      (target.kind === 'section' && activeDoc.sections[target.name] !== undefined) ||
      (target.kind === 'diagram' && activeDoc.diagrams[target.name] !== undefined) ||
      (target.kind === 'renderJs' && activeDoc.renderJs !== undefined) ||
      target.kind === 'styles' ||
      target.kind === 'meta';
    if (!isValid) {
      if (activeDoc.renderJs !== undefined) {
        setTarget({ kind: 'renderJs' });
      } else if (sectionNames[0]) {
        setTarget({ kind: 'section', name: sectionNames[0] });
      } else {
        setTarget({ kind: 'styles' });
      }
    }
  }, [activeDoc, target, sectionNames]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(260, Math.min(860, startW + (ev.clientX - startX)));
      setSidebarWidth(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const compiledTemplate = useMemo(
    () => compileTemplateFiles(templateFiles),
    [templateFiles],
  );

  const zeroBleedCardSize = useMemo(
    () => ({ widthMm: cardSize.widthMm, heightMm: cardSize.heightMm, bleedMm: 0 }),
    [cardSize],
  );

  const cardBaseCss = useMemo(
    () => compiledTemplate.renderer.getBaseCss(zeroBleedCardSize, customCss),
    [compiledTemplate, zeroBleedCardSize, customCss],
  );

  const assetBaseUrl = `/api/projects/${encodeURIComponent(slug)}/assets`;

  const totalComments = useMemo(
    () => (activeDoc ? countDocComments(activeDoc) : 0),
    [activeDoc],
  );

  const rendered = useMemo(() => {
    if (!activeDoc) return { bodyHtml: '', css: '', error: null };
    return renderProjectDocHtml({
      doc: activeDoc,
      cards,
      variant,
      cardSize: zeroBleedCardSize,
      overrides,
      renderer: compiledTemplate.renderer,
      assetBaseUrl,
      includeComments: showComments,
      includeSourceMap: true,
    });
  }, [
    activeDoc,
    cards,
    variant,
    zeroBleedCardSize,
    overrides,
    compiledTemplate,
    assetBaseUrl,
    showComments,
  ]);

  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeDoc) return;
    const targetEl = e.target as HTMLElement | null;

    // 1) Clicking an existing 💬 comment marker opens the edit/delete popover
    const markerEl = targetEl?.closest<HTMLElement>('[data-dp-comment-idx]');
    if (markerEl) {
      e.stopPropagation();
      const section = markerEl.getAttribute('data-dp-comment-section') || '';
      const line = Number.parseInt(markerEl.getAttribute('data-dp-comment-line') || '1', 10) || 1;
      const commentIdx = Number.parseInt(markerEl.getAttribute('data-dp-comment-idx') || '-1', 10);
      const md = activeDoc.sections[section];
      if (md !== undefined && commentIdx >= 0) {
        const ranges = findDocCommentRanges(md);
        const existing = ranges[commentIdx];
        if (existing) {
          setPreviewPopover({
            mode: 'edit',
            section,
            line,
            commentIdx,
            text: existing.text,
            x: Math.min(window.innerWidth - 320, Math.max(12, e.clientX)),
            y: Math.min(window.innerHeight - 190, Math.max(64, e.clientY + 12)),
          });
          return;
        }
      }
    }

    // 2) Clicking any source-mapped block in preview
    const el = targetEl?.closest<HTMLElement>('[data-dp-section]');
    if (!el) {
      setPreviewPopover(null);
      return;
    }
    const section = el.getAttribute('data-dp-section');
    if (!section || activeDoc.sections[section] === undefined) return;
    const line = Number.parseInt(el.getAttribute('data-dp-line') || '1', 10) || 1;

    // When Comment Mode is ON (or Alt+Click), open popover to add a comment to that line
    if (commentMode || e.altKey) {
      setPreviewPopover({
        mode: 'add',
        section,
        line,
        text: '',
        x: Math.min(window.innerWidth - 320, Math.max(12, e.clientX)),
        y: Math.min(window.innerHeight - 190, Math.max(64, e.clientY + 12)),
      });
      return;
    }

    // Otherwise jump straight to that section & line in the editor
    setPreviewPopover(null);
    setMobilePreviewOpen(false);
    setTarget({ kind: 'section', name: section });
    setRevealLine({ line, nonce: Date.now() });
  };

  const handleSavePopoverComment = () => {
    if (!previewPopover || !activeDoc) return;
    const md = activeDoc.sections[previewPopover.section];
    if (md === undefined) return;
    const nextMd =
      previewPopover.mode === 'edit'
        ? updateDocComment(md, previewPopover.commentIdx, previewPopover.text)
        : appendCommentToLine(md, previewPopover.line, previewPopover.text);
    updateActiveDoc((d) => ({
      ...d,
      sections: { ...d.sections, [previewPopover.section]: nextMd },
    }));
    setPreviewPopover(null);
  };

  const handleDeletePopoverComment = () => {
    if (!previewPopover || previewPopover.mode !== 'edit' || !activeDoc) return;
    const md = activeDoc.sections[previewPopover.section];
    if (md === undefined) return;
    const nextMd = deleteDocComment(md, previewPopover.commentIdx);
    updateActiveDoc((d) => ({
      ...d,
      sections: { ...d.sections, [previewPopover.section]: nextMd },
    }));
    setPreviewPopover(null);
  };

  const activeTargetLabel =
    target.kind === 'section'
      ? target.name
      : target.kind === 'diagram'
        ? target.name
        : target.kind === 'renderJs'
          ? 'render.js'
          : target.kind === 'meta'
            ? 'doc.json'
            : 'styles.css';

  const activeSectionCommentCount =
    target.kind === 'section' && activeDoc
      ? countSectionComments(activeDoc.sections[target.name] || '')
      : 0;

  const updateActiveDoc = (updater: (d: ProjectDoc) => ProjectDoc) => {
    if (!activeDoc) return;
    onDocsChange({
      ...docs,
      [activeDoc.id]: updater(activeDoc),
    });
  };

  const selectDoc = (id: string) => {
    onActiveDocIdChange(id);
    const next = docs[id];
    if (!next) return;
    const nextIsNotes = isNotesDoc(next);
    setZoom(next.meta.defaultZoom ?? (nextIsNotes ? 1 : 0.75));
    setMetaDraft(JSON.stringify(next.meta, null, 2));
    setMetaError('');
    if (nextIsNotes) {
      setCommentMode(false);
    } else if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) {
      setCommentMode(true);
    }
    if (next.renderJs !== undefined) {
      setTarget({ kind: 'renderJs' });
    } else {
      const secs = getOrderedSectionNames(next);
      setTarget(secs[0] ? { kind: 'section', name: secs[0] } : { kind: 'styles' });
    }
  };

  const handleAddSection = () => {
    if (!activeDoc) return;
    const raw = prompt('New section filename (e.g. 07-appendix.md):');
    if (!raw) return;
    const clean = raw.trim().endsWith('.md') ? raw.trim() : `${raw.trim()}.md`;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.md$/.test(clean)) {
      alert('Invalid filename. Use letters, numbers, dashes, and .md extension.');
      return;
    }
    updateActiveDoc((d) => ({
      ...d,
      meta: {
        ...d.meta,
        sections: [...getOrderedSectionNames(d), clean],
      },
      sections: {
        ...d.sections,
        [clean]: `## New Section\n\nWrite rules here...\n`,
      },
    }));
    setTarget({ kind: 'section', name: clean });
  };

  const currentEditorValue = useMemo(() => {
    if (!activeDoc) return '';
    if (target.kind === 'section') return activeDoc.sections[target.name] ?? '';
    if (target.kind === 'diagram') return activeDoc.diagrams[target.name] ?? '';
    if (target.kind === 'renderJs') return activeDoc.renderJs ?? '';
    if (target.kind === 'meta') return metaDraft;
    return activeDoc.stylesCss ?? '';
  }, [activeDoc, target, metaDraft]);

  const currentLanguage: CodeLanguage =
    target.kind === 'section'
      ? 'markdown'
      : target.kind === 'diagram'
        ? 'html'
        : target.kind === 'renderJs'
          ? 'javascript'
          : target.kind === 'meta'
            ? 'json'
            : 'css';

  const handleEditorChange = (val: string) => {
    if (target.kind === 'meta') {
      setMetaDraft(val);
      try {
        const parsed = JSON.parse(val);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('doc.json must be a JSON object');
        }
        setMetaError('');
        updateActiveDoc((d) => ({ ...d, meta: parsed }));
      } catch (err: unknown) {
        setMetaError(err instanceof Error ? err.message : 'Invalid JSON');
      }
      return;
    }
    updateActiveDoc((d) => {
      if (target.kind === 'section') {
        return { ...d, sections: { ...d.sections, [target.name]: val } };
      }
      if (target.kind === 'diagram') {
        return { ...d, diagrams: { ...d.diagrams, [target.name]: val } };
      }
      if (target.kind === 'renderJs') {
        return { ...d, renderJs: val };
      }
      return { ...d, stylesCss: val };
    });
  };

  if (!activeDoc) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#6b7280', flex: 1 }}>
        <h3>No documents in this project yet</h3>
        <p>Create a <code>docs/&lt;name&gt;/</code> folder with <code>doc.json</code> and Markdown sections.</p>
      </div>
    );
  }

  return (
    <div className={`workspace docs-workspace ${mobilePreviewOpen ? 'mobile-preview-open' : ''}`}>
      <aside className="docs-sidebar" style={{ width: sidebarWidth }}>
        {/* Compact single-row bar on smartphones (<= 768px) with actual dropdown */}
        <div className="docs-mobile-header">
          <div className="docs-mobile-bar">
            <button
              type="button"
              className="btn docs-mobile-section-btn"
              aria-expanded={mobileSectionsOpen}
              onClick={() => setMobileSectionsOpen((v) => !v)}
            >
              <span className="docs-mobile-doc-tag">{activeDoc.meta.title || activeDoc.id}</span>
              <span className="docs-mobile-file-name">{activeTargetLabel}</span>
              {activeSectionCommentCount > 0 && (
                <span className="docs-pill-comment-count">{activeSectionCommentCount}</span>
              )}
              <span className="docs-mobile-caret">{mobileSectionsOpen ? '▴' : '▾'}</span>
            </button>
            {target.kind === 'section' && (
              <button
                type="button"
                className={`btn docs-comment-toggle docs-mobile-comment-btn ${commentMode ? 'active' : ''}`}
                title="Safe Comment Mode: locks rule text so anything you type becomes a playtest comment"
                onClick={() => setCommentMode((v) => !v)}
              >
                💬 {commentMode ? 'ON' : 'OFF'}
              </button>
            )}
            <button
              type="button"
              className="btn docs-mobile-preview-btn"
              title="Toggle live preview"
              onClick={() => {
                setMobileSectionsOpen(false);
                setMobilePreviewOpen(true);
              }}
            >
              👁
            </button>
          </div>

          {/* Transparent click-outside backdrop for mobile sections dropdown */}
          {mobileSectionsOpen && (
            <div
              className="docs-dropdown-backdrop"
              onClick={() => setMobileSectionsOpen(false)}
            />
          )}

          <div className={`docs-nav-panel ${mobileSectionsOpen ? 'open' : ''}`}>
            <div className="docs-switcher">
              {printDocIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`btn ${id === activeDoc.id ? 'btn-dark' : ''}`}
                  onClick={() => selectDoc(id)}
                >
                  {docs[id].meta.title || id}
                </button>
              ))}
              {printDocIds.length > 0 && notesDocIds.length > 0 && (
                <span className="docs-switcher-divider" aria-hidden="true" />
              )}
              {notesDocIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`btn docs-switcher-notes ${id === activeDoc.id ? 'btn-dark' : ''}`}
                  title="Working notes (not included in print PDF export)"
                  onClick={() => selectDoc(id)}
                >
                  📝 {docs[id].meta.title || id}
                </button>
              ))}
            </div>

            <div className="docs-files">
              {sectionNames.length > 0 && (
                <div className="docs-file-group">
                  <div className="docs-file-group-head">
                    <span>Sections (.md)</span>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => {
                        handleAddSection();
                        setMobileSectionsOpen(false);
                      }}
                    >
                      + Add
                    </button>
                  </div>
                  <div className="docs-file-pills">
                    {sectionNames.map((name) => {
                      const secComments = countSectionComments(activeDoc.sections[name] || '');
                      return (
                        <button
                          key={name}
                          type="button"
                          className={`docs-file-pill ${target.kind === 'section' && target.name === name ? 'active' : ''}`}
                          onClick={() => {
                            setTarget({ kind: 'section', name });
                            setMobileSectionsOpen(false);
                          }}
                        >
                          {name}
                          {secComments > 0 && (
                            <span
                              className="docs-pill-comment-count"
                              title={`${secComments} playtest comment${secComments === 1 ? '' : 's'}`}
                            >
                              {secComments}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {diagramNames.length > 0 && (
                <div className="docs-file-group">
                  <div className="docs-file-group-head">
                    <span>Diagrams (.html)</span>
                  </div>
                  <div className="docs-file-pills">
                    {diagramNames.map((name) => (
                      <button
                        key={name}
                        type="button"
                        className={`docs-file-pill ${target.kind === 'diagram' && target.name === name ? 'active' : ''}`}
                        onClick={() => {
                          setTarget({ kind: 'diagram', name });
                          setMobileSectionsOpen(false);
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="docs-file-group">
                <div className="docs-file-group-head">
                  <span>Layout</span>
                </div>
                <div className="docs-file-pills">
                  {activeDoc.renderJs !== undefined && (
                    <button
                      type="button"
                      className={`docs-file-pill ${target.kind === 'renderJs' ? 'active' : ''}`}
                      onClick={() => {
                        setTarget({ kind: 'renderJs' });
                        setMobileSectionsOpen(false);
                      }}
                    >
                      render.js
                    </button>
                  )}
                  <button
                    type="button"
                    className={`docs-file-pill ${target.kind === 'styles' ? 'active' : ''}`}
                    onClick={() => {
                      setTarget({ kind: 'styles' });
                      setMobileSectionsOpen(false);
                    }}
                  >
                    styles.css
                  </button>
                  <button
                    type="button"
                    className={`docs-file-pill ${target.kind === 'meta' ? 'active' : ''}`}
                    title="Edit doc.json (title, order, defaultZoom, pageSize, orientation, columns, sections)"
                    onClick={() => {
                      setMetaDraft(JSON.stringify(activeDoc.meta, null, 2));
                      setMetaError('');
                      setTarget({ kind: 'meta' });
                      setMobileSectionsOpen(false);
                    }}
                  >
                    ⚙ doc.json
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {target.kind === 'section' && (
          <div className="docs-editor-bar">
            <button
              type="button"
              className={`btn btn-xs docs-comment-toggle ${commentMode ? 'active' : ''}`}
              title="Safe Comment Mode: locks rule text so anything you type becomes a playtest comment (<!-- ... -->)"
              onClick={() => setCommentMode((v) => !v)}
            >
              💬 Comment Mode: {commentMode ? 'ON' : 'OFF'}
            </button>
            <span className="docs-comment-status">
              {commentMode
                ? 'Rule text locked — tap anywhere to add/edit comments'
                : 'Tip: Ctrl/Cmd+/ inserts <!-- comment -->'}
            </span>
          </div>
        )}

        <div className="docs-editor-wrap">
          <Suspense fallback={<div className="docs-editor">Loading editor...</div>}>
            <LazyCodeEditor
              value={currentEditorValue}
              language={currentLanguage}
              onChange={handleEditorChange}
              commentMode={target.kind === 'section' && commentMode}
              revealLine={revealLine}
            />
          </Suspense>
        </div>
        {target.kind === 'meta' && metaError && (
          <div style={{ color: '#dc2626', fontSize: 11.5 }}>{metaError}</div>
        )}

        <div className="docs-hint">
          Directives: <code>{'{{card:ID}}'}</code> · <code>{'{{card-row: ...}}'}</code> ·{' '}
          <code>{'{{pill:KEY}}'}</code> · <code>{'{{count:field=val}}'}</code> ·{' '}
          <code>{'{{diagram:name}}'}</code> · <code>---col---</code> · <code>---page---</code>
        </div>
      </aside>
      <div
        className="docs-resizer"
        title="Drag to resize editor"
        onMouseDown={handleResizeStart}
      />

      <main className="canvas-pane">
        <div className="canvas-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="btn btn-xs docs-mobile-back-btn"
              onClick={() => setMobilePreviewOpen(false)}
            >
              ← Editor
            </button>
            <strong>{activeDoc.meta.title}</strong>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              {activeIsNotes
                ? 'Notes · Markdown'
                : `${activeDoc.meta.pageSize || 'A4'} ${activeDoc.meta.orientation || 'portrait'}${
                    activeDoc.meta.columns && activeDoc.meta.columns > 1
                      ? ` · ${activeDoc.meta.columns} columns`
                      : ''
                  }`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {activeDoc.renderJs === undefined && (
              <button
                type="button"
                className={`btn btn-xs docs-comment-toggle ${showComments ? 'active' : ''}`}
                title="Toggle playtest comment highlights & tooltips in preview (comments are always hidden in PDF export)"
                onClick={() => setShowComments((v) => !v)}
              >
                💬 Comments ({totalComments})
              </button>
            )}
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              Zoom {Math.round(zoom * 100)}%
              <input
                type="range"
                min={activeDoc.meta.minZoom ?? 0.4}
                max={activeDoc.meta.maxZoom ?? 2.0}
                step={activeDoc.meta.zoomStep ?? 0.05}
                value={Math.min(
                  activeDoc.meta.maxZoom ?? 2.0,
                  Math.max(activeDoc.meta.minZoom ?? 0.4, zoom),
                )}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </label>
          </div>
        </div>

        {(rendered.error || exportError) && (
          <div className="banner" style={{ background: '#fee2e2', color: '#991b1b' }}>
            {rendered.error || exportError}
          </div>
        )}

        <div className="docs-preview-scroll" onClick={() => setPreviewPopover(null)}>
          <style>{`${customFontFacesCss}\n${cardBaseCss}\n${rendered.css}`}</style>
          <div
            className={`docs-page-stage ${activeIsNotes ? 'docs-notes-stage' : ''} ${commentMode ? 'comment-mode-active' : ''}`}
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
            onClick={(e) => {
              e.stopPropagation();
              handlePreviewClick(e);
            }}
            dangerouslySetInnerHTML={{ __html: rendered.bodyHtml }}
          />
        </div>

        {previewPopover && (
          <div
            className="docs-comment-popover"
            style={{ left: previewPopover.x, top: previewPopover.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="docs-comment-popover-head">
              <span>
                {previewPopover.mode === 'edit' ? 'Edit comment' : 'Add comment'} ·{' '}
                <code>
                  {previewPopover.section}:{previewPopover.line}
                </code>
              </span>
              <button
                type="button"
                className="btn-link"
                onClick={() => setPreviewPopover(null)}
              >
                ✕
              </button>
            </div>
            <textarea
              className="docs-comment-popover-input"
              rows={3}
              autoFocus
              placeholder="Write playtest note..."
              value={previewPopover.text}
              onChange={(e) =>
                setPreviewPopover((prev) => (prev ? { ...prev, text: e.target.value } : null))
              }
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setPreviewPopover(null);
                } else if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSavePopoverComment();
                }
              }}
            />
            <div className="docs-comment-popover-actions">
              <div style={{ display: 'flex', gap: 6 }}>
                {previewPopover.mode === 'edit' && (
                  <button
                    type="button"
                    className="btn btn-xs btn-danger"
                    onClick={handleDeletePopoverComment}
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-xs"
                  onClick={() => {
                    const { section, line } = previewPopover;
                    setPreviewPopover(null);
                    setMobilePreviewOpen(false);
                    setTarget({ kind: 'section', name: section });
                    setRevealLine({ line, nonce: Date.now() });
                  }}
                >
                  Open in editor
                </button>
              </div>
              <button
                type="button"
                className="btn btn-xs btn-dark"
                onClick={handleSavePopoverComment}
              >
                {previewPopover.mode === 'edit' ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
