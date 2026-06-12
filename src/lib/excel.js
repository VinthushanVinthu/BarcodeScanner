import { SUMMARY_TABLE_COLUMNS } from "../constants/labelFields";
import { formatDate, formatDateOnly, getScanDate } from "./format";

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getCellValue(scan, key) {
  if (key === "section") return scan.section?.name || "";
  if (key === "created_at") return formatDate(scan.created_at);
  if (key === "label_date") return formatDateOnly(getScanDate(scan));
  return scan[key] || "";
}

export function downloadScansExcel(scans) {
  const headerCells = SUMMARY_TABLE_COLUMNS.map((column) => `<Cell><Data ss:Type="String">${escapeXml(column.label)}</Data></Cell>`).join("");
  const dataRows = scans
    .map((scan) => {
      const cells = SUMMARY_TABLE_COLUMNS.map((column) => `<Cell><Data ss:Type="String">${escapeXml(getCellValue(scan, column.key))}</Data></Cell>`).join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");

  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Label Summary">
    <Table>
      <Row>${headerCells}</Row>
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `label-summary-${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
