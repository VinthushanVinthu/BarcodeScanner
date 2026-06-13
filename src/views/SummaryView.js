import { Download, FileSpreadsheet, Pencil, RefreshCw, Save, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import Alert from "../components/Alert";
import { SUMMARY_TABLE_COLUMNS } from "../constants/labelFields";
import { downloadScansExcel } from "../lib/excel";
import { formatDate, formatDateOnly, getScanDate } from "../lib/format";

function getCellValue(scan, key) {
  if (key === "section") return scan.section?.name || "-";
  if (key === "created_at") return formatDate(scan.created_at) || "-";
  if (key === "label_date") return formatDateOnly(getScanDate(scan)) || "-";
  return scan[key] || "-";
}

function makeScanDraft(scan) {
  return {
    section_id: scan.section_id || "",
    label_date: getScanDate(scan) || "",
    barcode: scan.barcode || "",
    sew: scan.sew || "",
    cut: scan.cut || "",
    so: scan.so || "",
    li: scan.li || "",
    ref: scan.ref || "",
    vd: scan.vd || "",
    sg3: scan.sg3 || "",
    color: scan.color || "",
    item: scan.item || "",
    size: scan.size || "",
    line_num: scan.line_num || "",
    bin: scan.bin || "",
  };
}

export default function SummaryView({
  adminSections,
  labelScans,
  adminLoading,
  summaryMessage,
  onRefreshSummary,
  onSaveScan,
  onDeleteScan,
}) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedSections, setSelectedSections] = useState(null); // null means "All sections"
  const [editingScanId, setEditingScanId] = useState(null);
  const [scanDraft, setScanDraft] = useState(null);

  const filteredScans = useMemo(() => {
    const selectedSet = selectedSections ? new Set(selectedSections) : null;

    return labelScans.filter((scan) => {
      const scanDate = getScanDate(scan);
      const matchesFrom = !fromDate || scanDate >= fromDate;
      const matchesTo = !toDate || scanDate <= toDate;
      const matchesSection = selectedSet === null || selectedSet.has(scan.section_id);
      return matchesFrom && matchesTo && matchesSection;
    });
  }, [fromDate, toDate, selectedSections, labelScans]);

  const toggleSection = (sectionId) => {
    let current = selectedSections === null ? adminSections.map((section) => section.id) : selectedSections;

    if (current.includes(sectionId)) {
      current = current.filter((id) => id !== sectionId);
    } else {
      current = [...current, sectionId];
    }

    if (current.length === adminSections.length) {
      setSelectedSections(null);
    } else {
      setSelectedSections(current);
    }
  };

  const startEdit = (scan) => {
    setEditingScanId(scan.id);
    setScanDraft(makeScanDraft(scan));
  };

  const cancelEdit = () => {
    setEditingScanId(null);
    setScanDraft(null);
  };

  const saveEdit = async () => {
    if (!editingScanId || !scanDraft) return;
    const saved = await onSaveScan(editingScanId, scanDraft);
    if (saved) cancelEdit();
  };

  const updateDraft = (key, value) => {
    setScanDraft((prev) => ({ ...prev, [key]: value }));
  };

  const renderCell = (scan, column) => {
    if (editingScanId !== scan.id) {
      return getCellValue(scan, column.key);
    }

    if (column.key === "created_at") {
      return formatDate(scan.created_at) || "-";
    }

    if (column.key === "section") {
      return (
        <select value={scanDraft.section_id} onChange={(event) => updateDraft("section_id", event.target.value)} required>
          {adminSections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>
      );
    }

    if (column.key === "label_date") {
      return <input type="date" value={scanDraft.label_date} onChange={(event) => updateDraft("label_date", event.target.value)} />;
    }

    return <input value={scanDraft[column.key] || ""} onChange={(event) => updateDraft(column.key, event.target.value)} />;
  };

  return (
    <main className="page-stack">
      <section className="admin-heading">
        <div>
          <span className="eyebrow">
            <FileSpreadsheet size={16} /> Summary
          </span>
          <h1>Label summary</h1>
          <p>Filter saved label details by label date and one or more sections.</p>
        </div>
        <div className="button-row">
          <button type="button" className="btn btn--outline" onClick={onRefreshSummary} disabled={adminLoading}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button type="button" className="btn btn--green" onClick={() => downloadScansExcel(filteredScans)} disabled={!filteredScans.length}>
            <Download size={16} /> Excel
          </button>
        </div>
      </section>

      <section className="admin-card summary-filters">
        {summaryMessage && (
          <Alert type={summaryMessage.includes("updated") || summaryMessage.includes("deleted") ? "success" : "error"}>{summaryMessage}</Alert>
        )}

        <div className="filter-grid">
          <label>
            From date
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </label>
          <label>
            To date
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </label>
        </div>

        <div className="section-filter">
          <div className="section-filter__top">
            <strong>Sections</strong>
            <div className="button-row" style={{ gap: "8px" }}>
              <button type="button" className="btn btn--ghost" onClick={() => setSelectedSections(null)}>
                Select all
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setSelectedSections([])}>
                Clear
              </button>
            </div>
          </div>
          <div className="section-checks">
            <label className="checkbox-label">
              <input type="checkbox" checked={selectedSections === null} onChange={(e) => setSelectedSections(e.target.checked ? null : [])} />
              All sections
            </label>
            {adminSections.map((section) => (
              <label className="checkbox-label" key={section.id}>
                <input type="checkbox" checked={selectedSections === null || selectedSections.includes(section.id)} onChange={() => toggleSection(section.id)} />
                {section.name}
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-card table-card">
        <div className="panel-title">
          <div>
            <h2>All label details</h2>
            <p>
              Showing {filteredScans.length} of {labelScans.length} records
            </p>
          </div>
        </div>

        {fromDate && toDate && fromDate > toDate && <Alert>From date must be before To date.</Alert>}

        <div className="table-wrap">
          <table className="summary-table">
            <thead>
              <tr>
                {SUMMARY_TABLE_COLUMNS.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredScans.map((scan) => (
                <tr key={scan.id}>
                  {SUMMARY_TABLE_COLUMNS.map((column) => (
                    <td key={column.key}>{renderCell(scan, column)}</td>
                  ))}
                  <td>
                    {editingScanId === scan.id ? (
                      <div className="button-row">
                        <button type="button" className="icon-button" onClick={saveEdit} disabled={adminLoading} aria-label="Save row">
                          <Save size={16} />
                        </button>
                        <button type="button" className="icon-button" onClick={cancelEdit} disabled={adminLoading} aria-label="Cancel edit">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="button-row">
                        <button type="button" className="icon-button" onClick={() => startEdit(scan)} disabled={adminLoading} aria-label="Edit row">
                          <Pencil size={16} />
                        </button>
                        <button type="button" className="icon-button" onClick={() => onDeleteScan(scan)} disabled={adminLoading} aria-label="Delete row">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!filteredScans.length && (
                <tr>
                  <td colSpan={SUMMARY_TABLE_COLUMNS.length + 1}>No labels match the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
