import { FIELD_META } from "../constants/labelFields";

export default function ResultCard({ fieldKey, value }) {
  const meta = FIELD_META[fieldKey];
  if (!meta) return null;
  const Icon = meta.icon;
  const displayValue = value || "Not found";

  return (
    <div className={`result-card ${value ? "" : "result-card--missing"}`} style={{ "--accent": meta.color }}>
      <div className="result-card__icon" style={{ background: `${meta.color}22`, color: meta.color }}>
        <Icon size={18} />
      </div>
      <div className="result-card__body">
        <span className="result-card__label">{meta.label}</span>
        <span className="result-card__value">{displayValue}</span>
      </div>
    </div>
  );
}
