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
  Save,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { usePageTransition } from "@/hooks/useGSAP";
import { productApi, categoryApi } from "@/api";
import { useAuthStore, useBranchStore } from "@/store";
import type { Product, Category } from "@/types";
import toast from "react-hot-toast";

// ─── Category Modal ───────────────────────────────────────────
function CategoryModal({
  category,
  branchId,
  restaurantId,
  onClose,
}: {
  category?: Category;
  branchId: number;
  restaurantId: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(category?.name || "");
  const [nameAr, setNameAr] = useState((category as any)?.name_ar || "");

  const mutation = useMutation({
    mutationFn: () => {
      const data = {
        name,
        name_ar: nameAr || null,
        branch_id: branchId,
        restaurant_id: restaurantId,
      };
      return category
        ? categoryApi.update(category.id, data)
        : categoryApi.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manager-categories", branchId] });
      toast.success(category ? "Category updated!" : "Category created!");
      onClose();
    },
    onError: () => toast.error("Failed to save category"),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-4"
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
            {category ? "Edit Category" : "New Category"}
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">Category Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="e.g. Main Dishes"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Arabic Name (optional)</label>
            <input
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              className="input"
              placeholder="e.g. الأطباق الرئيسية"
              dir="rtl"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
            className="btn btn-primary flex-1 gap-2"
          >
            {mutation.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}
            {category ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Product Modal ────────────────────────────────────────────
type ProductForm = {
  name: string;
  description: string;
  price: string;
  category_id: string;
  status: "active" | "inactive" | "out_of_stock";
  is_featured: boolean;
  calories: string;
  preparation_time: string;
};

const defaultForm: ProductForm = {
  name: "",
  description: "",
  price: "",
  category_id: "",
  status: "active",
  is_featured: false,
  calories: "",
  preparation_time: "",
};

function ProductModal({
  product,
  branchId,
  categories,
  restaurantId,
  onClose,
}: {
  product?: Product;
  branchId: number;
  categories: Category[];
  restaurantId: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ProductForm>(
    product
      ? {
          name: product.name,
          description: product.description || "",
          price: String(product.price),
          category_id: product.category_id ? String(product.category_id) : "",
          status: product.status,
          is_featured: product.is_featured,
          calories: product.calories ? String(product.calories) : "",
          preparation_time: product.preparation_time
            ? String(product.preparation_time)
            : "",
        }
      : defaultForm,
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const set = (k: keyof ProductForm, v: unknown) =>
    setForm((p) => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("branch_id", String(branchId));
      fd.append("restaurant_id", String(restaurantId));
      fd.append("name", form.name);
      fd.append("description", form.description);
      fd.append("price", form.price);
      if (form.category_id) fd.append("category_id", form.category_id);
      fd.append("status", form.status);
      fd.append("is_featured", form.is_featured ? "1" : "0");
      if (form.calories) fd.append("calories", form.calories);
      if (form.preparation_time)
        fd.append("preparation_time", form.preparation_time);
      if (imageFile) fd.append("image", imageFile);
      return product
        ? productApi.update(product.id, fd)
        : productApi.create(fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manager-products", branchId] });
      toast.success(product ? "Product updated!" : "Product created!");
      onClose();
    },
    onError: () => toast.error("Failed to save product"),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
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
            {product ? "Edit Product" : "Add Product"}
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">Product Name *</label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="input"
              placeholder="e.g. Grilled Chicken"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="input resize-none"
              rows={3}
              placeholder="Brief description..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Price *</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                className="input"
                placeholder="0.00"
                step="0.01"
              />
            </div>
            <div>
              <label className="label">Category</label>
              <select
                value={form.category_id}
                onChange={(e) => set("category_id", e.target.value)}
                className="input"
              >
                <option value="">No Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Calories</label>
              <input
                type="number"
                value={form.calories}
                onChange={(e) => set("calories", e.target.value)}
                className="input"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="label">Prep Time (min)</label>
              <input
                type="number"
                value={form.preparation_time}
                onChange={(e) => set("preparation_time", e.target.value)}
                className="input"
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value as any)}
              className="input"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </div>
          <div>
            <label className="label">Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="input text-sm"
            />
          </div>
          <div
            className="flex items-center justify-between p-3 rounded-xl"
            style={{ background: "var(--surface-3)" }}
          >
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>
              Featured
            </span>
            <button
              onClick={() => set("is_featured", !form.is_featured)}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.is_featured ? "bg-[var(--brand-500)]" : "bg-[var(--surface-4)]"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_featured ? "translate-x-5" : ""}`}
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
            disabled={!form.name || !form.price || mutation.isPending}
            className="btn btn-primary flex-1 gap-2"
          >
            {mutation.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}
            {product ? "Update" : "Add Product"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function ManagerMenu() {
  const pageRef = useRef<HTMLDivElement>(null);
  usePageTransition(pageRef as any);
  const { user } = useAuthStore();
  const { currentBranch } = useBranchStore();
  const branchId = currentBranch?.id || user?.branch_id || 1;
  const restaurantId = user?.restaurant_id || 1;
  const queryClient = useQueryClient();
  const sym = currentBranch?.currency_symbol || "$";

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<number | "">("");
  const [modalProduct, setModalProduct] = useState<Product | null | "new">(
    null,
  );
  const [modalCategory, setModalCategory] = useState<Category | null | "new">(
    null,
  );

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["manager-products", branchId, search, catFilter],
    queryFn: () =>
      productApi.getAll(branchId, {
        search: search || undefined,
        category_id: catFilter || undefined,
      }),
    select: (res) => res.data.data as Product[],
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["manager-categories", branchId],
    queryFn: () => categoryApi.getAll(branchId),
    select: (res) => res.data.data as Category[],
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => productApi.toggleStatus(id),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["manager-products", branchId],
      }),
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: number) => productApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["manager-products", branchId],
      });
      toast.success("Product deleted.");
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => categoryApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["manager-categories", branchId],
      });
      toast.success("Category deleted.");
    },
    onError: () => toast.error("Failed to delete category"),
  });

  return (
    <>
      <div ref={pageRef} className="space-y-6">
        {/* ─── Categories Section ───────────────────────────── */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FolderOpen size={18} style={{ color: "var(--brand-400)" }} />
              <h2
                className="text-base font-display font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Categories
              </h2>
              <span className="badge badge-neutral text-xs">
                {categories.length}
              </span>
            </div>
            <button
              onClick={() => setModalCategory("new")}
              className="btn btn-secondary btn-sm gap-1.5"
            >
              <Plus size={13} /> New Category
            </button>
          </div>

          {categories.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No categories yet. Add one to organize your menu.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                  style={{
                    background: "var(--surface-3)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {cat.name}
                  </span>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => setModalCategory(cat)}
                      className="btn btn-ghost btn-icon p-1 h-auto w-auto"
                      style={{ minWidth: "unset" }}
                    >
                      <Edit2 size={11} style={{ color: "var(--text-muted)" }} />
                    </button>
                    <button
                      onClick={() => deleteCategoryMutation.mutate(cat.id)}
                      className="btn btn-ghost btn-icon p-1 h-auto w-auto hover:text-red-400"
                      style={{ minWidth: "unset" }}
                    >
                      <Trash2
                        size={11}
                        style={{ color: "var(--text-muted)" }}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Products Section ─────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1
              className="text-2xl font-display font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Menu
            </h1>
            <button
              onClick={() => setModalProduct("new")}
              className="btn btn-primary btn-sm gap-1.5"
            >
              <Plus size={15} /> Add Product
            </button>
          </div>

          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
                className="input pl-9 text-sm"
              />
            </div>
            <select
              value={catFilter}
              onChange={(e) =>
                setCatFilter(e.target.value ? Number(e.target.value) : "")
              }
              className="input text-sm w-auto py-2"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="skeleton h-48 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((product) => (
                <div key={product.id} className="card overflow-hidden">
                  <div
                    className="h-32 relative overflow-hidden"
                    style={{ background: "var(--surface-3)" }}
                  >
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        🍽️
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <span
                        className={`badge text-xs ${
                          product.status === "active"
                            ? "badge-success"
                            : product.status === "out_of_stock"
                              ? "badge-warning"
                              : "badge-neutral"
                        }`}
                      >
                        {product.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <p
                      className="font-semibold text-sm line-clamp-1"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {product.name}
                    </p>
                    {(product as any).category && (
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {(product as any).category.name}
                      </p>
                    )}
                    <p
                      className="text-sm font-bold mt-0.5"
                      style={{ color: "var(--brand-400)" }}
                    >
                      {sym}
                      {Number(product.price).toFixed(2)}
                    </p>
                    <div className="flex gap-1.5 mt-2">
                      <button
                        onClick={() => toggleMutation.mutate(product.id)}
                        className="btn btn-secondary btn-sm flex-1 text-xs gap-1"
                      >
                        {product.status === "active" ? (
                          <ToggleRight size={12} className="text-green-400" />
                        ) : (
                          <ToggleLeft size={12} />
                        )}
                        {product.status === "active" ? "Active" : "Off"}
                      </button>
                      <button
                        onClick={() => setModalProduct(product)}
                        className="btn btn-ghost btn-sm btn-icon"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => deleteProductMutation.mutate(product.id)}
                        className="btn btn-ghost btn-sm btn-icon hover:text-red-400"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {products.length === 0 && (
                <div
                  className="col-span-full card p-10 text-center"
                  style={{ color: "var(--text-muted)" }}
                >
                  No products found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {modalProduct !== null && (
        <ProductModal
          product={modalProduct === "new" ? undefined : modalProduct}
          branchId={branchId}
          categories={categories}
          restaurantId={restaurantId}
          onClose={() => setModalProduct(null)}
        />
      )}

      {modalCategory !== null && (
        <CategoryModal
          category={modalCategory === "new" ? undefined : modalCategory}
          branchId={branchId}
          restaurantId={restaurantId}
          onClose={() => setModalCategory(null)}
        />
      )}
    </>
  );
}
