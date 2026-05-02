import React, { createContext, useContext, useReducer, useMemo } from "react";

export type TimelineCategory = "civil" | "church" | "photos" | "restaurant" | "party" | "other";

export type TimelineMoment = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  category: TimelineCategory;
  isFromTemplate: boolean;
  createdAt: string;
  updatedAt: string;
};

type TimelineState = {
  moments: TimelineMoment[];
  loading: boolean;
  error: string | null;
};

type TimelineAction =
  | { type: "SET_MOMENTS"; moments: TimelineMoment[] }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "ADD_MOMENT"; moment: TimelineMoment }
  | { type: "ADD_MOMENTS"; moments: TimelineMoment[] }
  | { type: "UPDATE_MOMENT"; moment: TimelineMoment }
  | { type: "REMOVE_MOMENT"; momentId: string };

const initialState: TimelineState = {
  moments: [],
  loading: true,
  error: null,
};

function sortByTime(moments: TimelineMoment[]): TimelineMoment[] {
  return [...moments].sort((momentA, momentB) => {
    const [aH, aM] = momentA.startTime.split(":").map(Number);
    const [bH, bM] = momentB.startTime.split(":").map(Number);
    return aH * 60 + aM - (bH * 60 + bM);
  });
}

function timelineReducer(state: TimelineState, action: TimelineAction): TimelineState {
  switch (action.type) {
    case "SET_MOMENTS":
      return { ...state, moments: sortByTime(action.moments), loading: false, error: null };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_ERROR":
      return { ...state, error: action.error, loading: false };
    case "ADD_MOMENT":
      return { ...state, moments: sortByTime([...state.moments, action.moment]) };
    case "ADD_MOMENTS":
      return { ...state, moments: sortByTime([...state.moments, ...action.moments]) };
    case "UPDATE_MOMENT":
      return {
        ...state,
        moments: sortByTime(
          state.moments.map((moment) => (moment.id === action.moment.id ? action.moment : moment)),
        ),
      };
    case "REMOVE_MOMENT":
      return { ...state, moments: state.moments.filter((moment) => moment.id !== action.momentId) };
    default:
      return state;
  }
}

type TimelineContextValue = TimelineState & {
  setMoments: (moments: TimelineMoment[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addMoment: (moment: TimelineMoment) => void;
  addMoments: (moments: TimelineMoment[]) => void;
  updateMoment: (moment: TimelineMoment) => void;
  removeMoment: (momentId: string) => void;
};

const TimelineContext = createContext<TimelineContextValue | null>(null);

export function TimelineProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(timelineReducer, initialState);

  const actions = useMemo(
    () => ({
      setMoments: (moments: TimelineMoment[]) => dispatch({ type: "SET_MOMENTS", moments }),
      setLoading: (loading: boolean) => dispatch({ type: "SET_LOADING", loading }),
      setError: (error: string | null) => dispatch({ type: "SET_ERROR", error }),
      addMoment: (moment: TimelineMoment) => dispatch({ type: "ADD_MOMENT", moment }),
      addMoments: (moments: TimelineMoment[]) => dispatch({ type: "ADD_MOMENTS", moments }),
      updateMoment: (moment: TimelineMoment) => dispatch({ type: "UPDATE_MOMENT", moment }),
      removeMoment: (momentId: string) => dispatch({ type: "REMOVE_MOMENT", momentId }),
    }),
    [],
  );

  const contextValue = useMemo(() => ({ ...state, ...actions }), [state, actions]);

  return <TimelineContext.Provider value={contextValue}>{children}</TimelineContext.Provider>;
}

export function useTimeline() {
  const context = useContext(TimelineContext);
  if (!context) throw new Error("useTimeline must be used inside TimelineProvider");
  return context;
}
