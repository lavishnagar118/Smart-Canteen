import { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Edit3,
  Eye,
  KeyRound,
  Mail,
  Phone,
  Plus,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  UserCheck,
  Users,
  UserX,
  X,
} from "lucide-react";
import AdminPageState from "../../components/admin/AdminPageState";
import ErrorMessage from "../../components/ErrorMessage";
import { getCanteens } from "../../services/canteenService";
import {
  createStaffMember,
  getStaffMembers,
  resetStaffPassword,
  updateStaffMember,
  updateStaffStatus,
} from "../../services/staffService";

const initialCreateForm = {
  name: "",
  email: "",
  phone: "",
  canteenId: "",
  password: "",
  confirmPassword: "",
};

export default function StaffManagement() {
  const [staff, setStaff] = useState([]);
  const [metrics, setMetrics] = useState({
    totalStaff: 0,
    activeStaff: 0,
    inactiveStaff: 0,
  });
  const [canteens, setCanteens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [viewingStaff, setViewingStaff] = useState(null);
  const [resettingStaff, setResettingStaff] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    canteenId: "",
    status: "ACTIVE",
  });
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });

  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [busyActionId, setBusyActionId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [staffRes, canteensRes] = await Promise.all([
        getStaffMembers(),
        getCanteens(),
      ]);
      setStaff(staffRes.data.data?.staff || []);
      setMetrics(
        staffRes.data.data?.metrics || {
          totalStaff: 0,
          activeStaff: 0,
          inactiveStaff: 0,
        }
      );
      setCanteens(canteensRes.data.data?.canteens || []);
    } catch (err) {
      setError(err.message || "Failed to load staff information");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Temporary toast / banner auto-hide
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const handleOpenAddModal = () => {
    setCreateForm(initialCreateForm);
    setModalError("");
    setShowAddModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setModalError("");

    if (!createForm.name.trim()) {
      setModalError("Staff name is required.");
      return;
    }
    if (!createForm.email.trim()) {
      setModalError("Staff email is required.");
      return;
    }
    if (createForm.password.length < 8) {
      setModalError("Password must be at least 8 characters long.");
      return;
    }
    if (createForm.password !== createForm.confirmPassword) {
      setModalError("Passwords do not match.");
      return;
    }

    setModalSubmitting(true);
    try {
      const payload = {
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        phone: createForm.phone.trim() || undefined,
        canteenId: createForm.canteenId || undefined,
        password: createForm.password,
        confirmPassword: createForm.confirmPassword,
      };
      const response = await createStaffMember(payload);
      const newStaff = response.data.data?.staff;
      setShowAddModal(false);
      setSuccessMessage(
        `Staff member "${newStaff?.name}" (${newStaff?.staffId}) created successfully.`
      );
      loadData();
    } catch (err) {
      setModalError(err.message || "Failed to create staff member.");
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleOpenEdit = (member) => {
    setEditingStaff(member);
    setEditForm({
      name: member.name || "",
      phone: member.phone || "",
      canteenId: member.canteen?._id || member.canteen || "",
      status: member.status || "ACTIVE",
    });
    setModalError("");
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingStaff) return;
    setModalError("");

    if (!editForm.name.trim()) {
      setModalError("Name cannot be empty.");
      return;
    }

    setModalSubmitting(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || undefined,
        canteenId: editForm.canteenId || null,
        status: editForm.status,
      };
      await updateStaffMember(editingStaff._id, payload);
      setEditingStaff(null);
      setSuccessMessage(`Staff "${editForm.name}" updated successfully.`);
      loadData();
    } catch (err) {
      setModalError(err.message || "Failed to update staff member.");
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleToggleStatus = async (member) => {
    const nextStatus = member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const promptMsg =
      nextStatus === "INACTIVE"
        ? `Deactivating ${member.name} (${member.staffId}) will revoke their kitchen access and terminate all active sessions immediately. Proceed?`
        : `Reactivate ${member.name} (${member.staffId})?`;

    if (!window.confirm(promptMsg)) return;

    setBusyActionId(member._id);
    try {
      await updateStaffStatus(member._id, nextStatus);
      setSuccessMessage(
        `Staff "${member.name}" is now ${nextStatus.toLowerCase()}.`
      );
      loadData();
    } catch (err) {
      setError(err.message || "Failed to update status.");
    } finally {
      setBusyActionId("");
    }
  };

  const handleOpenResetPassword = (member) => {
    setResettingStaff(member);
    setPasswordForm({ password: "", confirmPassword: "" });
    setModalError("");
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resettingStaff) return;
    setModalError("");

    if (passwordForm.password.length < 8) {
      setModalError("Password must be at least 8 characters long.");
      return;
    }
    if (passwordForm.password !== passwordForm.confirmPassword) {
      setModalError("Passwords do not match.");
      return;
    }

    setModalSubmitting(true);
    try {
      await resetStaffPassword(
        resettingStaff._id,
        passwordForm.password,
        passwordForm.confirmPassword
      );
      setResettingStaff(null);
      setSuccessMessage(
        `Password for ${resettingStaff.name} has been reset securely. Existing sessions were revoked.`
      );
    } catch (err) {
      setModalError(err.message || "Failed to reset password.");
    } finally {
      setModalSubmitting(false);
    }
  };

  // Filter staff by search and status
  const filteredStaff = staff.filter((member) => {
    const matchesStatus =
      statusFilter === "ALL" ? true : member.status === statusFilter;
    const query = search.trim().toLowerCase();
    if (!query) return matchesStatus;

    const matchesSearch =
      member.name?.toLowerCase().includes(query) ||
      member.email?.toLowerCase().includes(query) ||
      member.staffId?.toLowerCase().includes(query) ||
      member.phone?.toLowerCase().includes(query) ||
      member.canteen?.name?.toLowerCase().includes(query);

    return matchesStatus && matchesSearch;
  });

  return (
    <div>
      {/* Top Section */}
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">Staff Management</p>
          <h2 className="admin-title">Operations Staff</h2>
          <p className="admin-subtitle">
            Manage kitchen and operations staff.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="button-secondary"
            aria-label="Refresh staff list"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="button-primary"
          >
            <Plus size={17} /> Add Staff
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={17} className="text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage("")}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="kpi-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="kpi-label">Total Staff</p>
              <p className="kpi-value">{metrics.totalStaff}</p>
            </div>
            <span className="kpi-icon kpi-blue">
              <Users size={19} />
            </span>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-400">
            All registered kitchen operators
          </p>
        </div>

        <div className="kpi-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="kpi-label">Active Staff</p>
              <p className="kpi-value">{metrics.activeStaff}</p>
            </div>
            <span className="kpi-icon kpi-emerald">
              <UserCheck size={19} />
            </span>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-400">
            Currently authorized for shifts
          </p>
        </div>

        <div className="kpi-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="kpi-label">Inactive Staff</p>
              <p className="kpi-value">{metrics.inactiveStaff}</p>
            </div>
            <span className="kpi-icon kpi-slate">
              <UserX size={19} />
            </span>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-400">
            Deactivated / Suspended access
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search by name, ID, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-10 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <span>Status:</span>
          {["ALL", "ACTIVE", "INACTIVE"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-lg px-3 py-1.5 transition ${
                statusFilter === status
                  ? "bg-slate-900 text-white font-black"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Main Section: Responsive Desktop Table & Mobile Cards */}
      <div className="mt-6">
        <AdminPageState
          loading={loading}
          error={error}
          empty={!filteredStaff.length}
          onRetry={loadData}
        >
          {/* Mobile Cards (hidden on desktop) */}
          <div className="space-y-3 lg:hidden">
            {filteredStaff.map((member) => (
              <StaffCard
                key={member._id}
                member={member}
                busyActionId={busyActionId}
                onView={setViewingStaff}
                onEdit={handleOpenEdit}
                onToggleStatus={handleToggleStatus}
                onResetPassword={handleOpenResetPassword}
              />
            ))}
          </div>

          {/* Desktop Table (hidden on mobile) */}
          <div className="admin-table-wrap hidden lg:block">
            <table className="admin-table">
              <thead>
                <tr>
                  {[
                    "Staff ID",
                    "Staff Name",
                    "Email",
                    "Phone",
                    "Assigned Canteen",
                    "Status",
                    "Created Date",
                    "Actions",
                  ].map((heading) => (
                    <th key={heading}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((member) => {
                  const isActive = member.status === "ACTIVE";
                  const isBusy = busyActionId === member._id;
                  const createdDate = member.createdAt
                    ? new Date(member.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—";

                  return (
                    <tr key={member._id}>
                      <td className="font-mono font-black text-teal-800">
                        {member.staffId || "—"}
                      </td>
                      <td className="font-bold text-slate-900">
                        {member.name}
                      </td>
                      <td className="text-slate-600">{member.email}</td>
                      <td className="text-slate-600 font-mono text-xs">
                        {member.phone || "—"}
                      </td>
                      <td>
                        {member.canteen ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                            <Store size={14} className="text-teal-600" />
                            {member.canteen.name || "Assigned Canteen"}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            All Canteens
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`status-badge ${
                            isActive
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {member.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-500">
                        {createdDate}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingStaff(member)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            title="View safe details"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(member)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            title="Edit staff member"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleToggleStatus(member)}
                            className={`rounded-lg p-1.5 transition ${
                              isActive
                                ? "text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                                : "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                            }`}
                            title={
                              isActive ? "Deactivate staff" : "Activate staff"
                            }
                          >
                            <Power size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenResetPassword(member)}
                            className="rounded-lg p-1.5 text-teal-600 hover:bg-teal-50 hover:text-teal-800"
                            title="Reset password safely"
                          >
                            <KeyRound size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AdminPageState>
      </div>

      {/* Modal: Add Staff */}
      {showAddModal && (
        <ModalBackdrop onClose={() => setShowAddModal(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="admin-kicker">Account Provisioning</p>
                <h3 className="text-xl font-black text-slate-900">
                  Add Operations Staff
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="icon-button text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-bold text-slate-800">
                  Staff Name *
                  <input
                    required
                    type="text"
                    placeholder="e.g. Gordon Ramsay"
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, name: e.target.value })
                    }
                    className="field mt-1"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-800">
                  Staff Email *
                  <input
                    required
                    type="email"
                    placeholder="staff.name@smartcanteen.local"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, email: e.target.value })
                    }
                    className="field mt-1"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-bold text-slate-800">
                  Phone Number
                  <input
                    type="tel"
                    placeholder="+919876543210"
                    value={createForm.phone}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, phone: e.target.value })
                    }
                    className="field mt-1"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-800">
                  Assigned Canteen
                  <select
                    value={createForm.canteenId}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        canteenId: e.target.value,
                      })
                    }
                    className="field mt-1"
                  >
                    <option value="">All Canteens / Floating</option>
                    {canteens.map((c) => (
                      <option key={c.id || c._id} value={c.id || c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-bold text-slate-800">
                  Initial Password *
                  <input
                    required
                    minLength={8}
                    type="password"
                    placeholder="••••••••••••"
                    value={createForm.password}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, password: e.target.value })
                    }
                    className="field mt-1"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-800">
                  Confirm Password *
                  <input
                    required
                    minLength={8}
                    type="password"
                    placeholder="••••••••••••"
                    value={createForm.confirmPassword}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        confirmPassword: e.target.value,
                      })
                    }
                    className="field mt-1"
                  />
                </label>
              </div>

              {/* Security notice & automatic staff ID preview */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 text-xs text-slate-600">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <ShieldCheck size={15} className="text-teal-600" />
                  <span>Backend Authority & Security Guarantees</span>
                </div>
                <ul className="mt-2 list-disc pl-4 space-y-1 text-slate-500">
                  <li>
                    Role is strictly enforced as <b>STAFF</b> by the server.
                  </li>
                  <li>
                    A unique human-friendly <b>Staff ID</b> (e.g. STF-0002) is
                    generated automatically.
                  </li>
                  <li>
                    Password is hashed with bcrypt (12 rounds) and never
                    accessible in plaintext.
                  </li>
                </ul>
              </div>

              {modalError && <ErrorMessage message={modalError} />}

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="button-secondary"
                  disabled={modalSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="button-primary"
                >
                  {modalSubmitting ? "Creating..." : "Create Staff Account"}
                </button>
              </div>
            </form>
          </div>
        </ModalBackdrop>
      )}

      {/* Modal: Edit Staff */}
      {editingStaff && (
        <ModalBackdrop onClose={() => setEditingStaff(null)}>
          <div className="p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="admin-kicker">Staff Information</p>
                <h3 className="text-xl font-black text-slate-900">
                  Edit Staff: {editingStaff.staffId || editingStaff.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="icon-button text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-5 space-y-4">
              <label className="block text-sm font-bold text-slate-800">
                Staff Name *
                <input
                  required
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className="field mt-1"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-bold text-slate-800">
                  Phone Number
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm({ ...editForm, phone: e.target.value })
                    }
                    className="field mt-1"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-800">
                  Assigned Canteen
                  <select
                    value={editForm.canteenId}
                    onChange={(e) =>
                      setEditForm({ ...editForm, canteenId: e.target.value })
                    }
                    className="field mt-1"
                  >
                    <option value="">All Canteens / Floating</option>
                    {canteens.map((c) => (
                      <option key={c.id || c._id} value={c.id || c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-sm font-bold text-slate-800">
                Status
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm({ ...editForm, status: e.target.value })
                  }
                  className="field mt-1"
                >
                  <option value="ACTIVE">ACTIVE (Authorized)</option>
                  <option value="INACTIVE">INACTIVE (Revoked / Suspended)</option>
                </select>
              </label>

              {modalError && <ErrorMessage message={modalError} />}

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="button-secondary"
                  disabled={modalSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="button-primary"
                >
                  {modalSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </ModalBackdrop>
      )}

      {/* Modal: View Safe Details */}
      {viewingStaff && (
        <ModalBackdrop onClose={() => setViewingStaff(null)}>
          <div className="p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="admin-kicker">Operator Profile</p>
                <h3 className="text-xl font-black text-slate-900">
                  Staff Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingStaff(null)}
                className="icon-button text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <span className="font-semibold text-slate-500">Staff ID</span>
                <span className="font-mono font-black text-teal-800">
                  {viewingStaff.staffId || "—"}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <span className="font-semibold text-slate-500">Full Name</span>
                <span className="font-bold text-slate-900">
                  {viewingStaff.name}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <span className="font-semibold text-slate-500">Email</span>
                <span className="font-medium text-slate-800">
                  {viewingStaff.email}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <span className="font-semibold text-slate-500">Phone</span>
                <span className="font-mono text-slate-800">
                  {viewingStaff.phone || "Not configured"}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <span className="font-semibold text-slate-500">Role</span>
                <span className="font-black text-slate-900">
                  {viewingStaff.role}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <span className="font-semibold text-slate-500">Status</span>
                <span
                  className={`status-badge ${
                    viewingStaff.status === "ACTIVE"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {viewingStaff.status}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <span className="font-semibold text-slate-500">
                  Assigned Canteen
                </span>
                <span className="font-semibold text-slate-800">
                  {viewingStaff.canteen?.name || "All Canteens / Floating"}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <span className="font-semibold text-slate-500">
                  Member Since
                </span>
                <span className="text-slate-700">
                  {viewingStaff.createdAt
                    ? new Date(viewingStaff.createdAt).toLocaleString("en-IN")
                    : "—"}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingStaff(null)}
                className="button-primary"
              >
                Done
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* Modal: Safe Reset Password */}
      {resettingStaff && (
        <ModalBackdrop onClose={() => setResettingStaff(null)}>
          <div className="p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="admin-kicker">Security Credential Reset</p>
                <h3 className="text-xl font-black text-slate-900">
                  Reset Password
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResettingStaff(null)}
                className="icon-button text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="mt-5 space-y-4">
              <p className="text-xs text-slate-600">
                Enter a new secure password for{" "}
                <b>
                  {resettingStaff.name} ({resettingStaff.staffId})
                </b>
                . Existing sessions will be terminated upon reset.
              </p>

              <label className="block text-sm font-bold text-slate-800">
                New Password *
                <input
                  required
                  minLength={8}
                  type="password"
                  placeholder="••••••••••••"
                  value={passwordForm.password}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      password: e.target.value,
                    })
                  }
                  className="field mt-1"
                />
              </label>

              <label className="block text-sm font-bold text-slate-800">
                Confirm New Password *
                <input
                  required
                  minLength={8}
                  type="password"
                  placeholder="••••••••••••"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="field mt-1"
                />
              </label>

              {modalError && <ErrorMessage message={modalError} />}

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setResettingStaff(null)}
                  className="button-secondary"
                  disabled={modalSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="button-primary bg-teal-700 hover:bg-teal-800"
                >
                  {modalSubmitting ? "Resetting..." : "Confirm Password Reset"}
                </button>
              </div>
            </form>
          </div>
        </ModalBackdrop>
      )}
    </div>
  );
}

function StaffCard({
  member,
  busyActionId,
  onView,
  onEdit,
  onToggleStatus,
  onResetPassword,
}) {
  const isActive = member.status === "ACTIVE";
  const isBusy = busyActionId === member._id;

  return (
    <div className="admin-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="font-mono text-xs font-black text-teal-800">
            {member.staffId || "—"}
          </span>
          <h4 className="mt-0.5 font-black text-slate-900 text-base">
            {member.name}
          </h4>
        </div>
        <span
          className={`status-badge ${
            isActive
              ? "bg-emerald-100 text-emerald-800"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {member.status}
        </span>
      </div>

      <div className="mt-3 space-y-1 text-xs text-slate-600">
        <p className="flex items-center gap-2">
          <Mail size={13} className="text-slate-400" />
          <span>{member.email}</span>
        </p>
        {member.phone && (
          <p className="flex items-center gap-2">
            <Phone size={13} className="text-slate-400" />
            <span>{member.phone}</span>
          </p>
        )}
        <p className="flex items-center gap-2">
          <Store size={13} className="text-slate-400" />
          <span>{member.canteen?.name || "All Canteens"}</span>
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => onView(member)}
          className="button-secondary text-xs px-2.5 py-1.5"
        >
          <Eye size={13} /> View
        </button>
        <button
          type="button"
          onClick={() => onEdit(member)}
          className="button-secondary text-xs px-2.5 py-1.5"
        >
          <Edit3 size={13} /> Edit
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onToggleStatus(member)}
          className={`button-secondary text-xs px-2.5 py-1.5 ${
            isActive ? "text-amber-600" : "text-emerald-600"
          }`}
        >
          <Power size={13} /> {isActive ? "Deactivate" : "Activate"}
        </button>
        <button
          type="button"
          onClick={() => onResetPassword(member)}
          className="button-secondary text-xs px-2.5 py-1.5 text-teal-700"
        >
          <KeyRound size={13} /> Reset Pass
        </button>
      </div>
    </div>
  );
}

function ModalBackdrop({ onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
