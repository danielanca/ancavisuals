import useAuth from "../../features/admin/auth/useAuth";

export default function AdminBar() {
  const { auth, logOut } = useAuth();

  if (!auth.authorise) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: "#0f0f0f",
      borderBottom: "1px solid #222",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "12px",
      padding: "0 16px",
      height: "36px",
      fontSize: "12px",
      fontFamily: "sans-serif",
    }}>
      <span style={{ color: "#555" }}>
        Admin:&nbsp;<span style={{ color: "#aaa" }}>{auth.user?.email}</span>
      </span>
      <a
        href="/admin"
        style={{
          background: "none",
          border: "1px solid #333",
          borderRadius: "6px",
          color: "#888",
          fontSize: "11px",
          padding: "3px 10px",
          textDecoration: "none",
        }}
      >
        Dashboard →
      </a>
      <button
        onClick={logOut}
        style={{
          background: "none",
          border: "1px solid #333",
          borderRadius: "6px",
          color: "#888",
          fontSize: "11px",
          padding: "3px 10px",
          cursor: "pointer",
        }}
      >
        Deloghează-te
      </button>
    </div>
  );
}
