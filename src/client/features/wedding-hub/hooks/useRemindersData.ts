import { useEffect } from "react";
import { useReminders } from "../context/RemindersContext";
import type { Reminder, ReminderPreferences } from "../context/RemindersContext";
import { useWeddingHubAuth } from "../context/WeddingHubAuthContext";

export function useRemindersData() {
  const { coupleAuth } = useWeddingHubAuth();
  const { setData, setError } = useReminders();

  useEffect(() => {
    if (!coupleAuth.coupleAuthorised || !coupleAuth.coupleAccessToken) return;

    (async () => {
      try {
        const response = await fetch("/api/wedding-hub/reminders", {
          headers: { Authorization: `Bearer ${coupleAuth.coupleAccessToken}` },
        });
        if (!response.ok) throw new Error("fetch failed");
        const data = await response.json();
        setData(data.reminders as Reminder[], data.preferences as ReminderPreferences);
      } catch {
        setError("Nu s-au putut încărca notificările.");
      }
    })();
  }, [coupleAuth.coupleAuthorised, coupleAuth.coupleAccessToken, setData, setError]);
}
