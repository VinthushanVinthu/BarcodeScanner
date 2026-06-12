import { Download, FileSpreadsheet, RefreshCw } from "lucide-react";
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

export default function SummaryView({ session, isAdmin, adminSections, labelScans, adminLoading, onRefreshAdmin, onOpenAdmin }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedSectionIds, setSelectedSectionIds] = useState([]);

  const selectedSectionSet = useMemo(() => new Set(selectedSectionIds), [selectedSectionIds]);
  const allSectionsSelected = selectedSectionIds.length === 0;

  const filteredScans = useMemo(() => {
    return labelScans.filter((scan) => {
      const scanDate = getScanDate(scan);
      const matchesFrom = !fromDate || scanDate >= fromDate;
      const matchesTo = !toDate || scanDate <= toDate;
      const matchesSection = allSectionsSelected || selectedSectionSet.has(scan.section_id);
      return matchesFrom && matchesTo && matchesSection;
    });
  }, [allSectionsSelected, fromDate, labelScans, selectedSectionSet, toDate]);

  const toggleSection = (sectionId) => {
    setSelectedSectionIds((prev) => (prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]));
  };

  if (!session || !isAdmin) {
    return (
      <main className="page-stack">
        <section className="admin-heading">
          <div>
            <span className="eyebrow">
              <FileSpreadsheet size={16} /> Summary
            </span>
            <h1>Label summary</h1>
            <p>Login as admin to view and download saved label details.</p>
          </div>
          <button type="button" className="btn btn--primary" onClick={onOpenAdmin}>
            Admin Login
          </button>
        </section>
      </main>
    );
  }

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
          <button type="button" className="btn btn--outline" onClick={onRefreshAdmin} disabled={adminLoading}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button type="button" className="btn btn--green" onClick={() => downloadScansExcel(filteredScans)} disabled={!filteredScans.length}>
            <Download size={16} /> Excel
          </button>
        </div>
      </section>

      <section className="admin-card summary-filters">
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
            <button type="button" className="btn btn--ghost" onClick={() => setSelectedSectionIds([])}>
              Select all
            </button>
          </div>
          <div className="section-checks">
            <label className="checkbox-label">
              <input type="checkbox" checked={allSectionsSelected} onChange={() => setSelectedSectionIds([])} />
              All sections
            </label>
            {adminSections.map((section) => (
              <label className="checkbox-label" key={section.id}>
                <input type="checkbox" checked={allSectionsSelected || selectedSectionIds.includes(section.id)} onChange={() => toggleSection(section.id)} />
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
              </tr>
            </thead>
            <tbody>
              {filteredScans.map((scan) => (
                <tr key={scan.id}>
                  {SUMMARY_TABLE_COLUMNS.map((column) => (
                    <td key={column.key}>{getCellValue(scan, column.key)}</td>
                  ))}
                </tr>
              ))}
              {!filteredScans.length && (
                <tr>
                  <td colSpan={SUMMARY_TABLE_COLUMNS.length}>No labels match the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
