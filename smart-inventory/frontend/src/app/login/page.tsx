"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useForm } from "react-hook-form";
import { Beaker, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const { register, handleSubmit, formState: { errors } } = useForm<{
    email: string;
    password: string;
  }>();

  const onSubmit = async (data: { email: string; password: string }) => {
    setLoading(true);
    try {
      const res = await authApi.login(data.email, data.password);
      const { access_token, refresh_token, user } = res.data;
      setAuth(user, access_token, refresh_token);
      router.replace("/dashboard");
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: "linear-gradient(hsl(221,83%,53%) 1px, transparent 1px), linear-gradient(90deg, hsl(221,83%,53%) 1px, transparent 1px)", backgroundSize: "60px 60px" }}
      />

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
              <Beaker className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-white text-xl font-700">LabTrack</h1>
              <p className="text-blue-300 text-xs">Smart Inventory Management</p>
            </div>
          </div>

          <h2 className="text-white font-display text-2xl font-600 mb-1">Welcome back</h2>
          <p className="text-white/50 text-sm mb-6">Sign in to your account</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-white/70 text-xs font-medium uppercase tracking-wide">Email</label>
              <input
                type="email"
                {...register("email", { required: "Email is required" })}
                className="mt-1.5 w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                placeholder="admin@lab.edu"
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="text-white/70 text-xs font-medium uppercase tracking-wide">Password</label>
              <div className="relative mt-1.5">
                <input
                  type={showPw ? "text" : "password"}
                  {...register("password", { required: "Password is required" })}
                  className="w-full px-4 py-3 pr-10 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-medium text-sm transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-white/60 text-xs font-medium mb-2">Demo Accounts</p>
            <div className="space-y-1">
              {[
                { role: "Admin", email: "admin@lab.edu", pw: "Admin@1234" },
                { role: "Staff", email: "staff@lab.edu", pw: "Staff@1234" },
                { role: "Student", email: "student@lab.edu", pw: "Student@1234" },
              ].map((c) => (
                <div key={c.role} className="flex items-center justify-between text-xs">
                  <span className="text-white/50">{c.role}</span>
                  <span className="text-white/40 font-mono">{c.email}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
