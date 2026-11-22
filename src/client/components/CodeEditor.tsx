import React, { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import {
  Annotation,
  Compartment,
  EditorSelection,
  EditorState,
  Prec,
  RangeSetBuilder,
  type Extension,
} from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  keymap,
} from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { markdown } from '@codemirror/lang-markdown';
import { json } from '@codemirror/lang-json';
import { findDocCommentRanges } from '../../shared/docs';

export type CodeLanguage = 'javascript' | 'css' | 'html' | 'markdown' | 'json';

const ExternalSyncAnnotation = Annotation.define<boolean>();

function getLanguageExtension(lang: CodeLanguage) {
  switch (lang) {
    case 'javascript':
      return javascript();
    case 'css':
      return css();
    case 'html':
      return html();
    case 'json':
      return json();
    case 'markdown':
    default:
      return markdown();
  }
}

export function detectLanguage(filename: string): CodeLanguage {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.ts')) return 'javascript';
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.html') || lower.endsWith('.svg')) return 'html';
  if (lower.endsWith('.json')) return 'json';
  return 'markdown';
}

const commentMarkDeco = Decoration.mark({ class: 'cm-dp-comment' });
const commentLineDeco = Decoration.line({ class: 'cm-dp-comment-line' });

function buildCommentDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc;
  const text = doc.toString();
  const ranges = findDocCommentRanges(text);
  if (ranges.length === 0) return Decoration.none;

  const entries: Array<{ from: number; to: number; deco: Decoration }> = [];
  const markedLines = new Set<number>();

  for (const r of ranges) {
    const startLine = doc.lineAt(r.from).number;
    const endLine = doc.lineAt(r.to).number;
    for (let ln = startLine; ln <= endLine; ln++) {
      if (!markedLines.has(ln)) {
        markedLines.add(ln);
        const lineObj = doc.line(ln);
        entries.push({ from: lineObj.from, to: lineObj.from, deco: commentLineDeco });
      }
    }
    entries.push({ from: r.from, to: r.to, deco: commentMarkDeco });
  }

  // RangeSetBuilder requires decorations sorted by (from, startSide, to)
  entries.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    const aIsLine = a.deco === commentLineDeco ? 0 : 1;
    const bIsLine = b.deco === commentLineDeco ? 0 : 1;
    if (aIsLine !== bIsLine) return aIsLine - bIsLine;
    return a.to - b.to;
  });

  const builder = new RangeSetBuilder<Decoration>();
  for (const e of entries) {
    builder.add(e.from, e.to, e.deco);
  }
  return builder.finish();
}

const markdownCommentHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildCommentDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = buildCommentDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

function toggleMarkdownCommentCommand(view: EditorView): boolean {
  const docText = view.state.doc.toString();
  const sel = view.state.selection.main;
  const ranges = findDocCommentRanges(docText);

  // If selection is inside an existing comment, unwrap it (keeping inner text)
  const enclosing = ranges.find((r) => sel.from >= r.from && sel.to <= r.to);
  if (enclosing) {
    const inner = docText.slice(enclosing.innerFrom, enclosing.innerTo).trim();
    view.dispatch({
      changes: { from: enclosing.from, to: enclosing.to, insert: inner },
      selection: EditorSelection.cursor(enclosing.from + inner.length),
      annotations: ExternalSyncAnnotation.of(true),
    });
    return true;
  }

  // Otherwise wrap selection or insert an empty comment at cursor
  const selectedText = docText.slice(sel.from, sel.to);
  const insert = selectedText ? `<!-- ${selectedText} -->` : '<!--  -->';
  const cursorPos = selectedText ? sel.from + 5 + selectedText.length : sel.from + 5;
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert },
    selection: EditorSelection.cursor(cursorPos),
    annotations: ExternalSyncAnnotation.of(true),
  });
  return true;
}

/**
 * Safe Comment Mode (ADR-0007):
 * Locks non-comment rule text while allowing seamless typing & editing inside `<!-- ... -->` comments.
 * Typing anywhere outside a comment automatically creates a new `<!-- ... -->` comment with the cursor inside.
 */
function createSafeCommentModeExtension(): Extension {
  return EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged) return tr;
    if (tr.annotation(ExternalSyncAnnotation)) return tr;
    if (tr.isUserEvent('undo') || tr.isUserEvent('redo')) return tr;

    const oldDoc = tr.startState.doc.toString();
    const ranges = findDocCommentRanges(oldDoc);

    // Collect atomic changes in this transaction
    const edits: Array<{ from: number; to: number; insert: string }> = [];
    tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
      edits.push({ from: fromA, to: toA, insert: inserted.toString() });
    });
    if (edits.length === 0) return tr;

    // Allow if every edit stays strictly inside an existing comment's inner text
    const allInsideComment = edits.every((e) =>
      ranges.some((r) => e.from >= r.innerFrom && e.to <= r.innerTo),
    );
    if (allInsideComment) {
      return tr;
    }

    // Handle single-edit interactions cleanly
    if (edits.length === 1) {
      const e = edits[0];

      // Allow deleting an entire comment (or backspacing an empty comment cleanly)
      const touchedComment = ranges.find((r) => e.from <= r.to && e.to >= r.from);
      if (touchedComment && e.insert === '') {
        const innerEmpty = oldDoc.slice(touchedComment.innerFrom, touchedComment.innerTo).trim() === '';
        const deletingWholeComment = e.from <= touchedComment.from && e.to >= touchedComment.to;
        const backspacingInsideEmpty =
          innerEmpty && e.from >= touchedComment.from && e.to <= touchedComment.to;
        if (deletingWholeComment || backspacingInsideEmpty) {
          // Cleanly remove the comment and any single leading space if inline
          let delFrom = touchedComment.from;
          const delTo = touchedComment.to;
          if (delFrom > 0 && oldDoc[delFrom - 1] === ' ' && (delTo >= oldDoc.length || oldDoc[delTo] === '\n')) {
            delFrom -= 1;
          }
          return {
            changes: { from: delFrom, to: delTo, insert: '' },
            selection: EditorSelection.cursor(delFrom),
          };
        }
        // Protect delimiters of non-empty comments
        return [];
      }

      // Pure insertion outside a comment -> wrap in a new `<!-- ... -->` comment with cursor inside
      if (e.from === e.to && e.insert.length > 0) {
        const pos = e.from;
        // If pressing Enter outside a comment, insert a new standalone comment line
        if (/^\r?\n\s*$/.test(e.insert)) {
          const insertText = `${e.insert}<!--  -->`;
          const cursor = pos + e.insert.length + 5;
          return {
            changes: { from: pos, to: pos, insert: insertText },
            selection: EditorSelection.cursor(cursor),
          };
        }
        const prevChar = pos > 0 ? oldDoc[pos - 1] : '';
        const nextChar = pos < oldDoc.length ? oldDoc[pos] : '';
        const needLeadSpace = prevChar !== '' && !/\s/.test(prevChar);
        const needTrailSpace = nextChar !== '' && !/\s/.test(nextChar);
        const prefix = `${needLeadSpace ? ' ' : ''}<!-- `;
        const suffix = ` -->${needTrailSpace ? ' ' : ''}`;
        const insertText = `${prefix}${e.insert}${suffix}`;
        const cursor = pos + prefix.length + e.insert.length;
        return {
          changes: { from: pos, to: pos, insert: insertText },
          selection: EditorSelection.cursor(cursor),
        };
      }

      // User selected non-comment text and typed -> keep rule text intact, insert comment right after selection
      if (e.to > e.from && e.insert.length > 0) {
        const pos = e.to;
        const prevChar = pos > 0 ? oldDoc[pos - 1] : '';
        const needLeadSpace = prevChar !== '' && !/\s/.test(prevChar);
        const prefix = `${needLeadSpace ? ' ' : ''}<!-- `;
        const insertText = `${prefix}${e.insert} -->`;
        const cursor = pos + prefix.length + e.insert.length;
        return {
          changes: { from: pos, to: pos, insert: insertText },
          selection: EditorSelection.cursor(cursor),
        };
      }
    }

    // Block all other edits that would modify or delete non-comment rule text
    return [];
  });
}

const deckpressTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '12.5px',
    backgroundColor: '#fafafa',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  '.cm-scroller': {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    lineHeight: '1.48',
    overflow: 'auto',
  },
  '.cm-gutters': {
    backgroundColor: '#f3f4f6',
    color: '#9ca3af',
    borderRight: '1px solid #e5e7eb',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#e5e7eb',
    color: '#374151',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(37, 99, 235, 0.04)',
  },
  '&.cm-focused': {
    outline: '2px solid rgba(37, 99, 235, 0.25)',
    outlineOffset: '-1px',
  },
  '.cm-dp-comment-line': {
    backgroundColor: 'rgba(254, 243, 199, 0.5)',
    boxShadow: 'inset 3px 0 0 #f59e0b',
  },
  '.cm-dp-comment': {
    backgroundColor: 'rgba(251, 191, 36, 0.32)',
    color: '#92400e',
    borderRadius: '3px',
    padding: '1px 2px',
  },
});

const commentModeTheme = EditorView.theme({
  '&': {
    borderColor: '#f59e0b',
    backgroundColor: '#fffdf7',
  },
  '&.cm-focused': {
    outline: '2px solid rgba(245, 158, 11, 0.45)',
    outlineOffset: '-1px',
  },
});

export interface RevealLineRequest {
  line: number;
  nonce: number;
}

export interface CodeEditorProps {
  value: string;
  language: CodeLanguage;
  onChange: (next: string) => void;
  minHeight?: number;
  className?: string;
  commentMode?: boolean;
  revealLine?: RevealLineRequest | null;
}

export default function CodeEditor({
  value,
  language,
  onChange,
  minHeight,
  className,
  commentMode = false,
  revealLine = null,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const langCompRef = useRef(new Compartment());
  const commentDecorCompRef = useRef(new Compartment());
  const commentModeCompRef = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const getCommentDecorExt = (lang: CodeLanguage): Extension =>
    lang === 'markdown'
      ? [
          markdownCommentHighlighter,
          Prec.high(keymap.of([{ key: 'Mod-/', run: toggleMarkdownCommentCommand }])),
        ]
      : [];

  const getCommentModeExt = (lang: CodeLanguage, active: boolean): Extension =>
    lang === 'markdown' && active ? [createSafeCommentModeExtension(), commentModeTheme] : [];

  useEffect(() => {
    if (!hostRef.current) return;
    const langComp = langCompRef.current;
    const commentDecorComp = commentDecorCompRef.current;
    const commentModeComp = commentModeCompRef.current;

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        EditorView.lineWrapping,
        deckpressTheme,
        langComp.of(getLanguageExtension(language)),
        commentDecorComp.of(getCommentDecorExt(language)),
        commentModeComp.of(getCommentModeExt(language, commentMode)),
        EditorView.updateListener.of((update) => {
          if (
            update.docChanged &&
            !update.transactions.every((tr) => tr.annotation(ExternalSyncAnnotation))
          ) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount once; value, language & commentMode synced via effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
        annotations: ExternalSyncAnnotation.of(true),
      });
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: [
        langCompRef.current.reconfigure(getLanguageExtension(language)),
        commentDecorCompRef.current.reconfigure(getCommentDecorExt(language)),
        commentModeCompRef.current.reconfigure(getCommentModeExt(language, commentMode)),
      ],
    });
  }, [language, commentMode]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !revealLine) return;
    const totalLines = view.state.doc.lines;
    const clampedLine = Math.max(1, Math.min(totalLines, revealLine.line));
    const lineInfo = view.state.doc.line(clampedLine);
    view.dispatch({
      selection: EditorSelection.cursor(lineInfo.from),
      effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
    });
    view.focus();
  }, [revealLine]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        minHeight: minHeight ? `${minHeight}px` : undefined,
        height: minHeight ? `${minHeight}px` : '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    />
  );
}
