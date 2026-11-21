import React, { useMemo, useState } from 'react';
import { getOrderedSectionNames, renderProjectDocHtml } from '../../shared/docs';
import { compileTemplateFiles } from '../../shared/runtime';
import type {
  CardOverrides,
  CardSize,
  DesignVariant,
  ExpandedCard,
  ProjectDoc,
  ProjectDocsMap,
} from '../../shared/types';

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
  | { kind: 'renderJs' };

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
        const oa = docs[a].meta.order ?? 999;
        const ob = docs[b].meta.order ?? 999;
        return oa !== ob ? oa - ob : a.localeCompare(b);
      }),
    [docs],
  );
  const effectiveDocId = docs[activeDocId] ? activeDocId : docIds[0] || '';
  const activeDoc: ProjectDoc | undefined = effectiveDocId ? docs[effectiveDocId] : undefined;

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
  const [zoom, setZoom] = useState(() => activeDoc?.meta.defaultZoom ?? 0.75);

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
    });
  }, [activeDoc, cards, variant, zeroBleedCardSize, overrides, compiledTemplate, assetBaseUrl]);

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
    setZoom(next.meta.defaultZoom ?? 0.75);
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
    return activeDoc.stylesCss ?? '';
  }, [activeDoc, target]);

  const handleEditorChange = (val: string) => {
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
    <div className="workspace">
      <aside className="docs-sidebar">
        <div className="docs-switcher">
          {docIds.map((id) => (
            <button
              key={id}
              type="button"
              className={`btn ${id === activeDoc.id ? 'btn-dark' : ''}`}
              onClick={() => selectDoc(id)}
            >
              {docs[id].meta.title || id}
            </button>
          ))}
        </div>

        <div className="docs-files">
          {sectionNames.length > 0 && (
            <div className="docs-file-group">
              <div className="docs-file-group-head">
                <span>Sections (.md)</span>
                <button type="button" className="btn-link" onClick={handleAddSection}>
                  + Add
                </button>
              </div>
              <div className="docs-file-pills">
                {sectionNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`docs-file-pill ${target.kind === 'section' && target.name === name ? 'active' : ''}`}
                    onClick={() => setTarget({ kind: 'section', name })}
                  >
                    {name}
                  </button>
                ))}
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
                    onClick={() => setTarget({ kind: 'diagram', name })}
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
                  onClick={() => setTarget({ kind: 'renderJs' })}
                >
                  render.js
                </button>
              )}
              <button
                type="button"
                className={`docs-file-pill ${target.kind === 'styles' ? 'active' : ''}`}
                onClick={() => setTarget({ kind: 'styles' })}
              >
                styles.css
              </button>
            </div>
          </div>
        </div>

        <textarea
          className="docs-editor"
          spellCheck={false}
          value={currentEditorValue}
          onChange={(e) => handleEditorChange(e.target.value)}
        />

        <div className="docs-hint">
          Directives: <code>{'{{card:CARD_029}}'}</code> · <code>{'{{card-row: ...}}'}</code> ·{' '}
          <code>{'{{pill:TAL}}'}</code> · <code>{'{{count:playable}}'}</code> ·{' '}
          <code>{'{{diagram:name}}'}</code> · <code>---col---</code> · <code>---page---</code>
        </div>
      </aside>

      <main className="canvas-pane">
        <div className="canvas-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <strong>{activeDoc.meta.title}</strong>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              {activeDoc.meta.pageSize || 'A4'} {activeDoc.meta.orientation || 'portrait'}
              {activeDoc.meta.columns && activeDoc.meta.columns > 1
                ? ` · ${activeDoc.meta.columns} columns`
                : ''}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              Zoom {Math.round(zoom * 100)}%
              <input
                type="range"
                min={0.4}
                max={2.0}
                step={0.05}
                value={zoom}
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

        <div className="docs-preview-scroll">
          <style>{`${customFontFacesCss}\n${cardBaseCss}\n${rendered.css}`}</style>
          <div
            className="docs-page-stage"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
            dangerouslySetInnerHTML={{ __html: rendered.bodyHtml }}
          />
        </div>
      </main>
    </div>
  );
}
