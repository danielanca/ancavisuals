import { useEffect } from "react";
import { useWeddingHubAuth } from "../context/WeddingHubAuthContext";
import { useWeddingHub } from "../context/WeddingHubContext";

export function useWeddingData(): void {
  const { coupleAuth } = useWeddingHubAuth();
  const { dispatch, setProfile, setGuests, setTables } = useWeddingHub();

  useEffect(() => {
    if (!coupleAuth.coupleAuthorised || !coupleAuth.coupleAccessToken) return;

    dispatch({ type: "SET_LOADING", payload: { loadingProfile: true, loadingGuests: true, loadingTables: true } });

    fetch("/api/wedding-hub/me", {
      headers: { Authorization: `Bearer ${coupleAuth.coupleAccessToken}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Nu s-au putut încărca datele nunții.");
        return response.json();
      })
      .then((data) => {
        setProfile(data.weddingProfile);
        setGuests(data.guests);
        setTables(data.tables);
      })
      .catch((error: Error) => {
        dispatch({ type: "SET_ERROR", payload: error.message });
      });
  }, [coupleAuth.coupleAuthorised, coupleAuth.coupleAccessToken]);
}
