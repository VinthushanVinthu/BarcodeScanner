import { ArrowRight, CheckCircle2, ClipboardList, Inbox, Loader2, PackageSearch, RefreshCw, Sparkles } from "lucide-react";
import Alert from "../components/Alert";

export default function SectionsView({ sections, sectionsLoading, appError, onRefresh, onSelectSection }) {
  return (
    <main className="page-stack">
      <section className="hero-panel">
        <div className="hero-panel__copy">
          <span className="eyebrow">
            <ClipboardList size={16} /> Production sections
          </span>
          <h1><Sparkles size={40} color="#9333ea" style={{ marginRight: '16px', verticalAlign: 'middle' }}/>Select a section</h1>
          <p>Choose the company section before scanning. Saved labels will be connected to that section in the database.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={onRefresh}>
          <RefreshCw size={18} /> Refresh
        </button>
      </section>

      {appError && <Alert>{appError}</Alert>}

      {sectionsLoading ? (
        <div className="empty-state">
          <Loader2 size={48} color="#4f46e5" className="spinner" style={{ marginBottom: "16px" }} />
          <div>Loading sections...</div>
        </div>
      ) : sections.length ? (
        <section className="section-grid">
          {sections.map((section) => (
            <button type="button" className="section-card" key={section.id} onClick={() => onSelectSection(section)}>
              <span className="section-card__icon">
                <PackageSearch size={28} />
              </span>
              <span className="section-card__body">
                <strong>{section.name}</strong>
                <span>{section.description || "No description"}</span>
              </span>
              <ArrowRight size={24} />
            </button>
          ))}
        </section>
      ) : (
        <div className="empty-state">
          <Inbox size={48} color="#94a3b8" style={{ marginBottom: "16px" }} />
          <div>No active sections yet. Login as admin and create the first section.</div>
        </div>
      )}
    </main>
  );
}
