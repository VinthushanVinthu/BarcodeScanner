export function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

export function formatDateOnly(value) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

export function getTodayInputDate() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

export function getDateInputDaysAgo(daysAgo) {
  const now = new Date();
  now.setDate(now.getDate() - daysAgo);
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

export function getScanDate(scan) {
  if (scan?.label_date) return scan.label_date;
  if (scan?.created_at) return scan.created_at.slice(0, 10);
  return "";
}
