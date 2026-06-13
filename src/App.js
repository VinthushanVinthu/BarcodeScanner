import React, { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import Alert from "./components/Alert";
import SectionConfirmModal from "./components/SectionConfirmModal";
import SetupPanel from "./components/SetupPanel";
import Topbar from "./components/Topbar";
import { EMPTY_SECTION_FORM } from "./constants/labelFields";
import { captureFrameBlob, parseText, recognizeLabelText } from "./lib/ocr";
import { downloadLabelPdf } from "./lib/pdf";
import { getDateInputDaysAgo, getTodayInputDate } from "./lib/format";
import {
  checkIsAdmin,
  deleteLabelScan,
  deleteSection,
  fetchActiveSections,
  fetchAdminSections,
  fetchLabelScans,
  fetchSummarySections,
  saveLabelScan,
  updateLabelScan,
  upsertSection,
} from "./services/supabaseApi";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import AdminView from "./views/AdminView";
import ScannerView from "./views/ScannerView";
import SectionsView from "./views/SectionsView";
import SummaryView from "./views/SummaryView";

function App() {
  const [view, setView] = useState("sections");
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [pendingSection, setPendingSection] = useState(null);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [appError, setAppError] = useState("");
  const [notice, setNotice] = useState("");

  const [rawText, setRawText] = useState("");
  const [parsedData, setParsedData] = useState({});
  const [barcode, setBarcode] = useState("");
  const [scanDate, setScanDate] = useState(getTodayInputDate());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scanError, setScanError] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [cameraState, setCameraState] = useState("closed");
  const [cameraFacing, setCameraFacing] = useState("environment");
  const [saveState, setSaveState] = useState("idle");

  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "", confirmPassword: "", adminCode: "" });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [adminSections, setAdminSections] = useState([]);
  const [labelScans, setLabelScans] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [sectionForm, setSectionForm] = useState(EMPTY_SECTION_FORM);
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [adminMessage, setAdminMessage] = useState("");
  const [summaryMessage, setSummaryMessage] = useState("");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const scannerHistoryRef = useRef(false);

  const hasResults = Boolean((rawText || barcode) && !loading);
  const parsedCount = Object.values(parsedData).filter(Boolean).length;
  const hasScannerWork = view === "scanner" && Boolean(loading || rawText || previewUrl || cameraState !== "closed");
  const scannerTitle = selectedSection ? `${selectedSection.name} Section` : "Section Scanner";
  const summaryStartDate = getDateInputDaysAgo(14);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraState("closed");
  }, []);

  const resetScan = useCallback(() => {
    stopCamera();
    setRawText("");
    setParsedData({});
    setBarcode("");
    setScanDate(getTodayInputDate());
    setScanError("");
    setSaveState("idle");
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setProgress(0);
  }, [stopCamera]);

  const loadSections = useCallback(async () => {
    if (!supabase) return;
    setSectionsLoading(true);
    setAppError("");
    const { data, error } = await fetchActiveSections();
    if (error) {
      setAppError(error.message);
    } else {
      setSections(data || []);
    }
    setSectionsLoading(false);
  }, []);

  const checkAdmin = useCallback(async (currentSession) => {
    if (!supabase || !currentSession) {
      setIsAdmin(false);
      return false;
    }

    const { data, error } = await checkIsAdmin();
    const admin = !error && Boolean(data);
    setIsAdmin(admin);
    return admin;
  }, []);

  const loadAdminData = useCallback(async () => {
    if (!supabase) return;
    setAdminLoading(true);
    setAdminMessage("");

    const sectionsResult = await fetchAdminSections();

    if (sectionsResult.error) setAdminMessage(sectionsResult.error.message);
    setAdminSections(sectionsResult.data || []);
    setAdminLoading(false);
  }, []);

  const loadSummaryData = useCallback(async () => {
    if (!supabase) return;
    setAdminLoading(true);
    setSummaryMessage("");

    const [sectionsResult, scansResult] = await Promise.all([fetchSummarySections(), fetchLabelScans({ fromDate: summaryStartDate })]);

    if (sectionsResult.error) setSummaryMessage(sectionsResult.error.message);
    if (scansResult.error) setSummaryMessage(scansResult.error.message);
    setAdminSections(sectionsResult.data || []);
    setLabelScans(scansResult.data || []);
    setAdminLoading(false);
  }, [summaryStartDate]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  useEffect(() => {
    if (!supabase) return undefined;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
      checkAdmin(data.session || null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      checkAdmin(nextSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, [checkAdmin]);

  useEffect(() => {
    if (view === "admin") {
      loadAdminData();
    }
    if (view === "summary") {
      loadSummaryData();
    }
  }, [view, loadAdminData, loadSummaryData]);

  useEffect(() => {
    if (!hasScannerWork) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasScannerWork]);

  useEffect(() => {
    if (view !== "scanner") {
      scannerHistoryRef.current = false;
      return undefined;
    }

    if (!scannerHistoryRef.current) {
      window.history.pushState({ appView: "scanner" }, "", window.location.href);
      scannerHistoryRef.current = true;
    }

    const handlePopState = () => {
      const shouldExit = !hasScannerWork || window.confirm("Exit this section? Unsaved scan data will be lost.");
      if (shouldExit) {
        resetScan();
        setSelectedSection(null);
        setView("sections");
      } else {
        window.history.pushState({ appView: "scanner" }, "", window.location.href);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [view, hasScannerWork, resetScan]);

  useEffect(() => {
    if (cameraState === "closed" || !videoRef.current || !streamRef.current) return;
    if (videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraState]);

  useEffect(() => stopCamera, [stopCamera]);

  const requireScannerExit = useCallback(() => {
    if (!hasScannerWork) return true;
    return window.confirm("Exit this section? Unsaved scan data will be lost.");
  }, [hasScannerWork]);

  const goHome = useCallback(() => {
    if (view === "scanner" && !requireScannerExit()) return;
    resetScan();
    setSelectedSection(null);
    setView("sections");
  }, [view, requireScannerExit, resetScan]);

  const openAdmin = () => {
    if (view === "scanner" && !requireScannerExit()) return;
    resetScan();
    setSelectedSection(null);
    setView("admin");
  };

  const openSummary = () => {
    if (view === "scanner" && !requireScannerExit()) return;
    resetScan();
    setSelectedSection(null);
    setView("summary");
  };

  const confirmSection = () => {
    if (!pendingSection) return;
    resetScan();
    setSelectedSection(pendingSection);
    setPendingSection(null);
    setView("scanner");
  };

  const openCamera = useCallback(async (nextFacing) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError("Camera is not available in this browser.");
      return;
    }

    stopCamera();
    setScanError("");
    setCameraState("opening");

    try {
      const baseVideoSettings = {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      };
      const getStream = (facingMode) =>
        navigator.mediaDevices.getUserMedia({
          video: {
            ...baseVideoSettings,
            facingMode,
          },
          audio: false,
        });

      let stream;
      try {
        stream = await getStream({ exact: nextFacing });
      } catch (_exactFacingError) {
        stream = await getStream({ ideal: nextFacing });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState("open");
    } catch (err) {
      setCameraState("closed");
      setScanError("Camera error: " + err.message + ". Please allow camera permission.");
    }
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    resetScan();
    await openCamera(cameraFacing);
  }, [cameraFacing, openCamera, resetScan]);

  const switchCamera = useCallback(async () => {
    if (cameraState === "opening") return;
    const nextFacing = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(nextFacing);
    await openCamera(nextFacing);
  }, [cameraFacing, cameraState, openCamera]);

  const processImageFile = useCallback(
    async (file) => {
      if (!file) return;

      resetScan();
      setLoading(true);
      setPreviewUrl(URL.createObjectURL(file));

      try {
        const text = await recognizeLabelText(file, setProgress);
        const parsed = parseText(text);
        setRawText(text);
        setParsedData(parsed);
        setBarcode(parsed.ocrBarcode || "");
      } catch (err) {
        setScanError("Failed to process photo: " + err.message);
      } finally {
        setLoading(false);
        setProgress(0);
      }
    },
    [resetScan]
  );

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const blob = await captureFrameBlob(video);
    if (!blob) {
      setScanError("Could not capture photo from camera.");
      return;
    }

    const file = new File([blob], "label-photo.jpg", { type: "image/jpeg" });
    await processImageFile(file);
  }, [processImageFile]);

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    await processImageFile(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) processImageFile(file);
  };

  const saveScan = async () => {
    if (!selectedSection || !hasResults) return;
    setSaveState("saving");
    setScanError("");

    const { error } = await saveLabelScan({ selectedSection, barcode, parsedData, rawText, scanDate });
    if (error) {
      setSaveState("idle");
      setScanError("Could not save scan: " + error.message);
    } else {
      setSaveState("saved");
      setNotice("Scan saved.");
    }
  };

  const downloadPDF = () => {
    downloadLabelPdf({ selectedSection, barcode, parsedData, rawText });
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    setAuthLoading(true);
    setAuthError("");
    setNotice("");

    if (authMode === "signup" && authForm.password !== authForm.confirmPassword) {
      setAuthError("Password and confirm password do not match.");
      setAuthLoading(false);
      return;
    }

    const authCall =
      authMode === "login"
        ? supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.password })
        : supabase.auth.signUp({
            email: authForm.email,
            password: authForm.password,
            options: { data: { admin_code: authForm.adminCode } },
          });

    const { data, error } = await authCall;
    if (error) {
      setAuthError(error.message);
    } else {
      setSession(data.session || session);
      await checkAdmin(data.session || session);
      setNotice(authMode === "signup" ? "Admin account created. If email confirmation is enabled, confirm your email before login." : "Logged in.");
      setAuthForm({ email: "", password: "", confirmPassword: "", adminCode: "" });
    }
    setAuthLoading(false);
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
    if (view === "summary") {
      await loadSummaryData();
    } else {
      setLabelScans([]);
      setAdminSections([]);
    }
  };

  const saveSection = async (event) => {
    event.preventDefault();
    if (!isAdmin) return;
    setAdminLoading(true);
    setAdminMessage("");

    const { error } = await upsertSection(sectionForm, editingSectionId);
    if (error) {
      setAdminMessage(error.message);
    } else {
      setSectionForm(EMPTY_SECTION_FORM);
      setEditingSectionId(null);
      setAdminMessage(editingSectionId ? "Section updated." : "Section created.");
      await loadSections();
      await loadAdminData();
    }
    setAdminLoading(false);
  };

  const removeSection = async (section) => {
    if (!isAdmin) return;
    const shouldDelete = window.confirm(`Delete ${section.name}? Scans already saved in this section can prevent deletion.`);
    if (!shouldDelete) return;

    setAdminLoading(true);
    setAdminMessage("");
    const { error } = await deleteSection(section.id);
    if (error) {
      setAdminMessage(error.message);
    } else {
      if (editingSectionId === section.id) cancelEditSection();
      setAdminMessage("Section deleted.");
      await loadSections();
      await loadAdminData();
    }
    setAdminLoading(false);
  };

  const saveSummaryScan = async (scanId, scanForm) => {
    setAdminLoading(true);
    setSummaryMessage("");
    const { error } = await updateLabelScan(scanId, scanForm);
    if (error) {
      setSummaryMessage(error.message);
    } else {
      setSummaryMessage("Summary row updated.");
      await loadSummaryData();
    }
    setAdminLoading(false);
    return !error;
  };

  const removeSummaryScan = async (scan) => {
    const shouldDelete = window.confirm(`Delete saved label ${scan.barcode || scan.id}?`);
    if (!shouldDelete) return false;

    setAdminLoading(true);
    setSummaryMessage("");
    const { error } = await deleteLabelScan(scan.id);
    if (error) {
      setSummaryMessage(error.message);
    } else {
      setSummaryMessage("Summary row deleted.");
      await loadSummaryData();
    }
    setAdminLoading(false);
    return !error;
  };

  const editSection = (section) => {
    setEditingSectionId(section.id);
    setSectionForm({
      name: section.name || "",
      description: section.description || "",
      sort_order: section.sort_order || 0,
      is_active: section.is_active,
    });
  };

  const cancelEditSection = () => {
    setEditingSectionId(null);
    setSectionForm(EMPTY_SECTION_FORM);
  };

  if (!isSupabaseConfigured) {
    return <SetupPanel />;
  }

  return (
    <div className="app-shell">
      <Topbar view={view} onHome={goHome} onAdmin={openAdmin} onSummary={openSummary} />

      {notice && (
        <Alert type="success">
          <span>{notice}</span>
          <button type="button" className="icon-link" onClick={() => setNotice("")} aria-label="Dismiss notice">
            <X size={15} />
          </button>
        </Alert>
      )}

      {view === "sections" && (
        <SectionsView
          sections={sections}
          sectionsLoading={sectionsLoading}
          appError={appError}
          onRefresh={loadSections}
          onSelectSection={setPendingSection}
        />
      )}

      {view === "scanner" && (
        <ScannerView
          selectedSection={selectedSection}
          scannerTitle={scannerTitle}
          scanError={scanError}
          loading={loading}
          progress={progress}
          cameraState={cameraState}
          cameraFacing={cameraFacing}
          videoRef={videoRef}
          fileInputRef={fileInputRef}
          previewUrl={previewUrl}
          hasResults={hasResults}
          parsedCount={parsedCount}
          barcode={barcode}
          parsedData={parsedData}
          rawText={rawText}
          scanDate={scanDate}
          saveState={saveState}
          onExit={goHome}
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
          onImageUpload={handleImageUpload}
          onStartCamera={startCamera}
          onSwitchCamera={switchCamera}
          onCapturePhoto={capturePhoto}
          onStopCamera={stopCamera}
          onResetScan={resetScan}
          onScanDateChange={setScanDate}
          onSaveScan={saveScan}
          onDownloadPdf={downloadPDF}
        />
      )}

      {view === "summary" && (
        <SummaryView
          adminSections={adminSections}
          labelScans={labelScans}
          adminLoading={adminLoading}
          summaryMessage={summaryMessage}
          summaryStartDate={summaryStartDate}
          onRefreshSummary={loadSummaryData}
          onSaveScan={saveSummaryScan}
          onDeleteScan={removeSummaryScan}
        />
      )}

      {view === "admin" && (
        <AdminView
          session={session}
          isAdmin={isAdmin}
          authMode={authMode}
          authForm={authForm}
          authLoading={authLoading}
          authError={authError}
          adminSections={adminSections}
          adminLoading={adminLoading}
          sectionForm={sectionForm}
          editingSectionId={editingSectionId}
          adminMessage={adminMessage}
          onSignOut={signOut}
          onAuthModeChange={setAuthMode}
          onAuthFormChange={(key, value) => setAuthForm((prev) => ({ ...prev, [key]: value }))}
          onAuthSubmit={handleAuthSubmit}
          onSectionFormChange={(key, value) => setSectionForm((prev) => ({ ...prev, [key]: value }))}
          onSectionSubmit={saveSection}
          onEditSection={editSection}
          onDeleteSection={removeSection}
          onCancelEditSection={cancelEditSection}
          onRefreshAdmin={loadAdminData}
        />
      )}

      <SectionConfirmModal section={pendingSection} onConfirm={confirmSection} onCancel={() => setPendingSection(null)} />
    </div>
  );
}

export default App;
