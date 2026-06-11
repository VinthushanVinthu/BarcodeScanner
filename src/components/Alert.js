import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function Alert({ type = "error", children }) {
  const Icon = type === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div className={`alert alert--${type}`}>
      <Icon size={18} /> {children}
    </div>
  );
}
