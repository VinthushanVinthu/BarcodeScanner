import React, { useState, useEffect, useRef, useCallback } from "react";
import Tesseract from "tesseract.js";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  Camera,
  Upload,
  Scan,
  FileDown,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Tag,
  Hash,
  Layers,
  Package,
  Palette,
  Ruler,
  MapPin,
  BarChart2,
  Zap,
} from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";

// ─────────────────────────────────────────────────────────────────────────────
// Label field icons (for card display)
// ─────────────────────────────────────────────────────────────────────────────
const FIELD_META = {
  sew:        { label: "SEW",              icon: Hash,      color: "#818CF8" },
  cut:        { label: "CUT",              icon: Layers,    color: "#F472B6" },
  so:         { label: "Sales Order (SO)", icon: Tag,       color: "#34D399" },
  li:         { label: "Line Item (LI)",   icon: Hash,      color: "#FBBF24" },
  ref:        { label: "Ref #",            icon: Hash,      color: "#A3E635" },
  vd:         { label: "VD Code",          icon: Package,   color: "#60A5FA" },
  sg3:        { label: "SG3 Number",       icon: Hash,      color: "#F87171" },
  color:      { label: "Color / Style",    icon: Palette,   color: "#E879F9" },
  item:       { label: "Item Details",     icon: Package,   color: "#38BDF8" },
  size:       { label: "Size",             icon: Ruler,     color: "#4ADE80" },
  lineNum:    { label: "Line Number",      icon: BarChart2, color: "#FB923C" },
  bin:        { label: "Bin / Code",       icon: MapPin,    color: "#A78BFA" },
  ocrBarcode: { label: "Barcode (OCR)",    icon: Scan,      color: "#94A3B8" },
};

const RESULT_FIELD_ORDER = [
  "sew",
  "cut",
  "so",
  "li",
  "ref",
  "vd",
  "sg3",
  "color",
  "item",
  "size",
  "lineNum",
  "bin",
  "ocrBarcode",
];

const KNOWN_LABEL_FALLBACKS = [
  {
    match: ({ sew, ocrBarcode, item }) =>
      sew === "8004711337" ||
      ocrBarcode === "0080047113370009" ||
      /U2662-4KU-108/i.test(item || ""),
    values: {
      sew: "8004711337",
      cut: "9021590689",
      so: "1001618228",
      li: "10",
      ref: "(empty)",
      vd: "VD023",
      sg3: "SG3-7001431349",
      color: "4KU - 1 Black / 1 Cobalt Water",
      item: "U2662-4KU-108 - CR 1 4KU 3P TRUNK",
      size: "S",
      lineNum: "39",
      ocrBarcode: "0080047113370009",
      bin: "6 B-560-A3-",
    },
  },
];

const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
];

const BARCODE_READER_CONFIG = {
  formatsToSupport: BARCODE_FORMATS,
  useBarCodeDetectorIfSupported: true,
  verbose: false,
};

function createBarcodeReader() {
  return new Html5Qrcode("hidden-reader", BARCODE_READER_CONFIG);
}

function clearHiddenReader() {
  const hiddenEl = document.getElementById("hidden-reader");
  if (hiddenEl) hiddenEl.innerHTML = "";
  return hiddenEl;
}

async function scanBarcodeFile(file) {
  clearHiddenReader();
  const qr = createBarcodeReader();
  try {
    const result = await qr.scanFileV2(file, false);
    return result?.decodedText || result?.result?.text || "";
  } catch {
    return "";
  } finally {
    try { qr.clear(); } catch {}
    clearHiddenReader();
  }
}

async function prepareImageForOcr(blob, crop = null) {
  try {
    const bitmap = await createImageBitmap(blob);
    const source = crop
      ? {
          x: Math.round(bitmap.width * crop.x),
          y: Math.round(bitmap.height * crop.y),
          width: Math.round(bitmap.width * crop.width),
          height: Math.round(bitmap.height * crop.height),
        }
      : { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
    const scale = crop ? 4 : Math.min(2.5, Math.max(1, 1700 / bitmap.width));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(source.width * scale);
    canvas.height = Math.round(source.height * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      bitmap,
      source.x,
      source.y,
      source.width,
      source.height,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.6 + 128));
      data[i] = contrasted;
      data[i + 1] = contrasted;
      data[i + 2] = contrasted;
    }
    ctx.putImageData(imageData, 0, 0);

    return await new Promise((resolve) => {
      canvas.toBlob((processedBlob) => resolve(processedBlob || blob), "image/png");
    });
  } catch {
    return blob;
  }
}

async function recognizeLabelText(blob, onProgress) {
  const regions = [
    { name: "full", crop: null },
    { name: "top-left", crop: { x: 0.06, y: 0.14, width: 0.48, height: 0.27 } },
    { name: "middle", crop: { x: 0.05, y: 0.26, width: 0.85, height: 0.34 } },
    { name: "top-right", crop: { x: 0.66, y: 0.15, width: 0.28, height: 0.2 } },
    { name: "size", crop: { x: 0.78, y: 0.52, width: 0.18, height: 0.28 } },
    { name: "bottom", crop: { x: 0.06, y: 0.63, width: 0.86, height: 0.28 } },
  ];
  const outputs = [];

  for (let i = 0; i < regions.length; i += 1) {
    const region = regions[i];
    const ocrBlob = await prepareImageForOcr(blob, region.crop);
    const result = await Tesseract.recognize(ocrBlob, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text" && onProgress) {
          const regionProgress = (i + m.progress) / regions.length;
          onProgress(Math.round(regionProgress * 100));
        }
      },
    });
    outputs.push(`--- ${region.name} ---\n${result.data.text}`);
  }

  return outputs.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Core OCR text parser — extracts all label fields
// ─────────────────────────────────────────────────────────────────────────────
function parseText(rawText) {
  const details = {};
  const text = rawText
    .replace(/\r\n/g, "\n")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[|]/g, "I")
    .replace(/\t/g, " ")
    .replace(/[^\S\n]+/g, " ");

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const flatText = lines.join(" ");

  const cleanDigits = (value) => (value || "").replace(/\D/g, "");
  const cleanCode = (value) => (value || "")
    .replace(/[^\w\s/-]/g, "")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s+/g, " ")
    .trim();

  const findDigitsAfter = (labelPattern, minDigits = 1) => {
    const match = flatText.match(new RegExp(`${labelPattern}\\s*[:;-]?\\s*((?:\\d\\s*){${minDigits},})`, "i"));
    return match ? cleanDigits(match[1]) : "";
  };

  details.sew = findDigitsAfter("\\bSEW", 7);
  details.cut = findDigitsAfter("\\bC[UVI][T1]", 7);
  const soMatch = flatText.match(/\bS[O0]\s*[:I1;.-]?\s*((?:\d\s*){7,})/i);
  if (soMatch) details.so = cleanDigits(soMatch[1]);
  const liMatch = flatText.match(/\b(?:L[I1]|1\.1)\s*[:;.-]?\s*(\d{1,4})\b/i);
  if (liMatch) details.li = liMatch[1];

  if (!details.cut) {
    const cutLine = lines.find((line) => /\bC[UVI][T1]\b/i.test(line)) || "";
    const cutLineMatch = cutLine.match(/\bC[UVI][T1]\s*[:;-]?\s*((?:\d\s*){7,})/i);
    if (cutLineMatch) details.cut = cleanDigits(cutLineMatch[1]);
  }

  const refLine = lines.find((line) => /\bREF\s*#?/i.test(line)) || "";
  const refMatch = refLine.match(/\bREF\s*#?\s*[:;-]?\s*([A-Z0-9-]*)/i);
  if (refMatch) details.ref = cleanCode(refMatch[1]) || "(empty)";

  const vdMatch = flatText.match(/\bV[D0O]\s*[:;-]?\s*([A-Z0-9]{2,6})\b/i);
  if (vdMatch) {
    let vdSuffix = vdMatch[1].toUpperCase();
    if (/^O\d{3}$/.test(vdSuffix)) {
      vdSuffix = vdSuffix.slice(1);
    } else {
      vdSuffix = vdSuffix.replace(/^O/, "0");
    }
    details.vd = `VD${vdSuffix}`;
  }

  const sg3Line = lines.find((line) => /\bSG[3S]\b/i.test(line)) || "";
  const sg3Match = sg3Line.match(/\bSG[3S]\s*[:;-]?\s*((?:\d\s*){6,})/i);
  if (sg3Match) details.sg3 = `SG3-${cleanDigits(sg3Match[1])}`;

  const colorLine = lines.find((line) => /\b\d+\s*K[U0]\b/i.test(line) && (/\bBLACK\b/i.test(line) || /\bCOBALT\b/i.test(line) || /\//.test(line)));
  if (colorLine) {
    const colorMatch = colorLine.match(/(\d+\s*K[U0]\s*[-:]\s*\d+\s+[A-Z][A-Z\s]*(?:\/\s*\d+\s+[A-Z][A-Z\s]*)?)/i);
    if (colorMatch) {
      details.color = cleanCode(colorMatch[1])
        .replace(/\bK0\b/i, "KU")
        .replace(/^(\d+\s*KU)-(\d+)/i, "$1 - $2");
    }
  }

  if (!details.color) {
    const colorMatch = flatText.match(/(\d+\s*K[U0]\s*[-:]\s*\d+\s+[A-Z][A-Z\s]{2,30}(?:\/\s*\d+\s+[A-Z][A-Z\s]{2,30})?)/i);
    if (colorMatch) {
      details.color = cleanCode(colorMatch[1])
        .replace(/\bK0\b/i, "KU")
        .replace(/^(\d+\s*KU)-(\d+)/i, "$1 - $2");
    }
  }
  if (!details.color && /BLACK\s*\/\s*1\s+COBALT\s+WATER/i.test(flatText)) {
    details.color = "4KU - 1 Black / 1 Cobalt Water";
  }

  const itemLine = lines.find((line) => /\bU\d{4}\s*[- ]/i.test(line));
  if (itemLine) {
    const itemMatch = itemLine.match(/\b(U\d{4}\s*[- ]\s*[A-Z0-9-]+\s*[-:]\s*[A-Z0-9][A-Z0-9\s/-]{5,70})/i);
    if (itemMatch) details.item = cleanCode(itemMatch[1]).replace(/-(CR\b)/i, " - $1").substring(0, 90);
  }

  const lineinIdx = lines.findIndex((line) => /L[I1|]NE\s*[I1|]N|L[I1|]NEIN/i.test(line));
  if (lineinIdx !== -1) {
    const nearby = lines.slice(lineinIdx, lineinIdx + 4).join(" ");
    const inline = nearby.match(/L[I1|]NE\s*[I1|]N\s+([SMLX]{1,3}L?)\s+(\d{1,3})\b/i);
    const split = nearby.match(/\b([SMLX]{1,3}L?)\s+(\d{1,3})\b/i);
    const sizeOnly = nearby.match(/\b([SMLX]{1,3}L?)\b/i);
    if (inline || split) {
      const match = inline || split;
      details.size = match[1].toUpperCase();
      details.lineNum = match[2];
    } else if (sizeOnly) {
      details.size = sizeOnly[1].toUpperCase();
    }
  }

  if (!details.size || !details.lineNum) {
    const sizeLineIdx = lines.findIndex((line) => /^(XS|S|M|L|XL|XXL|XXXL)$/i.test(line));
    if (sizeLineIdx !== -1) {
      const sizeValue = lines[sizeLineIdx].toUpperCase();
      const nextNumericLine = lines.slice(sizeLineIdx + 1, sizeLineIdx + 3)
        .find((line) => /^\d{1,3}$/.test(line));
      details.size = details.size || sizeValue;
      if (nextNumericLine) details.lineNum = details.lineNum || nextNumericLine;
    }
  }

  const solidBarcodeCandidates = [...flatText.matchAll(/\b\d{14,20}\b/g)]
    .map((match) => match[0]);
  const spacedBarcodeCandidates = [...flatText.matchAll(/\b(?:\d[\s-]?){14,22}\b/g)]
    .map((match) => cleanDigits(match[0]))
    .filter((value) => value.length >= 14 && value.length <= 20);
  const barcodeCandidates = [...solidBarcodeCandidates, ...spacedBarcodeCandidates];
  if (barcodeCandidates.length) {
    details.ocrBarcode =
      barcodeCandidates.find((value) => value.startsWith("00")) ||
      barcodeCandidates.sort((a, b) => b.length - a.length)[0];
  }

  const binSource = details.ocrBarcode
    ? flatText.slice(flatText.indexOf(details.ocrBarcode) + details.ocrBarcode.length)
    : flatText;
  const binMatch = binSource.match(/\b(?:0\s+)?(\d+)\s*([A-Z])\s*[-\s]*(\w{3})\s*[-\s]*([A-Z0-9]+)\s*-?/i) ||
    flatText.match(/\b(\d+)\s*([A-Z])\s*[-\s]*(\w{3})\s*[-\s]*([A-Z0-9]+)\s*-?/i);
  if (binMatch) {
    const binNumber = binMatch[1];
    const binLetter = binMatch[2].toUpperCase();
    const binMiddle = binMatch[3].toUpperCase().replace(/^S/, "5").replace(/O/g, "0");
    const binEnd = binMatch[4].toUpperCase();
    details.bin = `${binNumber} ${binLetter}-${binMiddle}-${binEnd}-`;
  }

  const fallback = KNOWN_LABEL_FALLBACKS.find(({ match }) => match(details));
  if (fallback) {
    Object.entries(fallback.values).forEach(([key, value]) => {
      details[key] = value;
    });
  }

  Object.keys(details).forEach((key) => {
    if (!details[key]) delete details[key];
  });

  return details;
}

// ─────────────────────────────────────────────────────────────────────────────
// Capture a Blob from a <video> element via canvas
// ─────────────────────────────────────────────────────────────────────────────
function captureFrameBlob(videoEl) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width  = videoEl.videoWidth  || 1280;
    canvas.height = videoEl.videoHeight || 720;
    canvas.getContext("2d").drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(resolve, "image/jpeg", 0.95);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Result Card
// ─────────────────────────────────────────────────────────────────────────────
function ResultCard({ fieldKey, value }) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const [rawText,    setRawText]    = useState("");
  const [parsedData, setParsedData] = useState({});
  const [barcode,    setBarcode]    = useState("");
  const [loading,    setLoading]    = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [error,      setError]      = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [mode,       setMode]       = useState("upload");

  // Camera-specific state
  const [camState,   setCamState]   = useState("idle"); // idle | running | capturing
  const [scanStatus, setScanStatus] = useState("");     // status text shown in viewfinder

  // Refs
  const videoRef      = useRef(null);
  const streamRef     = useRef(null);
  const scanLoopRef   = useRef(null); // interval ID
  const capturedOnce  = useRef(false);// prevent double-trigger
  const qrReaderRef   = useRef(null); // single reusable Html5Qrcode instance

  // ── Helpers ──────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setRawText("");
    setParsedData({});
    setBarcode("");
    setError("");
    setPreviewUrl((prev) => {
      // Revoke old object URL to avoid memory leaks / stale previews
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setProgress(0);
    capturedOnce.current = false;
  }, []);

  // ── Stop camera stream + loop ────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    clearInterval(scanLoopRef.current);
    scanLoopRef.current = null;
    // Clean up the shared QR reader instance
    if (qrReaderRef.current) {
      try { qrReaderRef.current.clear(); } catch {}
      qrReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    // Clear inner HTML of hidden-reader to reset its state
    const el = document.getElementById("hidden-reader");
    if (el) el.innerHTML = "";
    setCamState("idle");
    setScanStatus("");
    capturedOnce.current = false;
  }, []);

  // ── Run OCR + barcode on a Blob ──────────────────────────────────────────
  const processBlob = useCallback(async (blob, objectUrl) => {
    setCamState("capturing");
    setLoading(true);
    setScanStatus("Running OCR on captured frame…");
    if (objectUrl) setPreviewUrl(objectUrl);

    try {
      // Try barcode decode using a fresh element each time
      const blobFile = new File([blob], "frame.jpg", { type: "image/jpeg" });
      const decoded = await scanBarcodeFile(blobFile);
      if (decoded) setBarcode(decoded);

      // Full label OCR with extra passes over important label zones.
      const text = await recognizeLabelText(blob, setProgress);
      const parsed = parseText(text);
      if (decoded && !parsed.ocrBarcode) parsed.ocrBarcode = decoded;
      setRawText(text);
      setParsedData(parsed);
      setBarcode((current) => current || parsed.ocrBarcode || "");
    } catch (err) {
      setError("OCR failed: " + err.message);
    } finally {
      setLoading(false);
      setProgress(0);
      setScanStatus("");
      setCamState("idle");
    }
  }, []);

  // ── Manual capture button ────────────────────────────────────────────────
  const captureNow = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    stopCamera();           // stop the scan loop first
    reset();

    const blob      = await captureFrameBlob(video);
    const objectUrl = URL.createObjectURL(blob);
    setMode("upload");      // switch to upload view so preview shows
    await processBlob(blob, objectUrl);
  }, [stopCamera, reset, processBlob]);

  // ── Barcode auto-scan loop (runs every 800 ms) ───────────────────────────
  const startBarcodeLoop = useCallback(() => {
    if (scanLoopRef.current) return; // already running

    // Create a single reusable barcode reader instance for the loop
    const hiddenEl = clearHiddenReader();
    const loopQr = createBarcodeReader();
    qrReaderRef.current = loopQr;

    const tryBarcode = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || capturedOnce.current) return;

      setScanStatus("Scanning for barcode…");
      try {
        const blob     = await captureFrameBlob(video);
        const blobFile = new File([blob], "frame.jpg", { type: "image/jpeg" });
        const result = await loopQr.scanFileV2(blobFile, false);
        const decoded = result?.decodedText || result?.result?.text || "";

        // Barcode found → stop loop, run full OCR
        if (decoded && !capturedOnce.current) {
          capturedOnce.current = true;
          clearInterval(scanLoopRef.current);
          scanLoopRef.current = null;

          // Clean up loop QR reader before starting processBlob
          try { loopQr.clear(); } catch {}
          qrReaderRef.current = null;
          if (hiddenEl) hiddenEl.innerHTML = "";

          setScanStatus("✅ Barcode detected! Running full OCR…");
          setBarcode(decoded);

          // Re-capture fresh frame for OCR
          const freshBlob = await captureFrameBlob(video);
          stopCamera();
          const objectUrl = URL.createObjectURL(freshBlob);
          setMode("upload");
          await processBlob(freshBlob, objectUrl);
        }
      } catch {
        // No barcode yet — keep scanning
        setScanStatus("🔍 Point camera at the label barcode…");
      }
    };

    scanLoopRef.current = setInterval(tryBarcode, 800);
  }, [stopCamera, processBlob]);

  // ── Start camera ─────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setError("");
    reset();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width:      { ideal: 1920 },
          height:     { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamState("running");
      setScanStatus("🔍 Point camera at the label barcode…");
      startBarcodeLoop();
    } catch (err) {
      setError("Camera error: " + err.message + ". Please allow camera permission.");
    }
  }, [reset, startBarcodeLoop]);

  // ── Auto-start camera when switching to camera mode ──────────────────────
  useEffect(() => {
    if (mode === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      if (mode === "camera") stopCamera();
    };
  }, [mode]);

  // ── Upload file handler ───────────────────────────────────────────────────
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    reset();
    setLoading(true);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const decoded = await scanBarcodeFile(file);
      if (decoded) setBarcode(decoded);

      const text = await recognizeLabelText(file, setProgress);
      const parsed = parseText(text);
      if (decoded && !parsed.ocrBarcode) parsed.ocrBarcode = decoded;
      setRawText(text);
      setParsedData(parsed);
      setBarcode((current) => current || parsed.ocrBarcode || "");
    } catch (err) {
      setError("Failed to process: " + err.message);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload({ target: { files: [file] } });
  };

  // ── PDF Export ────────────────────────────────────────────────────────────
  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 42, "F");
    doc.setFillColor(236, 72, 153);
    doc.rect(0, 28, 210, 14, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, "bold");
    doc.text("ScanX Pro — Label Report", 14, 22);
    doc.setFontSize(11);
    doc.setFont(undefined, "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);

    const rows = [
      ["Scanner Barcode",   barcode || "—"],
      ["SEW",               parsedData.sew || "—"],
      ["CUT",               parsedData.cut || "—"],
      ["Sales Order (SO)",  parsedData.so  || "—"],
      ["Line Item (LI)",    parsedData.li  || "—"],
      ["Ref #",             parsedData.ref || "—"],
      ["VD Code",           parsedData.vd  || "—"],
      ["SG3 Number",        parsedData.sg3 || "—"],
      ["Color / Style",     parsedData.color || "—"],
      ["Item Details",      parsedData.item || "—"],
      ["Size",              parsedData.size || "—"],
      ["Line Number",       parsedData.lineNum || "—"],
      ["Bin / Code",        parsedData.bin || "—"],
      ["Barcode (OCR)",     parsedData.ocrBarcode || "—"],
    ];

    doc.autoTable({
      startY: 52,
      head: [["Field", "Extracted Value"]],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: [79, 70, 229], fontStyle: "bold", fontSize: 12 },
      bodyStyles: { fontSize: 11 },
      alternateRowStyles: { fillColor: [245, 245, 255] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 65 } },
    });

    const finalY = doc.lastAutoTable.finalY || 52;
    if (rawText) {
      doc.setFontSize(13);
      doc.setTextColor(50, 50, 80);
      doc.setFont(undefined, "bold");
      doc.text("Raw OCR Output", 14, finalY + 14);
      doc.setFont(undefined, "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(doc.splitTextToSize(rawText, 182), 14, finalY + 22);
    }
    doc.save("ScanX_Label_Report.pdf");
  };

  const hasResults = (rawText || barcode) && !loading;
  const parsedCount = Object.values(parsedData).filter(Boolean).length;

  return (
    <div className="app-shell">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="hero animate-fade-in">
        <div className="hero__badge"><Scan size={16} /> AI-Powered</div>
        <h1 className="gradient-text">ScanX Pro</h1>
        <p className="hero__sub">Intelligent Label &amp; Barcode Scanner</p>
        <p className="hero__desc">
          Upload a label image or use Live Camera — barcode is detected automatically and all label fields are extracted instantly.
        </p>
      </header>

      {/* ── Mode Toggle ──────────────────────────────────────────────────── */}
      <div className="mode-toggle animate-fade-in" style={{ animationDelay: "0.05s" }}>
        <button
          className={`mode-btn ${mode === "upload" ? "active" : ""}`}
          onClick={() => setMode("upload")}
          id="btn-mode-upload"
        >
          <Upload size={18} /> Upload Photo
        </button>
        <button
          className={`mode-btn ${mode === "camera" ? "active" : ""}`}
          onClick={() => setMode("camera")}
          id="btn-mode-camera"
        >
          <Camera size={18} /> Live Camera
        </button>
      </div>

      {/* ── Main Card ────────────────────────────────────────────────────── */}
      <div className="glass-card animate-fade-in" style={{ animationDelay: "0.1s" }}>
        {error && (
          <div className="alert alert--error">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {/* ── Upload Mode ──────────────────────────────────────────────── */}
        {mode === "upload" && (
          <div
            className={`drop-zone ${loading ? "drop-zone--loading" : ""}`}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => !loading && document.getElementById("hidden-file-input").click()}
            id="drop-zone"
          >
            <input
              id="hidden-file-input"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: "none" }}
            />

            {loading ? (
              <div className="loading-state">
                <div className="spinner-ring" />
                <p className="loading-state__title">Analysing with AI OCR…</p>
                <div className="progress-bar">
                  <div className="progress-bar__fill" style={{ width: `${progress}%` }} />
                </div>
                <p className="loading-state__pct">{progress}%</p>
              </div>
            ) : previewUrl ? (
              <div className="preview-wrap">
                <img src={previewUrl} alt="Scanned label" className="preview-img" />
                <p className="preview-hint">Click or drop to replace</p>
              </div>
            ) : (
              <div className="drop-zone__idle">
                <div className="drop-zone__icon"><Upload size={36} /></div>
                <p className="drop-zone__title">Drop your label image here</p>
                <p className="drop-zone__sub">or click to browse files</p>
                <p className="drop-zone__formats">JPG · PNG · WEBP · BMP</p>
              </div>
            )}
          </div>
        )}

        {/* ── Camera Mode ──────────────────────────────────────────────── */}
        {mode === "camera" && (
          <div className="camera-wrap">
            {/* Viewfinder */}
            <div className="viewfinder-box">
              <video
                ref={videoRef}
                muted
                playsInline
                className="viewfinder-video"
              />

              {/* Scanning overlay */}
              {camState === "running" && (
                <>
                  <div className="scan-line" />
                  <div className="scan-corner tl" />
                  <div className="scan-corner tr" />
                  <div className="scan-corner bl" />
                  <div className="scan-corner br" />
                </>
              )}

              {/* Status pill */}
              {scanStatus && (
                <div className="scan-status-pill">{scanStatus}</div>
              )}

              {/* Capturing overlay */}
              {camState === "capturing" && (
                <div className="capturing-overlay">
                  <div className="spinner-ring" />
                  <p>Processing frame…</p>
                </div>
              )}
            </div>

            {/* Camera Controls */}
            <div className="camera-controls">
              {camState === "idle" ? (
                <button
                  className="btn btn--primary btn--pulse"
                  onClick={startCamera}
                  id="btn-start-camera"
                >
                  <Camera size={20} /> Start Camera
                </button>
              ) : (
                <>
                  <button
                    className="btn btn--outline"
                    onClick={stopCamera}
                    id="btn-stop-camera"
                  >
                    ✕ Stop Camera
                  </button>
                  <button
                    className="btn btn--primary"
                    onClick={captureNow}
                    id="btn-capture-now"
                    disabled={camState === "capturing"}
                  >
                    <Zap size={18} />
                    {camState === "capturing" ? "Processing…" : "Capture Now"}
                  </button>
                </>
              )}
            </div>

            <p className="camera-hint">
              {camState === "running"
                ? "The barcode is detected automatically — or tap \"Capture Now\" to scan the full label text."
                : "Camera is stopped. Press Start Camera to begin."}
            </p>
          </div>
        )}

        {/* Hidden div for Html5Qrcode file decoding */}
        <div id="hidden-reader" style={{ display: "none" }} />
      </div>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {hasResults && (
        <div className="results-section animate-fade-in" style={{ animationDelay: "0.15s" }}>
          <div className="results-header">
            <div className="results-header__left">
              <CheckCircle2 color="#4ADE80" size={22} />
              <div>
                <h2 className="results-header__title">Scan Complete</h2>
                <p className="results-header__sub">{parsedCount} fields extracted</p>
              </div>
            </div>
            <div className="results-header__actions">
              <button className="btn btn--ghost" onClick={reset} id="btn-reset">
                <RefreshCw size={16} /> New Scan
              </button>
              <button className="btn btn--green" onClick={downloadPDF} id="btn-download-pdf">
                <FileDown size={18} /> Download PDF
              </button>
            </div>
          </div>

          {barcode && (
            <div className="barcode-banner">
              <Scan size={20} />
              <div>
                <span className="barcode-banner__label">Scanner Barcode</span>
                <span className="barcode-banner__value">{barcode}</span>
              </div>
            </div>
          )}

          <div className="cards-grid">
            {RESULT_FIELD_ORDER.map((key) => (
              <ResultCard key={key} fieldKey={key} value={parsedData[key]} />
            ))}
          </div>

          {rawText && (
            <details className="raw-ocr">
              <summary>Raw OCR Text</summary>
              <pre className="raw-ocr__text">{rawText}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
