import { Check, Layers } from "lucide-react";

export default function SectionConfirmModal({ section, onConfirm, onCancel }) {
  if (!section) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-card__icon">
          <Layers size={24} />
        </div>
        <h2>Open {section.name}?</h2>
        <p>Scans saved after this point will be stored under this section.</p>
        <div className="button-row">
          <button type="button" className="btn btn--primary" onClick={onConfirm}>
            <Check size={18} /> Confirm
          </button>
          <button type="button" className="btn btn--outline" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
