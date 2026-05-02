import React, { useReducer } from "react";
import { useNavigate } from "react-router-dom";
import { useWeddingHubAuth } from "../context/WeddingHubAuthContext";
import { useWeddingHubTheme } from "../context/WeddingHubThemeContext";

type LoginState = {
  emailInput: string;
  passwordInput: string;
  isLoading: boolean;
  errorMessage: string | null;
};

type LoginAction =
  | { type: "SET_EMAIL"; payload: string }
  | { type: "SET_PASSWORD"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null };

function loginReducer(state: LoginState, action: LoginAction): LoginState {
  switch (action.type) {
    case "SET_EMAIL": return { ...state, emailInput: action.payload };
    case "SET_PASSWORD": return { ...state, passwordInput: action.payload };
    case "SET_LOADING": return { ...state, isLoading: action.payload };
    case "SET_ERROR": return { ...state, errorMessage: action.payload, isLoading: false };
    default: return state;
  }
}

const WeddingLoginPage: React.FC = () => {
  const { signInAsCouple } = useWeddingHubAuth();
  const { theme, toggleThemeOverride } = useWeddingHubTheme();
  const navigate = useNavigate();

  const [loginState, dispatch] = useReducer(loginReducer, {
    emailInput: "",
    passwordInput: "",
    isLoading: false,
    errorMessage: null,
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!loginState.emailInput.trim() || !loginState.passwordInput) return;

    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      await signInAsCouple(loginState.emailInput.trim(), loginState.passwordInput);
      navigate("/wedding-hub/dashboard");
    } catch {
      dispatch({ type: "SET_ERROR", payload: "Email sau parolă incorecte." });
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${
      theme === "light"
        ? "bg-[radial-gradient(circle_at_top,_rgba(223,171,140,0.2),_transparent_30%),linear-gradient(180deg,_#fbf5ee,_#f4eadf)]"
        : "bg-neutral-950"
    }`}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <p className={`text-xs tracking-widest uppercase ${theme === "light" ? "text-rose-700/70" : "text-rose-400"}`}>Wedding Hub</p>
            <button
              type="button"
              onClick={toggleThemeOverride}
              className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
                theme === "light"
                  ? "border-[#dbc7b4] bg-white/70 text-[#5b4637] hover:bg-white"
                  : "border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
              }`}
            >
              {theme === "light" ? "Light" : "Dark"}
            </button>
          </div>
          <h1 className={`text-2xl font-light tracking-wide ${theme === "light" ? "text-[#312922]" : "text-white"}`}>Bun venit</h1>
          <p className={`text-sm mt-2 ${theme === "light" ? "text-[#6b5d52]" : "text-neutral-500"}`}>Intră în contul tău pentru a gestiona nunta</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className={`rounded-xl border p-6 space-y-4 ${
            theme === "light"
              ? "border-[#dfd0c0] bg-[linear-gradient(180deg,_rgba(255,252,248,0.94),_rgba(247,239,229,0.9))] shadow-[0_18px_40px_rgba(116,86,59,0.08)]"
              : "bg-neutral-900 border-neutral-800"
          }`}
        >
          {loginState.errorMessage && (
            <div className={`text-sm rounded-lg px-4 py-3 ${
              theme === "light"
                ? "bg-red-50 border border-red-200 text-red-700"
                : "bg-red-900/30 border border-red-800 text-red-300"
            }`}>
              {loginState.errorMessage}
            </div>
          )}

          <div className="space-y-1">
            <label className={`text-xs uppercase tracking-wide ${theme === "light" ? "text-[#7c6a5d]" : "text-neutral-400"}`}>Email</label>
            <input
              type="email"
              autoComplete="email"
              value={loginState.emailInput}
              onChange={(e) => dispatch({ type: "SET_EMAIL", payload: e.target.value })}
              required
              className={`w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-rose-500 transition-colors ${
                theme === "light"
                  ? "bg-white/80 border border-[#e1d2c1] text-[#312922]"
                  : "bg-neutral-800 border border-neutral-700 text-white"
              }`}
              placeholder="email@exemplu.com"
            />
          </div>

          <div className="space-y-1">
            <label className={`text-xs uppercase tracking-wide ${theme === "light" ? "text-[#7c6a5d]" : "text-neutral-400"}`}>Parolă</label>
            <input
              type="password"
              autoComplete="current-password"
              value={loginState.passwordInput}
              onChange={(e) => dispatch({ type: "SET_PASSWORD", payload: e.target.value })}
              required
              className={`w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-rose-500 transition-colors ${
                theme === "light"
                  ? "bg-white/80 border border-[#e1d2c1] text-[#312922]"
                  : "bg-neutral-800 border border-neutral-700 text-white"
              }`}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loginState.isLoading}
            className={`w-full font-medium py-2.5 rounded-lg text-sm transition-colors mt-2 disabled:text-neutral-500 ${
              theme === "light"
                ? "bg-[#c66a4f] hover:bg-[#b85b42] text-white disabled:bg-neutral-300"
                : "bg-rose-600 hover:bg-rose-500 disabled:bg-neutral-700 text-white"
            }`}
          >
            {loginState.isLoading ? "Se autentifică..." : "Intră în cont"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default WeddingLoginPage;
