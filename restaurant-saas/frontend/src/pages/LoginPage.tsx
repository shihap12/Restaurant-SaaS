// ============================================================
// RESTORY — REMAINING PAGE STUBS
// Each file is a separate React component
// ============================================================

// ─── src/pages/LoginPage.tsx ─────────────────
import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Eye, EyeOff, UtensilsCrossed, Loader } from "lucide-react";
import gsap from "gsap";
import { authApi } from "@/api";
import { useAuthStore, useBranchStore } from "@/store";
import { branchApi } from "@/api";
import toast from "react-hot-toast";
import type { User } from "@/types";

export function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const { setCurrentBranch } = useBranchStore();
  const params = useParams() as { slug?: string };
  const slug = params.slug;
  const formRef = useRef<HTMLFormElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    gsap.fromTo(
      logoRef.current,
      { y: -30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" },
    );
    gsap.fromTo(
      formRef.current,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, delay: 0.15, ease: "power3.out" },
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload: any = { email, password };
      if (slug) payload.branch_slug = slug;

      const res = await authApi.login(payload);
      const { token, user, branch } = res.data.data as {
        token: string;
        user: User;
        branch?: any;
      };
      setUser(user, token);

      // set current branch if backend returned it, else try to load by slug
      if (branch) {
        setCurrentBranch(branch as any);
      } else if (slug) {
        try {
          const br = await branchApi.getBySlug(slug);
          setCurrentBranch(br.data.data as any);
        } catch (err) {
          // ignore — branch loader elsewhere will fallback
        }
      }

      const roleHomes: Record<string, string> = {
        super_admin: "/admin",
        owner: "/owner",
        manager: "/manager",
        cashier: "/cashier",
        chef: "/chef",
      };

      const redirect =
        roleHomes[(user as any).role] ??
        (slug ? `/${slug}` : (user as any).home_path || "/");
      navigate(redirect);
      toast.success(`Welcome back, ${user.name}!`);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          "Invalid credentials. Please try again.",
      );
      gsap.to(formRef.current, {
        x: -8,
        duration: 0.05,
        yoyo: true,
        repeat: 5,
        ease: "power1.inOut",
      });
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (role: string) => {
    const creds: Record<string, { email: string; password: string }> = {
      admin: { email: "admin@restory.app", password: "password" },
      owner: { email: "owner@restory.app", password: "password" },
      manager: { email: "manager@restory.app", password: "password" },
      cashier: { email: "cashier@restory.app", password: "password" },
      chef: { email: "chef@restory.app", password: "password" },
    };
    if (creds[role]) {
      setEmail(creds[role].email);
      setPassword(creds[role].password);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "var(--surface)" }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-5"
          style={{ background: "var(--brand-500)", filter: "blur(80px)" }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-5"
          style={{ background: "var(--brand-400)", filter: "blur(100px)" }}
        />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div ref={logoRef} className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl brand-gradient flex items-center justify-center mx-auto mb-4 shadow-glow">
            <UtensilsCrossed size={28} className="text-white" />
          </div>
          <h1
            className="text-3xl font-display font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Restory
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Restaurant Management Platform
          </p>
        </div>

        {/* Form */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="card p-6 space-y-4"
        >
          <h2
            className="text-lg font-semibold font-display"
            style={{ color: "var(--text-primary)" }}
          >
            Sign in to your dashboard
          </h2>

          {error && (
            <div
              className="p-3 rounded-xl text-sm text-red-300 animate-slide-down"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              {error}
            </div>
          )}

          <div>
            <label
              className="block text-sm mb-1.5 font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>

          <div>
            <label
              className="block text-sm mb-1.5 font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Password
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pr-12"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg w-full gap-2"
          >
            {loading ? <Loader size={18} className="animate-spin" /> : null}
            {loading ? "Signing in..." : "Sign In"}
          </button>

          {/* Quick demo fill */}
          <div className="pt-2">
            <p
              className="text-xs text-center mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              Quick demo access:
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {["admin", "owner", "manager", "cashier", "chef"].map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => quickFill(role)}
                  className="text-xs px-2.5 py-1 rounded-full transition-colors capitalize"
                  style={{
                    background: "var(--surface-3)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </form>

        <p
          className="text-center text-xs mt-4"
          style={{ color: "var(--text-muted)" }}
        >
          Customers?{" "}
         <a
  href={slug ? `/${slug}` : '/'}
  className="underline"
  style={{ color: 'var(--brand-400)' }}
>
  Browse the menu →
</a>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
