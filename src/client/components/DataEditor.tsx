import React, { useEffect, useMemo, useRef, useState } from 'react';
import { serializeCsv } from '../../shared/csv';
import type { CardRow } from '../../shared/types';

interface DataEditorProps {
  slug: string;
  columns: string[];
  rows: CardRow[];
  onColumnsChange: (next: string[]) => void;
  onRowsChange: (next: CardRow[]) => void;
  onUploadCsv: (file: File) => Promise<void>;
}

interface ColDef {
  key: string;
  label: string;
  width: number;
  isNumber?: boolean;
}

function estimateColWidth(key: string): number {
  const k = key.toLowerCase();
  if (k === 'count' || k === 'qty' || k === 'quantity') return 62;
  if (k === 'id') return 92;
  if (k === 'description' || k === 'text' || k === 'effect') return 260;
  if (k === 'title' || k === 'name' || k === 'subtitle') return 175;
  return 100;
}

interface CellPos {
  row: number;
  col: number;
}

export function DataEditor({
  slug,
  columns: propColumns,
  rows,
  onColumnsChange,
  onRowsChange,
  onUploadCsv,
}: DataEditorProps) {
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [anchor, setAnchor] = useState<CellPos>({ row: 0, col: 0 });
  const [focusCell, setFocusCell] = useState<CellPos>({ row: 0, col: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [editing, setEditing] = useState<{ row: number; col: number; draft: string } | null>(null);
  const [copyToast, setCopyToast] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);

  const columns = useMemo<ColDef[]>(() => {
    const ordered = new Set<string>(propColumns);
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        if (!k.startsWith('_')) ordered.add(k);
      }
    }
    if (ordered.size === 0) {
      ordered.add('id');
      ordered.add('type_group');
      ordered.add('title');
      ordered.add('count');
    }
    return Array.from(ordered).map((key) => ({
      key,
      label: key,
      width: estimateColWidth(key),
      isNumber: key === 'count' || key === 'quantity',
    }));
  }, [propColumns, rows]);

  const typeGroups = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.type_group) set.add(r.type_group);
    }
    return ['all', ...Array.from(set)];
  }, [rows]);

  const visibleIndices = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out: number[] = [];
    rows.forEach((r, idx) => {
      if (filterType !== 'all' && r.type_group !== filterType) return;
      if (q) {
        const matched = Object.values(r).some(
          (v) => v !== undefined && v !== null && String(v).toLowerCase().includes(q),
        );
        if (!matched) return;
      }
      out.push(idx);
    });
    return out;
  }, [rows, filterType, search]);

  const totalCards = useMemo(
    () => rows.reduce((sum, r) => sum + Math.max(1, Number(r.count) || 1), 0),
    [rows],
  );

  // Stop drag selection when mouse is released anywhere
  useEffect(() => {
    if (!isDragging) return;
    const onUp = () => setIsDragging(false);
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [isDragging]);

  // Keep the active/focused cell scrolled into view when navigating with keyboard
  useEffect(() => {
    const container = tableRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(
      `td[data-cell="${focusCell.row}:${focusCell.col}"]`,
    );
    if (el) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [focusCell.row, focusCell.col]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing?.row, editing?.col]);

  const range = useMemo(() => ({
    r1: Math.min(anchor.row, focusCell.row),
    r2: Math.max(anchor.row, focusCell.row),
    c1: Math.min(anchor.col, focusCell.col),
    c2: Math.max(anchor.col, focusCell.col),
  }), [anchor, focusCell]);

  const getCellValue = (rowIdx: number, colIdx: number): string => {
    const r = rows[rowIdx];
    const col = columns[colIdx];
    if (!r || !col) return '';
    const v = r[col.key];
    return v === undefined || v === null ? '' : String(v);
  };

  const commitEdit = (overrideDraft?: string) => {
    if (!editing) return;
    const rawVal = overrideDraft ?? editing.draft;
    const col = columns[editing.col];
    const nextRows = rows.map((r, idx) => {
      if (idx !== editing.row) return r;
      if (col.isNumber) {
        const n = Number.parseInt(rawVal, 10);
        return { ...r, [col.key]: Number.isFinite(n) && n > 0 ? n : 1 };
      }
      return { ...r, [col.key]: rawVal };
    });
    onRowsChange(nextRows);
    setEditing(null);
  };

  const startEdit = (visRow: number, colIdx: number, initialValue?: string) => {
    const realRow = visibleIndices[visRow];
    if (realRow === undefined) return;
    setAnchor({ row: visRow, col: colIdx });
    setFocusCell({ row: visRow, col: colIdx });
    setEditing({
      row: realRow,
      col: colIdx,
      draft: initialValue !== undefined ? initialValue : getCellValue(realRow, colIdx),
    });
  };

  const moveFocus = (dRow: number, dCol: number, extendRange = false) => {
    if (visibleIndices.length === 0) return;
    const nextPos: CellPos = {
      row: Math.max(0, Math.min(visibleIndices.length - 1, focusCell.row + dRow)),
      col: Math.max(0, Math.min(columns.length - 1, focusCell.col + dCol)),
    };
    setFocusCell(nextPos);
    if (!extendRange) setAnchor(nextPos);
  };

  const showToast = (msg: string) => {
    setCopyToast(msg);
    setTimeout(() => setCopyToast(''), 1600);
  };

  const copySelectionToClipboard = async () => {
    const lines: string[] = [];
    for (let vr = range.r1; vr <= range.r2; vr++) {
      const realRow = visibleIndices[vr];
      if (realRow === undefined) continue;
      const cells: string[] = [];
      for (let c = range.c1; c <= range.c2; c++) {
        cells.push(getCellValue(realRow, c));
      }
      lines.push(cells.join('\t'));
    }
    const tsv = lines.join('\n');
    try {
      await navigator.clipboard.writeText(tsv);
      const cellCount = (range.r2 - range.r1 + 1) * (range.c2 - range.c1 + 1);
      showToast(`Copied ${cellCount} cell${cellCount > 1 ? 's' : ''}`);
    } catch {
      // Clipboard API may be restricted on non-HTTPS origins
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (editing) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    const pastedLines = text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
    const nextRows = [...rows];
    pastedLines.forEach((line, rOff) => {
      const realRow = visibleIndices[range.r1 + rOff];
      if (realRow === undefined) return;
      const vals = line.split('\t');
      const updated = { ...nextRows[realRow] };
      vals.forEach((val, cOff) => {
        const col = columns[range.c1 + cOff];
        if (!col) return;
        if (col.isNumber) {
          const n = Number.parseInt(val, 10);
          updated[col.key] = Number.isFinite(n) && n > 0 ? n : 1;
        } else {
          updated[col.key] = val;
        }
      });
      nextRows[realRow] = updated;
    });
    onRowsChange(nextRows);
    showToast('Pasted');
  };

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (editing) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      copySelectionToClipboard();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(1, 0, e.shiftKey);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(-1, 0, e.shiftKey);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      moveFocus(0, 1, e.shiftKey);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      moveFocus(0, -1, e.shiftKey);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      moveFocus(0, e.shiftKey ? -1 : 1, false);
    } else if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      startEdit(focusCell.row, focusCell.col);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const targetRealRows = new Set<number>();
      for (let vr = range.r1; vr <= range.r2; vr++) {
        if (visibleIndices[vr] !== undefined) targetRealRows.add(visibleIndices[vr]);
      }
      onRowsChange(
        rows.map((r, idx) => {
          if (!targetRealRows.has(idx)) return r;
          const updated = { ...r };
          for (let c = range.c1; c <= range.c2; c++) {
            const col = columns[c];
            if (col) updated[col.key] = col.isNumber ? 1 : '';
          }
          return updated;
        }),
      );
    } else if (
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      e.preventDefault();
      startEdit(focusCell.row, focusCell.col, e.key);
    }
  };

  const handleAddRow = () => {
    const nextNum = rows.length + 1;
    const newRow: CardRow = {
      id: `CARD_${String(nextNum).padStart(3, '0')}`,
      count: 1,
    };
    for (const col of columns) {
      if (col.key === 'id' || col.key === 'count') continue;
      if (col.key === 'type_group' && filterType !== 'all') {
        newRow[col.key] = filterType;
      } else {
        newRow[col.key] = '';
      }
    }
    const next = [...rows, newRow];
    onRowsChange(next);
    const titleCol = Math.max(0, columns.findIndex((c) => c.key === 'title'));
    const pos = { row: visibleIndices.length, col: titleCol };
    setAnchor(pos);
    setFocusCell(pos);
  };

  const handleAddColumn = () => {
    const raw = prompt('New column name (e.g. notes, rarity, icon):');
    if (!raw) return;
    const clean = raw
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    if (!clean) {
      alert('Column name must contain letters or numbers.');
      return;
    }
    if (columns.some((c) => c.key === clean)) {
      alert(`Column "${clean}" already exists.`);
      return;
    }
    onColumnsChange([...columns.map((c) => c.key), clean]);
    onRowsChange(rows.map((r) => ({ ...r, [clean]: r[clean] ?? '' })));
    const newColIdx = columns.length;
    setAnchor({ row: focusCell.row, col: newColIdx });
    setFocusCell({ row: focusCell.row, col: newColIdx });
  };

  const handleDuplicateRow = () => {
    const realRow = visibleIndices[focusCell.row];
    if (realRow === undefined) return;
    const src = rows[realRow];
    const copy: CardRow = {
      ...src,
      id: `${src.id}_COPY`,
    };
    const next = [...rows.slice(0, realRow + 1), copy, ...rows.slice(realRow + 1)];
    onRowsChange(next);
    const pos = { row: focusCell.row + 1, col: focusCell.col };
    setAnchor(pos);
    setFocusCell(pos);
  };

  const handleDeleteRow = () => {
    const realRow = visibleIndices[focusCell.row];
    if (realRow === undefined) return;
    const target = rows[realRow];
    if (!confirm(`Delete row ${target.id} (${target.title})?`)) return;
    const next = rows.filter((_, idx) => idx !== realRow);
    onRowsChange(next);
    const pos = {
      row: Math.max(0, Math.min(next.length - 1, focusCell.row)),
      col: focusCell.col,
    };
    setAnchor(pos);
    setFocusCell(pos);
  };

  const handleDownloadCsv = () => {
    const csv = serializeCsv(rows, columns.map((c) => c.key));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}-cards.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="canvas-pane">
      <div className="canvas-toolbar">
        <div className="pill-group">
          {typeGroups.map((t) => (
            <button
              key={t}
              type="button"
              className={`pill ${filterType === t ? 'active' : ''}`}
              onClick={() => {
                setFilterType(t);
                setAnchor({ row: 0, col: 0 });
                setFocusCell({ row: 0, col: 0 });
              }}
            >
              {t === 'all' ? `All (${rows.length} rows · ${totalCards} cards)` : t}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {copyToast && <span className="draft-badge">{copyToast}</span>}
          <input
            type="text"
            placeholder="Filter rows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 150 }}
          />
          <button type="button" className="btn" onClick={handleAddRow}>
            + Row
          </button>
          <button type="button" className="btn" onClick={handleAddColumn}>
            + Col
          </button>
          <button
            type="button"
            className="btn"
            disabled={visibleIndices[focusCell.row] === undefined}
            onClick={handleDuplicateRow}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={visibleIndices[focusCell.row] === undefined}
            onClick={handleDeleteRow}
          >
            Delete
          </button>
          <button type="button" className="btn" onClick={handleDownloadCsv}>
            ↓ CSV
          </button>
          <label className="btn" style={{ cursor: 'pointer' }}>
            ↑ Import
            <input
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadCsv(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      <div
        ref={tableRef}
        className="sheet-scroll"
        tabIndex={0}
        onKeyDown={handleGridKeyDown}
        onPaste={handlePaste}
      >
        <table className="sheet-table">
          <thead>
            <tr>
              <th className="sheet-rownum">#</th>
              {columns.map((col) => (
                <th key={col.key} style={{ minWidth: col.width }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleIndices.map((realRow, visRow) => (
              <tr key={`${rows[realRow].id}-${realRow}`}>
                <td className="sheet-rownum">{realRow + 1}</td>
                {columns.map((col, colIdx) => {
                  const isFocus = focusCell.row === visRow && focusCell.col === colIdx;
                  const inRange =
                    visRow >= range.r1 &&
                    visRow <= range.r2 &&
                    colIdx >= range.c1 &&
                    colIdx <= range.c2;
                  const isEd = editing?.row === realRow && editing?.col === colIdx;
                  const val = getCellValue(realRow, colIdx);
                  return (
                    <td
                      key={col.key}
                      data-cell={`${visRow}:${colIdx}`}
                      className={`sheet-cell ${inRange ? 'in-range' : ''} ${isFocus ? 'selected' : ''} ${col.isNumber ? 'num' : ''}`}
                      onMouseDown={(e) => {
                        if (isEd) return;
                        if (editing) commitEdit();
                        e.preventDefault();
                        if (e.shiftKey) {
                          setFocusCell({ row: visRow, col: colIdx });
                        } else {
                          setAnchor({ row: visRow, col: colIdx });
                          setFocusCell({ row: visRow, col: colIdx });
                          setIsDragging(true);
                        }
                        tableRef.current?.focus();
                      }}
                      onMouseEnter={() => {
                        if (isDragging) {
                          setFocusCell({ row: visRow, col: colIdx });
                        }
                      }}
                      onDoubleClick={() => startEdit(visRow, colIdx)}
                    >
                      {isEd ? (
                        <input
                          ref={inputRef}
                          className="sheet-input"
                          type={col.isNumber ? 'number' : 'text'}
                          value={editing.draft}
                          onChange={(e) =>
                            setEditing((prev) => (prev ? { ...prev, draft: e.target.value } : null))
                          }
                          onBlur={() => commitEdit()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (e.altKey || e.shiftKey) {
                                setEditing((prev) =>
                                  prev ? { ...prev, draft: `${prev.draft}\\n` } : null,
                                );
                              } else {
                                commitEdit();
                                moveFocus(1, 0, false);
                                tableRef.current?.focus();
                              }
                            } else if (e.key === 'Tab') {
                              e.preventDefault();
                              commitEdit();
                              moveFocus(0, e.shiftKey ? -1 : 1, false);
                              tableRef.current?.focus();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setEditing(null);
                              tableRef.current?.focus();
                            }
                          }}
                        />
                      ) : (
                        <span className="sheet-val">{val}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sheet-statusbar">
        Arrow / Tab to move · Drag or Shift+Arrows to select range · Ctrl+C / Ctrl+V copy &amp; paste · Type, Enter, or Double-click to edit · Alt+Enter for <code>\n</code>
      </div>
    </div>
  );
}
