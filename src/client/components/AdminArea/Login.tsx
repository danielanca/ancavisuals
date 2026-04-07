// components/AdminArea/Login.tsx
// @ts-nocheck
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import useAuth from "../hooks/hooks/useAuth";
import { setJWT } from "../../utils/functions";

import { auth } from "../../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

const Login = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const { setAuth } = useAuth();
  const navigate = useNavigate();

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErrMsg(null);

    if (!form.email || !form.password) {
      setErrMsg("Te rugăm să completezi emailul și parola.");
      return;
    }

    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, form.email, form.password);
      const token = await cred.user.getIdToken(true);

      const ok = await setJWT("jwt", token, 1);
      if (!ok) throw new Error("Nu s-a putut seta sesiunea.");

      setAuth((prev) => ({
        ...prev,
        email: form.email,
        password: "",
        accessToken: token,
        authorise: true,
      }));

      navigate("/admin", { replace: true });
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setErrMsg("Email sau parolă incorecte.");
      } else if (code === "auth/user-not-found") {
        setErrMsg("Nu există un cont cu acest email.");
      } else if (code === "auth/too-many-requests") {
        setErrMsg("Prea multe încercări. Încearcă mai târziu.");
      } else {
        setErrMsg(err?.message || "Autentificarea a eșuat.");
      }
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
      <div className="w-full max-w-120">

        {/* Logo */}
        <div className="text-center mb-8">
          <a href="/" className="inline-block">
            <span className="text-2xl tracking-[0.25em] uppercase">
              <span className="font-bold text-white">Anca</span>
              <span className="font-light text-neutral-300">Visuals</span>
            </span>
          </a>
          <p className="text-neutral-500 text-xs tracking-widest uppercase mt-2">Panou de administrare</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleLogin}
          autoComplete="on"
          className="bg-neutral-900 border border-neutral-800 rounded-2xl px-8 py-8 shadow-2xl"
        >
          <h2 className="text-white text-lg font-semibold mb-6 text-center">Autentificare</h2>

          {/* Email */}
          <div className="mb-4">
            <label className="block text-neutral-400 text-xs font-medium mb-1.5 tracking-wide uppercase">
              Email
            </label>
            <input
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={onChange}
              placeholder="adresa@email.com"
              className="w-full bg-neutral-800 text-white text-sm placeholder-neutral-600 border border-neutral-700 rounded-xl px-4 py-3 outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 transition-colors"
            />
          </div>

          {/* Password */}
          <div className="mb-6">
            <label className="block text-neutral-400 text-xs font-medium mb-1.5 tracking-wide uppercase">
              Parolă
            </label>
            <div className="relative">
              <input
                name="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                value={form.password}
                onChange={onChange}
                placeholder="••••••••"
                className="w-full bg-neutral-800 text-white text-sm placeholder-neutral-600 border border-neutral-700 rounded-xl px-4 py-3 pr-11 outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                tabIndex={-1}
              >
                {showPw ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {errMsg && (
            <p className="text-red-400 text-xs text-center mb-4 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {errMsg}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black text-sm font-semibold rounded-xl py-3 hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Se conectează..." : "Intră în cont"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
