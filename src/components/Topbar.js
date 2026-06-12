import { ArrowLeft, FileSpreadsheet, Scan, Shield } from "lucide-react";

export default function Topbar({ view, onHome, onAdmin, onSummary }) {
  return (
    <header className="topbar">
      <button type="button" className="brand-button" onClick={onHome}>
        <Scan size={22} />
        <span>Label OCR</span>
      </button>
      <div className="topbar__actions">
        {view !== "sections" && (
          <button type="button" className="btn btn--ghost" onClick={onHome}>
            <ArrowLeft size={16} /> Sections
          </button>
        )}
        <button type="button" className="btn btn--outline" onClick={onSummary}>
          <FileSpreadsheet size={16} /> Summary
        </button>
        <button type="button" className="btn btn--outline" onClick={onAdmin}>
          <Shield size={16} /> Admin
        </button>
      </div>
    </header>
  );
}
