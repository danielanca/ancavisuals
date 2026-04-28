import { usePrivacyMode } from "../context/PrivacyModeContext";

interface RedactedProps {
  children: React.ReactNode;
  inline?: boolean;
}

export default function Redacted({ children, inline = true }: RedactedProps) {
  const { privacyMode } = usePrivacyMode();
  if (!privacyMode) return <>{children}</>;
  return (
    <span
      style={{
        filter: "blur(7px)",
        userSelect: "none",
        display: inline ? "inline-block" : "block",
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
