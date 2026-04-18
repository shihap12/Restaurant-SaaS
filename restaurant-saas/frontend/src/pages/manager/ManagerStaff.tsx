import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, UserCheck, Edit2, X, Save, Loader2 } from "lucide-react";
import { usePageTransition } from "@/hooks/useGSAP";
import { userApi } from "@/api";
import { useAuthStore, useBranchStore } from "@/store";
import type { User } from "@/types";
import toast from "react-hot-toast";

type StaffForm = {
  name: string;
  email: string;
  password: string;
  role: "manager" | "cashier" | "chef";
  phone: string;
  is_active: boolean;
};

function StaffModal({
  member,
  branchId,
  restaurantId,
  onClose,
}: {
  member?: User;
  branchId: number;
  restaurantId: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<StaffForm>({
    name: member?.name || "",
    email: member?.email || "",
    password: "",
    role: (member?.role as any) || "cashier",
    phone: member?.phone || "",
    is_active: member?.is_active ?? true,
  });
  const set = (k: keyof StaffForm, v: unknown) =>
    setForm((p) => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
        phone: form.phone || null,
        is_active: form.is_active,
        branch_id: branchId,
        restaurant_id: restaurantId,
      };
      if (form.password) payload.password = form.password;
      return member
        ? userApi.update(member.id, payload)
        : userApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff", branchId] });
      toast.success(member ? "Staff updated!" : "Staff member added!");
      onClose();
    },
    onError: () => toast.error("Failed to save staff member"),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-4"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2
            className="text-lg font-display font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {member ? "Edit Staff Member" : "Add Staff Member"}
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Full Name *</label>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="input"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="label">Role *</label>
              <select
                value={form.role}
                onChange={(e) => set("role", e.target.value as any)}
                className="input"
              >
                <option value="cashier">Cashier</option>
                <option value="chef">Chef</option>
                <option value="manager">Manager</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className="input"
              placeholder="staff@example.com"
            />
          </div>
          <div>
            <label className="label">
              {member ? "New Password (leave blank to keep)" : "Password *"}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              className="input"
              placeholder="+1 234 567 8900"
            />
          </div>
          <div
            className="flex items-center justify-between p-3 rounded-xl"
            style={{ background: "var(--surface-3)" }}
          >
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>
              Active
            </span>
            <button
              onClick={() => set("is_active", !form.is_active)}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.is_active ? "bg-green-500" : "bg-[var(--surface-4)]"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_active ? "translate-x-5" : ""}`}
              />
            </button>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={
              !form.name ||
              !form.email ||
              (!member && !form.password) ||
              mutation.isPending
            }
            className="btn btn-primary flex-1 gap-2"
          >
            {mutation.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}
            {member ? "Update" : "Add Staff"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManagerStaff() {
  const pageRef = useRef<HTMLDivElement>(null);
  usePageTransition(pageRef as any);
  const { user } = useAuthStore();
  const { currentBranch } = useBranchStore();
  const branchId = currentBranch?.id || user?.branch_id || 1;
  const restaurantId = user?.restaurant_id || 1;
  const [modalMember, setModalMember] = useState<User | null | "new">(null);

  const { data: usersData = [] } = useQuery({
    queryKey: ["staff", branchId],
    queryFn: () => userApi.getAll({ branch_id: branchId }),
    select: (res) => {
      const raw = res.data.data;
      return (Array.isArray(raw) ? raw : (raw?.data ?? [])) as User[];
    },
  });
  const staff = (usersData as User[]).filter((u) =>
    ["cashier", "chef", "manager"].includes(u.role),
  );

  return (
    <>
      <div ref={pageRef} className="space-y-5">
        <div className="flex items-center justify-between">
          <h1
            className="text-2xl font-display font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Staff
          </h1>
          <button
            onClick={() => setModalMember("new")}
            className="btn btn-primary btn-sm gap-1.5"
          >
            <Plus size={15} /> Add Staff
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((member) => (
            <div key={member.id} className="card p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="font-semibold truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {member.name}
                </p>
                <p
                  className="text-xs truncate"
                  style={{ color: "var(--text-muted)" }}
                >
                  {member.email}
                </p>
                <span className="badge badge-brand mt-1 capitalize text-xs">
                  {member.role}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 items-center">
                <button
                  onClick={() => setModalMember(member)}
                  className="btn btn-ghost btn-sm btn-icon"
                >
                  <Edit2 size={14} />
                </button>
                <div
                  className={`w-2 h-2 rounded-full ${member.is_active ? "bg-green-400" : "bg-gray-600"}`}
                />
              </div>
            </div>
          ))}
          {staff.length === 0 && (
            <div className="col-span-full card p-10 text-center">
              <UserCheck
                size={32}
                className="mx-auto mb-3"
                style={{ color: "var(--text-muted)" }}
              />
              <p style={{ color: "var(--text-muted)" }}>
                No staff members found for this branch.
              </p>
            </div>
          )}
        </div>
      </div>

      {modalMember !== null && (
        <StaffModal
          member={modalMember === "new" ? undefined : modalMember}
          branchId={branchId}
          restaurantId={restaurantId}
          onClose={() => setModalMember(null)}
        />
      )}
    </>
  );
}
