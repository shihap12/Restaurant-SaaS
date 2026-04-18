import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Palette, Type, Image, Save, Eye, Check } from "lucide-react";
import { brandingApi, branchApi } from "@/api";
import { useAuthStore, useUIStore, useBranchStore } from "@/store";
import type { Theme, Branch } from "@/types";
import toast from "react-hot-toast";

const PRESET_THEMES: {
  id: Theme;
  label: string;
  colors: { primary: string; bg: string };
}[] = [
  {
    id: "dark",
    label: "Obsidian",
    colors: { primary: "#f97316", bg: "#0f0f0f" },
  },
  {
    id: "light",
    label: "Pearl",
    colors: { primary: "#f97316", bg: "#fafaf9" },
  },
  {
    id: "warm",
    label: "Crimson",
    colors: { primary: "#e11d48", bg: "#1a0a05" },
  },
  {
    id: "ocean",
    label: "Ocean",
    colors: { primary: "#06b6d4", bg: "#020c14" },
  },
];

const FONT_OPTIONS = [
  { display: "Playfair Display", body: "DM Sans", label: "Classic Elegance" },
  { display: "Cormorant Garamond", body: "Nunito", label: "Refined Serif" },
  { display: "Montserrat", body: "Open Sans", label: "Modern Clean" },
  { display: "Lora", body: "Lato", label: "Editorial" },
  { display: "Bebas Neue", body: "Raleway", label: "Bold Impact" },
];

export default function OwnerBranding() {
  const { user } = useAuthStore();
  const { setTheme, theme: globalTheme } = useUIStore();
  const restaurantId = user?.restaurant_id || 1;
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { setCurrentBranch } = useBranchStore();

  // ─── الفرع المحدد ────────────────────────────────────────────
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

  const { data: branches = [] } = useQuery({
    queryKey: ["owner-branches"],
    queryFn: () => branchApi.getAll(),
    select: (res) => res.data.data as Branch[],
  });

  useEffect(() => {
    if (branches.length > 0 && !selectedBranchId) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, selectedBranchId]);

  // ─── State التصميم (خاص بكل فرع) ────────────────────────────
  const [selectedTheme, setSelectedTheme] = useState<Theme>(globalTheme.theme);
  const [primaryColor, setPrimaryColor] = useState(globalTheme.primary_color);
  const [fontPair, setFontPair] = useState({
    display: globalTheme.font_display,
    body: globalTheme.font_body,
  });
  const [customCss, setCustomCss] = useState(globalTheme.custom_css || "");
  const [tagline, setTagline] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [preview, setPreview] = useState(false);
  const [tab, setTab] = useState<"theme" | "fonts" | "content" | "advanced">(
    "theme",
  );

  // ─── جيب الـ branding الخاص بالفرع المحدد ────────────────────
  const { data: brandingData, isLoading: brandingLoading } = useQuery({
    queryKey: ["branding", restaurantId, selectedBranchId],
    queryFn: async () =>
      (await brandingApi.getForBranch(restaurantId, selectedBranchId!)).data
        .data as import("@/types").RestaurantBranding,
    enabled: !!selectedBranchId,
  });

  // ─── لما يتغير الفرع أو تجي البيانات، حدّث الـ state ──────────
  useEffect(() => {
    const b = brandingData as import("@/types").RestaurantBranding | undefined;
    if (!b) {
      if (selectedBranchId && !brandingLoading) {
        setSelectedTheme("dark");
        setPrimaryColor("#f97316");
        setFontPair({ display: "Playfair Display", body: "DM Sans" });
        setCustomCss("");
        setTagline("");
        setAboutText("");
      }
      return;
    }
    if (b.theme) setSelectedTheme(b.theme);
    if (b.primary_color) setPrimaryColor(b.primary_color);
    if (b.font_display)
      setFontPair({ display: b.font_display, body: b.font_body ?? "DM Sans" });
    if (b.tagline) setTagline(b.tagline);
    if (b.about_text) setAboutText(b.about_text);
    if (b.custom_css) setCustomCss(b.custom_css);
  }, [brandingData, selectedBranchId, brandingLoading]);

  // ─── Mutations ───────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      brandingApi.updateForBranch(restaurantId, selectedBranchId!, data),
    onSuccess: () => toast.success("Branding saved for this branch!"),
    onError: () => toast.error("Failed to save branding"),
  });

  const handleApplyPreview = () => {
    setTheme({
      theme: selectedTheme,
      primary_color: primaryColor,
      font_display: fontPair.display,
      font_body: fontPair.body,
      custom_css: customCss,
    });
    setPreview(true);
    setTimeout(() => setPreview(false), 2000);
  };

  const handleSave = () => {
    if (!selectedBranchId) {
      toast.error("Please select a branch first");
      return;
    }
    saveMutation.mutate({
      theme: selectedTheme,
      primary_color: primaryColor,
      font_display: fontPair.display,
      font_body: fontPair.body,
      custom_css: customCss,
      tagline,
      about_text: aboutText,
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await brandingApi.uploadLogoForBranch(
        restaurantId,
        selectedBranchId!,
        file,
      );
      const logoUrl = res?.data?.data?.logo_url;
      toast.success("Logo uploaded!");

      // Invalidate branding + branches so UI refetches
      queryClient.invalidateQueries({
        queryKey: ["branding", restaurantId, selectedBranchId],
      });
      queryClient.invalidateQueries({ queryKey: ["owner-branches"] });

      // Refresh full branch object and update store so layouts show new logo
      if (selectedBranch?.slug) {
        try {
          const br = await branchApi.getBySlug(selectedBranch.slug);
          setCurrentBranch(br.data.data as Branch);
        } catch (err) {
          // ignore — invalidation will eventually update
        }
      }
    } catch (err) {
      toast.error("Failed to upload logo");
    } finally {
      // clear file input
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const TABS = [
    { id: "theme", label: "Theme", icon: <Palette size={15} /> },
    { id: "fonts", label: "Fonts", icon: <Type size={15} /> },
    { id: "content", label: "Content", icon: <Eye size={15} /> },
    { id: "advanced", label: "Custom CSS", icon: <></> },
  ] as const;

  const selectedBranch = branches.find((b) => b.id === selectedBranchId);

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1
          className="text-2xl font-display font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Branding Studio
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleApplyPreview}
            className="btn btn-secondary gap-2"
          >
            {preview ? (
              <Check size={16} className="text-green-400" />
            ) : (
              <Eye size={16} />
            )}
            {preview ? "Applied!" : "Preview"}
          </button>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending || !selectedBranchId}
            className="btn btn-primary gap-2"
          >
            {saveMutation.isPending ? (
              <span className="loader" />
            ) : (
              <Save size={16} />
            )}
            Save Changes
          </button>
        </div>
      </div>

      {/* ─── Branch Selector ─────────────────────────────────── */}
      <div className="card p-5">
        <h3
          className="text-sm font-semibold mb-3"
          style={{ color: "var(--text-secondary)" }}
        >
          Apply branding to which branch?
        </h3>
        {branches.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No branches found.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {branches.map((branch) => (
              <button
                key={branch.id}
                onClick={() => setSelectedBranchId(branch.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                  selectedBranchId === branch.id
                    ? "border-[var(--brand-500)] bg-[rgba(var(--brand-rgb),0.06)]"
                    : "border-[var(--border)] hover:border-[var(--border-strong)]"
                }`}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                  style={{
                    background: "var(--surface-3)",
                    color: "var(--brand-400)",
                  }}
                >
                  {branch.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {branch.name}
                  </p>
                  <p
                    className="text-xs truncate"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {branch.address}
                  </p>
                </div>
                {selectedBranchId === branch.id && (
                  <Check size={16} style={{ color: "var(--brand-400)" }} />
                )}
              </button>
            ))}
          </div>
        )}

        {selectedBranch && (
          <div
            className="mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
            style={{
              background: "rgba(var(--brand-rgb),0.08)",
              color: "var(--brand-400)",
            }}
          >
            <Check size={12} />
            Changes will only apply to:{" "}
            <strong className="ml-1">{selectedBranch.name}</strong>
          </div>
        )}
      </div>

      {/* Preview Banner */}
      {preview && (
        <div
          className="flex items-center gap-3 p-3 rounded-xl animate-slide-down"
          style={{
            background: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.2)",
          }}
        >
          <Check size={16} className="text-green-400" />
          <p className="text-sm text-green-300">
            Theme preview applied to this page! Save to persist for{" "}
            <strong>{selectedBranch?.name}</strong>.
          </p>
        </div>
      )}

      {/* Logo Upload */}
      <div className="card p-5">
        <h3
          className="text-sm font-semibold mb-1"
          style={{ color: "var(--text-primary)" }}
        >
          Restaurant Logo
        </h3>
        {selectedBranch && (
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            Logo for:{" "}
            <span style={{ color: "var(--brand-400)" }}>
              {selectedBranch.name}
            </span>
          </p>
        )}
        <div className="flex items-center gap-4">
          <div
            className="w-20 h-20 rounded-2xl border-2 border-dashed border-[var(--border)] flex items-center justify-center cursor-pointer hover:border-[var(--brand-500)] transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Image size={24} style={{ color: "var(--text-muted)" }} />
          </div>
          <div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={!selectedBranchId}
              className="btn btn-secondary btn-sm gap-2"
            >
              <Image size={14} /> Upload Logo
            </button>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              PNG, JPG up to 2MB · Recommended: 200×200px
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
          />
        </div>
      </div>

      {/* Tabs */}
      <div
        className={`card overflow-hidden transition-opacity ${!selectedBranchId ? "opacity-50 pointer-events-none" : ""}`}
      >
        <div className="flex border-b border-[var(--border)]">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${
                tab === t.id
                  ? "border-[var(--brand-500)] text-[var(--brand-400)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Theme Tab */}
          {tab === "theme" && (
            <div className="space-y-6">
              <div>
                <h3
                  className="text-sm font-semibold mb-3"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Preset Themes
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {PRESET_THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTheme(t.id)}
                      className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        selectedTheme === t.id
                          ? "border-[var(--brand-500)]"
                          : "border-[var(--border)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{
                          background: t.colors.bg,
                          border: "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        <div
                          className="w-5 h-5 rounded-full"
                          style={{ background: t.colors.primary }}
                        />
                      </div>
                      <span
                        className="text-xs font-medium"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {t.label}
                      </span>
                      {selectedTheme === t.id && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full brand-gradient flex items-center justify-center">
                          <Check size={11} className="text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3
                  className="text-sm font-semibold mb-3"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Primary Brand Color
                </h3>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-14 h-14 rounded-xl cursor-pointer border border-[var(--border)] overflow-hidden"
                  />
                  <div className="flex-1">
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(val))
                          setPrimaryColor(val);
                      }}
                      className="input font-mono text-sm"
                      placeholder="#f97316"
                    />
                  </div>
                  <div className="flex gap-2">
                    {[
                      "#f97316",
                      "#e11d48",
                      "#06b6d4",
                      "#8b5cf6",
                      "#22c55e",
                      "#f59e0b",
                    ].map((c) => (
                      <button
                        key={c}
                        onClick={() => setPrimaryColor(c)}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${
                          primaryColor === c
                            ? "border-white scale-110"
                            : "border-transparent"
                        }`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>

                <div
                  className="mt-4 p-4 rounded-xl flex items-center gap-4"
                  style={{ background: "var(--surface-3)" }}
                >
                  <div
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                    style={{ background: primaryColor }}
                  >
                    Button Preview
                  </div>
                  <div
                    className="px-3 py-1.5 rounded-lg text-sm"
                    style={{
                      background: `${primaryColor}18`,
                      color: primaryColor,
                      border: `1px solid ${primaryColor}30`,
                    }}
                  >
                    Badge Preview
                  </div>
                  <div
                    className="w-6 h-6 rounded-full"
                    style={{ background: primaryColor }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Fonts Tab */}
          {tab === "fonts" && (
            <div className="space-y-4">
              <h3
                className="text-sm font-semibold mb-3"
                style={{ color: "var(--text-secondary)" }}
              >
                Font Pairing
              </h3>
              {FONT_OPTIONS.map((opt) => (
                <button
                  key={opt.display}
                  onClick={() =>
                    setFontPair({ display: opt.display, body: opt.body })
                  }
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    fontPair.display === opt.display
                      ? "border-[var(--brand-500)] bg-[rgba(var(--brand-rgb),0.05)]"
                      : "border-[var(--border)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {opt.label}
                    </span>
                    {fontPair.display === opt.display && (
                      <Check size={14} style={{ color: "var(--brand-400)" }} />
                    )}
                  </div>
                  <p
                    className="text-xl font-bold"
                    style={{
                      fontFamily: `'${opt.display}', serif`,
                      color: "var(--text-primary)",
                    }}
                  >
                    Restaurant Name
                  </p>
                  <p
                    className="text-sm mt-0.5"
                    style={{
                      fontFamily: `'${opt.body}', sans-serif`,
                      color: "var(--text-secondary)",
                    }}
                  >
                    Delicious food — {opt.display} + {opt.body}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Content Tab */}
          {tab === "content" && (
            <div className="space-y-4">
              <div>
                <label
                  className="text-sm font-medium block mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Restaurant Tagline
                </label>
                <input
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="input"
                  placeholder="e.g. Crafted with passion, served with love"
                />
              </div>
              <div>
                <label
                  className="text-sm font-medium block mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  About Text
                </label>
                <textarea
                  value={aboutText}
                  onChange={(e) => setAboutText(e.target.value)}
                  className="input resize-none"
                  rows={5}
                  placeholder="Tell your story..."
                />
              </div>
            </div>
          )}

          {/* Advanced Tab */}
          {tab === "advanced" && (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Inject custom CSS to override any styles. Use CSS variables like{" "}
                <code
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    background: "var(--surface-4)",
                    color: "var(--brand-400)",
                  }}
                >
                  --brand-500
                </code>{" "}
                for theming.
              </p>
              <textarea
                value={customCss}
                onChange={(e) => setCustomCss(e.target.value)}
                className="input font-mono text-sm resize-none leading-relaxed"
                rows={12}
                placeholder={`:root {\n  --brand-500: #your-color;\n}\n\n.btn-primary {\n  border-radius: 999px;\n}`}
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
