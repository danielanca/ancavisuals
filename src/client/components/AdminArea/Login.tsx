// components/AdminArea/Login.tsx
// @ts-nocheck
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Login.module.scss";

import useAuth from "../hooks/hooks/useAuth";
import { setJWT } from "../../utils/functions";

// ⬇️ Firebase Auth
import { auth } from "../../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

const Login = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

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
      // ✅ Firebase sign-in
      const cred = await signInWithEmailAndPassword(auth, form.email, form.password);
      const token = await cred.user.getIdToken(true);

      // ✅ keep your existing cookie-based “authorise” logic
      const ok = await setJWT("jwt", token, 1); // 1 day
      if (!ok) throw new Error("Nu s-a putut seta sesiunea.");

      // ✅ update your AuthProvider state shape (keeps compatibility)
      setAuth((prev) => ({
        ...prev,
        email: form.email,
        password: "",          // never store raw password
        accessToken: token,
        authorise: true,
      }));

      navigate("/admin", { replace: true });
    } catch (err: any) {
      // common Firebase error codes for nicer messages
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
    <div className={styles.loginContainer}>
      <form className={styles.loginCardBoard} onSubmit={handleLogin}>
        <div className={styles.logo}>
        <a class="text-center absolute left-1/2 transform -translate-x-1/2" href="/">
        <div class="text-lg md:text-xl lg:text-2xl tracking-[0.2em] md:tracking-[0.3em] uppercase mb-1">
          <span class="font-bold ">Anca</span>
          <span class="font-light">Visuals</span>
          </div>
        </a>
        </div>
<br/><br/>
        <h3 className={styles.textInside}>Login Admin</h3>

        <div className={styles.inputFields}>
          <label className="admin" htmlFor="email">Email:</label>
          <input
            name="email"
            type="email"
            autoComplete="email"
            onChange={onChange}
            value={form.email}
          />

          <label className="admin" htmlFor="password">Parola:</label>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            onChange={onChange}
            value={form.password}
          />

          {errMsg && <p className={styles.error}>{errMsg}</p>}

          <input
            type="submit"
            value={loading ? "Se conectează..." : "Submit"}
            disabled={loading}
          />
        </div>
      </form>
    </div>
  );
};

export default Login;
