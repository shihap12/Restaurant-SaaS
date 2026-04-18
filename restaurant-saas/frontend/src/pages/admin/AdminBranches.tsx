import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Loader,
  ToggleLeft,
  ToggleRight,
  Globe,
} from "lucide-react";
import { usePageTransition } from "@/hooks/useGSAP";
import { branchApi } from "@/api";
import api from "@/api";
import type { Branch } from "@/types";
import toast from "react-hot-toast";

// ─── Types ───────────────────────────────────
interface Restaurant {
  id: number;
  name: string;
  slug: string;
}

interface BranchForm {
  restaurant_id: string | number;
  name: string;
  slug: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  currency_symbol: string;
  timezone: string;
  is_active: boolean;
}

// ─── Modal ───────────────────────────────────
function BranchModal({
  branch,
  restaurants,
  onClose,
  onSave,
}: {
  branch?: Branch | null;
  restaurants: Restaurant[];
  onClose: () => void;
  onSave: (data: Partial<BranchForm>) => void;
}) {
  const isEdit = !!branch;
  const [form, setForm] = useState<BranchForm>({
    restaurant_id: (branch as any)?.restaurant_id ?? "",
    name: branch?.name ?? "",
    slug: branch?.slug ?? "",
    address: branch?.address ?? "",
    phone: branch?.phone ?? "",
    email: branch?.email ?? "",
    currency: branch?.currency ?? "SAR",
    currency_symbol: branch?.currency_symbol ?? "﷼",
    timezone: branch?.timezone ?? "Asia/Riyadh",
    is_active: branch?.is_active ?? true,
  });

  const set = (k: keyof BranchForm, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleNameChange = (val: string) => {
    set("name", val);
    if (!isEdit) {
      // اقترح الـ slug من الاسم
      const restaurantSlug =
        restaurants.find((r) => r.id === Number(form.restaurant_id))?.slug ??
        "";
      const nameSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      set("slug", restaurantSlug ? `${restaurantSlug}-${nameSlug}` : nameSlug);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pt-80 p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg overflow-hidden"
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
            {isEdit ? "Edit Branch" : "New Branch"}
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-icon">
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 max-h-[75vh] overflow-y-auto"
        >
          {/* Restaurant */}
          {!isEdit && (
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Restaurant *
              </label>
              <select
                value={form.restaurant_id}
                onChange={(e) => set("restaurant_id", e.target.value)}
                className="input"
                required
              >
                <option value="">Select restaurant...</option>
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Name */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Branch Name *
            </label>
            <input
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="input"
              placeholder="e.g. Main Branch - Riyadh"
              required
            />
          </div>

          {/* Slug */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              URL Slug *{" "}
              <span
                className="font-normal text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                (رابط الفرع الخاص)
              </span>
            </label>
            <div className="flex items-center">
              <span
                className="px-3 py-2 text-sm rounded-l-xl border-r-0 flex-shrink-0"
                style={{
                  background: "var(--surface-3)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                /
              </span>
              <input
                value={form.slug}
                onChange={(e) =>
                  set(
                    "slug",
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                  )
                }
                className="input rounded-l-none"
                placeholder="restaurant-branch-city"
                required
              />
            </div>
            {form.slug && (
              <p
                className="text-xs mt-1 flex items-center gap-1"
                style={{ color: "var(--text-muted)" }}
              >
                <Globe size={11} />
                {window.location.origin}/{form.slug}
              </p>
            )}
          </div>

          {/* Address */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Address *
            </label>
            <input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              className="input"
              placeholder="King Fahd Road, Riyadh"
              required
            />
          </div>

          {/* Phone + Email */}
          <div className="grid grid-cols-2 gap-3">
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
                placeholder="+966 1x xxx xxxx"
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className="input"
                placeholder="branch@restaurant.com"
              />
            </div>
          </div>

          {/* Currency + Timezone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Currency
              </label>
              <select
                value={form.currency}
                onChange={(e) => {
                  const map: Record<string, string> = {
                    SAR: "﷼",
                    USD: "$",
                    EUR: "€",
                    AED: "د.إ",
                    KWD: "د.ك",
                  };
                  set("currency", e.target.value);
                  set("currency_symbol", map[e.target.value] ?? e.target.value);
                }}
                className="input"
              >
                {[
                  ["SAR", "﷼ Saudi Riyal"],
                  ["USD", "$ US Dollar"],
                  ["AED", "د.إ UAE Dirham"],
                  ["KWD", "د.ك Kuwaiti Dinar"],
                  ["EUR", "€ Euro"],
                ].map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Timezone
              </label>
              <select
                value={form.timezone}
                onChange={(e) => set("timezone", e.target.value)}
                className="input"
              >
                {[
                  ["Asia/Riyadh", "Riyadh (AST)"],
                  ["Asia/Dubai", "Dubai (GST)"],
                  ["Asia/Kuwait", "Kuwait (AST)"],
                  ["Africa/Cairo", "Cairo (EET)"],
                  ["UTC", "UTC"],
                ].map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
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
              {isEdit ? "Save Changes" : "Create Branch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────
export default function AdminBranches() {
  const pageRef = useRef<HTMLDivElement>(null);
  usePageTransition(pageRef as any);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<Branch | null>(null);

  // ── Queries ──────────────────────────────
  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["admin-branches-list"],
    queryFn: () => branchApi.getAll().then((r) => r.data.data as Branch[]),
  });

  const { data: restaurants = [] } = useQuery<Restaurant[]>({
    queryKey: ["restaurants-simple"],
    queryFn: () =>
      api.get("/restaurants").then((r) => r.data.data as Restaurant[]),
  });

  // ── Mutations ────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: any) => branchApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-branches-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("Branch created!");
      setModal(null);
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message ?? "Failed to create branch."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      branchApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-branches-list"] });
      toast.success("Branch updated!");
      setModal(null);
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message ?? "Failed to update branch."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => branchApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-branches-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("Branch deleted.");
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message ?? "Failed to delete."),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => branchApi.toggle(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-branches-list"] }),
  });

  // ── Handlers ─────────────────────────────
  const handleSave = (formData: any) => {
    if (modal === "edit" && selected) {
      updateMutation.mutate({ id: selected.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (b: Branch) => {
    if (!confirm(`Delete "${b.name}"?`)) return;
    deleteMutation.mutate(b.id);
  };

  const filtered = branches.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.address?.toLowerCase().includes(search.toLowerCase()) ||
      (b as any).restaurant_name?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={pageRef} className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1
          className="text-2xl font-display font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Branches
        </h1>
        <button
          onClick={() => setModal("create")}
          className="btn btn-primary btn-sm gap-1.5"
        >
          <Plus size={15} /> New Branch
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--text-muted)" }}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search branches..."
          className="input pl-9 text-sm"
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div
            className="p-8 text-center"
            style={{ color: "var(--text-muted)" }}
          >
            <Loader size={24} className="animate-spin mx-auto mb-3" />
            Loading branches...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Globe
              size={40}
              className="mx-auto mb-3"
              style={{ color: "var(--text-muted)" }}
            />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {search
                ? "No branches match your search."
                : "No branches yet. Create one!"}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {[
                  "Branch",
                  "Restaurant",
                  "Slug / URL",
                  "Currency",
                  "Staff",
                  "Status",
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
              {filtered.map((branch) => (
                <tr
                  key={branch.id}
                  style={{ borderBottom: "1px solid var(--border)" }}
                  className="hover:bg-[var(--surface-3)] transition-colors"
                >
                  {/* Branch name + address */}
                  <td className="px-5 py-3">
                    <p
                      className="font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {branch.name}
                    </p>
                    <p
                      className="text-xs truncate max-w-[180px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {branch.address}
                    </p>
                  </td>

                  {/* Restaurant */}
                  <td
                    className="px-5 py-3 text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {(branch as any).restaurant_name ?? "—"}
                  </td>

                  {/* Slug */}
                  <td className="px-5 py-3">
                    <span
                      className="text-xs font-mono px-2 py-1 rounded-lg"
                      style={{
                        background: "var(--surface-3)",
                        color: "var(--brand-400)",
                      }}
                    >
                      /{branch.slug}
                    </span>
                  </td>

                  {/* Currency */}
                  <td
                    className="px-5 py-3 text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {branch.currency} {branch.currency_symbol}
                  </td>

                  {/* Staff count */}
                  <td
                    className="px-5 py-3 text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {(branch as any).staff_count ?? 0}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3">
                    <span
                      className={`badge ${branch.is_active ? "badge-success" : "badge-neutral"}`}
                    >
                      {branch.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleMutation.mutate(branch.id)}
                        className="btn btn-ghost btn-sm btn-icon"
                        title="Toggle active"
                      >
                        {branch.is_active ? (
                          <ToggleRight size={16} className="text-green-400" />
                        ) : (
                          <ToggleLeft size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setSelected(branch);
                          setModal("edit");
                        }}
                        className="btn btn-ghost btn-sm btn-icon"
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(branch)}
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
        <BranchModal
          branch={modal === "edit" ? selected : null}
          restaurants={restaurants}
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
