import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  Loader,
  Eye,
  EyeOff,
} from "lucide-react";
import { usePageTransition } from "@/hooks/useGSAP";
import api, { userApi, branchApi } from "@/api";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import type { User, Branch } from "@/types";

// ─── Types ───────────────────────────────────
interface UserForm {
  name: string;
  email: string;
  password: string;
  role: string;
  restaurant_id: string | number;
  branch_id: string | number;
  phone: string;
  is_active: boolean;
}

const ROLE_BADGE: Record<string, string> = {
  super_admin: "badge-danger",
  owner: "badge-brand",
  manager: "badge-warning",
  cashier: "badge-success",
  chef: "badge-neutral",
  customer: "badge-neutral",
};

const ROLES = ["owner", "manager", "cashier", "chef", "customer"];

// ─── Modal ───────────────────────────────────
function UserModal({
  user,
  branches,
  onClose,
  onSave,
}: {
  user?: User | null;
  branches: Branch[];
  onClose: () => void;
  onSave: (data: Partial<UserForm>) => void;
}) {
  const isEdit = !!user;
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState<UserForm>({
    name: user?.name ?? "",
    email: user?.email ?? "",
    password: "",
    role: user?.role ?? "cashier",
    restaurant_id: (user as any)?.restaurant_id ?? "",
    branch_id: user?.branch_id ?? "",
    phone: user?.phone ?? "",
    is_active: user?.is_active ?? true,
  });

  const set = (k: keyof UserForm, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...form };
    // تعديل: ما نبعت password فاضي
    if (isEdit && !payload.password) delete payload.password;
    onSave(payload);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pt-80 p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h2
            className="font-display font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {isEdit ? "Edit User" : "New User"}
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-icon">
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 max-h-[75vh] overflow-y-auto"
        >
          {/* Name */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Full Name *
            </label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="input"
              placeholder="Ahmad Al-Rashid"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Email *
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className="input"
              placeholder="ahmad@example.com"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Password{" "}
              {isEdit && (
                <span
                  className="font-normal text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  (leave blank to keep current)
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                className="input pr-10"
                placeholder={isEdit ? "••••••••" : "Min 8 characters"}
                {...(!isEdit && { required: true, minLength: 8 })}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Role + Branch */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Role *
              </label>
              <select
                value={form.role}
                onChange={(e) => set("role", e.target.value)}
                className="input"
                required
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Branch
              </label>
              <select
                value={form.branch_id}
                onChange={(e) => set("branch_id", e.target.value)}
                className="input"
              >
                <option value="">No branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {(b as any).restaurant_name
                      ? `${(b as any).restaurant_name} — `
                      : ""}
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Phone */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Phone
            </label>
            <input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              className="input"
              placeholder="+966 5x xxx xxxx"
            />
          </div>

          {/* Active toggle (edit only) */}
          {isEdit && (
            <div
              className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: "var(--surface-3)" }}
            >
              <span
                className="text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                Active
              </span>
              <button
                type="button"
                onClick={() => set("is_active", !form.is_active)}
                className={`w-11 h-6 rounded-full transition-colors relative ${form.is_active ? "bg-green-500" : "bg-[var(--border)]"}`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.is_active ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </button>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary flex-1">
              {isEdit ? "Save Changes" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────
export default function AdminUsers() {
  const pageRef = useRef<HTMLDivElement>(null);
  usePageTransition(pageRef as any);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [roleFilter, setRole] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<User | null>(null);

  // ── Queries ──────────────────────────────
  const { data: usersData, isLoading } = useQuery({
    queryKey: ["admin-users-list", roleFilter],
    queryFn: () =>
      userApi.getAll({ role: roleFilter || undefined, per_page: 100 }),
    select: (res) => {
      const raw: any = res.data.data as any;
      return (Array.isArray(raw) ? raw : (raw?.data ?? [])) as User[];
    },
  });
  const users = usersData ?? [];

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["all-branches"],
    queryFn: () => branchApi.getAll().then((r) => r.data.data as Branch[]),
  });

  // ── Mutations ────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: any) => userApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("User created!");
      setModal(null);
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message ?? "Failed to create user."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      userApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast.success("User updated!");
      setModal(null);
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message ?? "Failed to update user."),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => userApi.toggleStatus(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => userApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("User deleted.");
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message ?? "Failed to delete."),
  });

  // ── Handlers ─────────────────────────────
  const handleSave = (formData: any) => {
    if (modal === "edit" && selected) {
      updateMutation.mutate({ id: selected.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (u: User) => {
    if (!confirm(`Delete "${u.name}"?`)) return;
    deleteMutation.mutate(u.id);
  };

  // ── Filter ───────────────────────────────
  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={pageRef} className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1
          className="text-2xl font-display font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Users
        </h1>
        <button
          onClick={() => setModal("create")}
          className="btn btn-primary btn-sm gap-1.5"
        >
          <Plus size={15} /> New User
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="input pl-9 text-sm"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRole(e.target.value)}
          className="input text-sm w-auto py-2"
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div
            className="p-8 text-center"
            style={{ color: "var(--text-muted)" }}
          >
            <Loader size={24} className="animate-spin mx-auto mb-3" />
            Loading users...
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="p-12 text-center"
            style={{ color: "var(--text-muted)" }}
          >
            {search ? "No users match your search." : "No users yet."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {[
                  "User",
                  "Role",
                  "Branch",
                  "Status",
                  "Last Login",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr
                  key={user.id}
                  style={{ borderBottom: "1px solid var(--border)" }}
                  className="hover:bg-[var(--surface-3)] transition-colors"
                >
                  {/* User */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full brand-gradient flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p
                          className="font-medium"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {user.name}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-5 py-3">
                    <span
                      className={`badge ${ROLE_BADGE[user.role] || "badge-neutral"} capitalize`}
                    >
                      {user.role.replace("_", " ")}
                    </span>
                  </td>

                  {/* Branch */}
                  <td
                    className="px-5 py-3 text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {(user as any).branch_name ??
                      (user.branch_id ? `#${user.branch_id}` : "—")}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3">
                    <span
                      className={`badge ${user.is_active ? "badge-success" : "badge-neutral"}`}
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>

                  {/* Last Login */}
                  <td
                    className="px-5 py-3 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {user.last_login_at
                      ? formatDistanceToNow(new Date(user.last_login_at), {
                          addSuffix: true,
                        })
                      : "Never"}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleMutation.mutate(user.id)}
                        className="btn btn-ghost btn-sm btn-icon"
                        title="Toggle active"
                      >
                        {user.is_active ? (
                          <ToggleRight size={16} className="text-green-400" />
                        ) : (
                          <ToggleLeft size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setSelected(user);
                          setModal("edit");
                        }}
                        className="btn btn-ghost btn-sm btn-icon"
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="btn btn-ghost btn-sm btn-icon hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <UserModal
          user={modal === "edit" ? selected : null}
          branches={branches}
          onClose={() => {
            setModal(null);
            setSelected(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
