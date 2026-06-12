import { LogIn, LogOut, Pencil, Plus, RefreshCw, Save, Shield, X } from "lucide-react";
import Alert from "../components/Alert";
import { SCAN_TABLE_HEADERS } from "../constants/labelFields";
import { formatDateOnly, getScanDate } from "../lib/format";

export default function AdminView({
  session,
  isAdmin,
  authMode,
  authForm,
  authLoading,
  authError,
  adminSections,
  labelScans,
  adminLoading,
  sectionForm,
  editingSectionId,
  adminMessage,
  onSignOut,
  onAuthModeChange,
  onAuthFormChange,
  onAuthSubmit,
  onSectionFormChange,
  onSectionSubmit,
  onEditSection,
  onCancelEditSection,
  onRefreshAdmin,
}) {
  return (
    <main className="page-stack">
      <section className="admin-heading">
        <div>
          <span className="eyebrow">
            <Shield size={16} /> Admin
          </span>
          <h1>Company label database</h1>
          <p>Manage sections and review every saved label scan.</p>
        </div>
        {session && (
          <button type="button" className="btn btn--outline" onClick={onSignOut}>
            <LogOut size={16} /> Logout
          </button>
        )}
      </section>

      {!session || !isAdmin ? (
        <section className="auth-panel">
          <div className="auth-tabs">
            <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => onAuthModeChange("login")}>
              Login
            </button>
            <button type="button" className={authMode === "signup" ? "active" : ""} onClick={() => onAuthModeChange("signup")}>
              Sign up
            </button>
          </div>

          {authError && <Alert>{authError}</Alert>}

          <form className="form-grid" onSubmit={onAuthSubmit}>
            <label>
              Email
              <input type="email" value={authForm.email} onChange={(event) => onAuthFormChange("email", event.target.value)} required />
            </label>
            <label>
              Password
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => onAuthFormChange("password", event.target.value)}
                required
                minLength={6}
              />
            </label>
            {authMode === "signup" && (
              <>
                <label>
                  Confirm password
                  <input
                    type="password"
                    value={authForm.confirmPassword}
                    onChange={(event) => onAuthFormChange("confirmPassword", event.target.value)}
                    required
                    minLength={6}
                  />
                </label>
                <label>
                  Admin code
                  <input type="password" value={authForm.adminCode} onChange={(event) => onAuthFormChange("adminCode", event.target.value)} required />
                </label>
              </>
            )}
            <button type="submit" className="btn btn--primary" disabled={authLoading}>
              <LogIn size={18} /> {authLoading ? "Please wait..." : authMode === "login" ? "Login" : "Create admin"}
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="admin-layout">
            <form className="admin-card section-form" onSubmit={onSectionSubmit}>
              <div className="panel-title">
                <h2>{editingSectionId ? "Edit section" : "Create section"}</h2>
                {editingSectionId && (
                  <button type="button" className="btn btn--ghost" onClick={onCancelEditSection}>
                    <X size={16} /> Cancel
                  </button>
                )}
              </div>
              {adminMessage && <Alert type={adminMessage.includes("created") || adminMessage.includes("updated") ? "success" : "error"}>{adminMessage}</Alert>}
              <label>
                Section name
                <input value={sectionForm.name} onChange={(event) => onSectionFormChange("name", event.target.value)} required />
              </label>
              <label>
                Description
                <textarea value={sectionForm.description} onChange={(event) => onSectionFormChange("description", event.target.value)} rows={3} />
              </label>
              <label>
                Sort order
                <input type="number" value={sectionForm.sort_order} onChange={(event) => onSectionFormChange("sort_order", event.target.value)} />
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={sectionForm.is_active} onChange={(event) => onSectionFormChange("is_active", event.target.checked)} />
                Active section
              </label>
              <button type="submit" className="btn btn--green" disabled={adminLoading}>
                {editingSectionId ? <Save size={18} /> : <Plus size={18} />}
                {editingSectionId ? "Update section" : "Create section"}
              </button>
            </form>

            <section className="admin-card">
              <div className="panel-title">
                <h2>Sections</h2>
                <button type="button" className="btn btn--ghost" onClick={onRefreshAdmin}>
                  <RefreshCw size={16} /> Refresh
                </button>
              </div>
              <div className="section-list">
                {adminSections.map((section) => (
                  <div className="section-row" key={section.id}>
                    <div>
                      <strong>{section.name}</strong>
                      <span>{section.description || "No description"}</span>
                    </div>
                    <span className={`status-pill ${section.is_active ? "status-pill--active" : ""}`}>
                      {section.is_active ? "Active" : "Hidden"}
                    </span>
                    <button type="button" className="icon-button" onClick={() => onEditSection(section)} aria-label={`Edit ${section.name}`}>
                      <Pencil size={16} />
                    </button>
                  </div>
                ))}
                {!adminSections.length && <div className="empty-state empty-state--small">No sections yet.</div>}
              </div>
            </section>
          </section>

          <section className="admin-card table-card">
            <div className="panel-title">
              <div>
                <h2>Saved label details</h2>
                <p>{labelScans.length} latest records</p>
              </div>
              <button type="button" className="btn btn--ghost" onClick={onRefreshAdmin}>
                <RefreshCw size={16} /> Refresh
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {SCAN_TABLE_HEADERS.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {labelScans.map((scan) => (
                    <tr key={scan.id}>
                      <td>{formatDateOnly(getScanDate(scan))}</td>
                      <td>{scan.section?.name || "-"}</td>
                      <td>{scan.barcode || "-"}</td>
                      <td>{scan.sew || "-"}</td>
                      <td>{scan.cut || "-"}</td>
                      <td>{scan.so || "-"}</td>
                      <td>{scan.li || "-"}</td>
                      <td>{scan.item || "-"}</td>
                      <td>{scan.size || "-"}</td>
                      <td>{scan.line_num || "-"}</td>
                      <td>{scan.bin || "-"}</td>
                    </tr>
                  ))}
                  {!labelScans.length && (
                    <tr>
                      <td colSpan={SCAN_TABLE_HEADERS.length}>No saved labels yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
