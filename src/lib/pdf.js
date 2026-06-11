import jsPDF from "jspdf";
import "jspdf-autotable";

export function downloadLabelPdf({ selectedSection, barcode, parsedData, rawText }) {
  const doc = new jsPDF();
  doc.setFillColor(26, 54, 93);
  doc.rect(0, 0, 210, 42, "F");
  doc.setFillColor(20, 184, 166);
  doc.rect(0, 28, 210, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont(undefined, "bold");
  doc.text("Label Photo Report", 14, 22);
  doc.setFontSize(11);
  doc.setFont(undefined, "normal");
  doc.text(`Section: ${selectedSection?.name || "Not selected"}`, 14, 32);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 38);

  const rows = [
    ["Barcode from Photo", barcode || "-"],
    ["SEW", parsedData.sew || "-"],
    ["CUT", parsedData.cut || "-"],
    ["Sales Order (SO)", parsedData.so || "-"],
    ["Line Item (LI)", parsedData.li || "-"],
    ["Ref #", parsedData.ref || "-"],
    ["VD Code", parsedData.vd || "-"],
    ["SG3 Number", parsedData.sg3 || "-"],
    ["Color / Style", parsedData.color || "-"],
    ["Item Details", parsedData.item || "-"],
    ["Size", parsedData.size || "-"],
    ["Line Number", parsedData.lineNum || "-"],
    ["Bin / Code", parsedData.bin || "-"],
    ["Barcode (OCR)", parsedData.ocrBarcode || "-"],
  ];

  doc.autoTable({
    startY: 52,
    head: [["Field", "Extracted Value"]],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [26, 54, 93], fontStyle: "bold", fontSize: 12 },
    bodyStyles: { fontSize: 11 },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 65 } },
  });

  const finalY = doc.lastAutoTable.finalY || 52;
  if (rawText) {
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.setFont(undefined, "bold");
    doc.text("Raw OCR Output", 14, finalY + 14);
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(doc.splitTextToSize(rawText, 182), 14, finalY + 22);
  }
  doc.save("Label_Photo_Report.pdf");
}
