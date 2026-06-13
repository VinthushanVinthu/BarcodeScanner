import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  FileDown,
  Layers,
  RefreshCw,
  Save,
  Scan,
  Upload,
} from "lucide-react";
import Alert from "../components/Alert";
import ResultCard from "../components/ResultCard";
import { RESULT_FIELD_ORDER } from "../constants/labelFields";

export default function ScannerView({
  selectedSection,
  scannerTitle,
  scanError,
  loading,
  progress,
  cameraState,
  cameraFacing,
  videoRef,
  fileInputRef,
  previewUrl,
  hasResults,
  parsedCount,
  barcode,
  parsedData,
  rawText,
  scanDate,
  saveState,
  onExit,
  onDrop,
  onDragOver,
  onImageUpload,
  onStartCamera,
  onSwitchCamera,
  onCapturePhoto,
  onStopCamera,
  onResetScan,
  onScanDateChange,
  onSaveScan,
  onDownloadPdf,
}) {
  if (!selectedSection) return null;

  return (
    <main className="page-stack">
      <section className="scanner-heading">
        <div>
          <span className="eyebrow">
            <Layers size={16} /> {scannerTitle}
          </span>
          <h1>Label Photo OCR</h1>
          <p>Take or upload a label photo. Review extracted details, then save the scan.</p>
        </div>
        <button type="button" className="btn btn--outline" onClick={onExit}>
          <ArrowLeft size={16} /> Exit
        </button>
      </section>

      <section className="tool-panel">
        {scanError && <Alert>{scanError}</Alert>}

        <div className={`drop-zone ${loading ? "drop-zone--loading" : ""}`} onDrop={onDrop} onDragOver={onDragOver}>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={onImageUpload} hidden />

          {loading ? (
            <div className="loading-state">
              <div className="spinner-ring" />
              <p className="loading-state__title">Reading details from photo...</p>
              <div className="progress-bar">
                <div className="progress-bar__fill" style={{ width: `${progress}%` }} />
              </div>
              <p className="loading-state__pct">{progress}%</p>
            </div>
          ) : cameraState !== "closed" ? (
            <div className="camera-panel">
              <div className="camera-preview">
                <video ref={videoRef} autoPlay muted playsInline className="camera-video" />
                {cameraState === "opening" && (
                  <div className="camera-overlay">
                    <div className="spinner-ring" />
                    <p>Opening camera...</p>
                  </div>
                )}
              </div>
              <div className="button-row">
                <button type="button" className="btn btn--primary" onClick={onCapturePhoto} disabled={cameraState !== "open"}>
                  <Camera size={18} /> Capture Photo
                </button>
                <button type="button" className="btn btn--outline" onClick={onSwitchCamera} disabled={cameraState !== "open"}>
                  <RefreshCw size={18} /> {cameraFacing === "environment" ? "Front Camera" : "Back Camera"}
                </button>
                <button type="button" className="btn btn--outline" onClick={onStopCamera}>
                  Cancel
                </button>
              </div>
            </div>
          ) : previewUrl ? (
            <div className="preview-wrap">
              <img src={previewUrl} alt="Selected label" className="preview-img" />
              <div className="button-row">
                <button type="button" className="btn btn--primary" onClick={onStartCamera}>
                  <Camera size={18} /> Take Photo
                </button>
                <button type="button" className="btn btn--outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={18} /> Upload Photo
                </button>
              </div>
              <p className="muted">Drop another image here to replace this photo.</p>
            </div>
          ) : (
            <div className="drop-zone__idle">
              <div className="drop-zone__icon">
                <Camera size={36} />
              </div>
              <p className="drop-zone__title">Take or upload a label photo</p>
              <p className="drop-zone__sub">Choose a clear JPG, PNG, WEBP, or BMP image.</p>
              <div className="button-row">
                <button type="button" className="btn btn--primary" onClick={onStartCamera}>
                  <Camera size={18} /> Take Photo
                </button>
                <button type="button" className="btn btn--outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={18} /> Upload Photo
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {hasResults && (
        <section className="results-section">
          <div className="results-header">
            <div className="results-header__left">
              <CheckCircle2 color="#14B8A6" size={22} />
              <div>
                <h2 className="results-header__title">Photo Processed</h2>
                <p className="results-header__sub">{parsedCount} fields extracted</p>
              </div>
            </div>
            <div className="results-header__actions">
              <button type="button" className="btn btn--ghost" onClick={onResetScan}>
                <RefreshCw size={16} /> New Photo
              </button>
              <button type="button" className="btn btn--green" onClick={onSaveScan} disabled={saveState === "saving" || saveState === "saved"}>
                <Save size={18} /> {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving..." : "Save"}
              </button>
              <button type="button" className="btn btn--outline" onClick={onDownloadPdf}>
                <FileDown size={18} /> PDF
              </button>
            </div>
          </div>

          {saveState === "saved" && <Alert type="success">Scan saved.</Alert>}

          <div className="scan-date-panel">
            <label>
              Label date
              <input type="date" value={scanDate} onChange={(event) => onScanDateChange(event.target.value)} disabled={saveState === "saved"} />
            </label>
          </div>

          {barcode && (
            <div className="barcode-banner">
              <Scan size={20} />
              <div>
                <span className="barcode-banner__label">Barcode from Photo</span>
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
        </section>
      )}
    </main>
  );
}
