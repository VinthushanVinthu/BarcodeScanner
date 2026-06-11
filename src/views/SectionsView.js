import { Check, ClipboardList, Layers, RefreshCw } from "lucide-react";
import Alert from "../components/Alert";

export default function SectionsView({ sections, sectionsLoading, appError, onRefresh, onSelectSection }) {
  return (
    <main className="page-stack">
      <section className="hero-panel">
        <div className="hero-panel__copy">
          <span className="eyebrow">
            <ClipboardList size={16} /> Production sections
          </span>
          <h1>Select a section</h1>
          <p>Choose the company section before scanning. Saved labels will be connected to that section in the database.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={onRefresh}>
          <RefreshCw size={18} /> Refresh
        </button>
      </section>

      {appError && <Alert>{appError}</Alert>}

      {sectionsLoading ? (
        <div className="empty-state">Loading sections...</div>
      ) : sections.length ? (
        <section className="section-grid">
          {sections.map((section) => (
            <button type="button" className="section-card" key={section.id} onClick={() => onSelectSection(section)}>
              <span className="section-card__icon">
                <Layers size={20} />
              </span>
              <span className="section-card__body">
                <strong>{section.name}</strong>
                <span>{section.description || "No description"}</span>
              </span>
              <Check size={18} />
            </button>
          ))}
        </section>
      ) : (
        <div className="empty-state">No active sections yet. Login as admin and create the first section.</div>
      )}
    </main>
  );
}
