import React, { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { markdown } from '@codemirror/lang-markdown';
import { json } from '@codemirror/lang-json';

export type CodeLanguage = 'javascript' | 'css' | 'html' | 'markdown' | 'json';

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
});

export interface CodeEditorProps {
  value: string;
  language: CodeLanguage;
  onChange: (next: string) => void;
  minHeight?: number;
  className?: string;
}

export default function CodeEditor({
  value,
  language,
  onChange,
  minHeight,
  className,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const langCompRef = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return;
    const langComp = langCompRef.current;

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        EditorView.lineWrapping,
        deckpressTheme,
        langComp.of(getLanguageExtension(language)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
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
    // Mount once; value & language synced via effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: langCompRef.current.reconfigure(getLanguageExtension(language)),
    });
  }, [language]);

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
