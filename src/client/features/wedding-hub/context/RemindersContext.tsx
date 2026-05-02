import React, { createContext, useContext, useReducer, useMemo } from "react";

export type ReminderType = "checklist" | "budget" | "custom" | "system";
export type ReminderTriggerType = "daysBeforeWedding" | "specificDate" | "onCondition";
export type ReminderStatus = "pending" | "sent" | "dismissed";

export type Reminder = {
  id: string;
  type: ReminderType;
  title: string;
  message: string;
  triggerType: ReminderTriggerType;
  triggerValue: {
    daysBeforeWedding: number | null;
    specificDate: string | null;
    condition: string | null;
  };
  channels: { email: boolean; inApp: boolean };
  status: ReminderStatus;
  sentAt: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReminderPreferences = {
  emailNotificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  emailAddress: string;
};

type RemindersState = {
  reminders: Reminder[];
  preferences: ReminderPreferences;
  loading: boolean;
  error: string | null;
};

type RemindersAction =
  | { type: "SET_DATA"; reminders: Reminder[]; preferences: ReminderPreferences }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "ADD_REMINDER"; reminder: Reminder }
  | { type: "UPDATE_REMINDER"; reminder: Reminder }
  | { type: "REMOVE_REMINDER"; reminderId: string }
  | { type: "UPDATE_PREFERENCES"; preferences: Partial<ReminderPreferences> };

const DEFAULT_PREFERENCES: ReminderPreferences = {
  emailNotificationsEnabled: false,
  inAppNotificationsEnabled: true,
  emailAddress: "",
};

const initialState: RemindersState = {
  reminders: [],
  preferences: DEFAULT_PREFERENCES,
  loading: true,
  error: null,
};

function remindersReducer(state: RemindersState, action: RemindersAction): RemindersState {
  switch (action.type) {
    case "SET_DATA":
      return {
        ...state,
        reminders: action.reminders,
        preferences: action.preferences ?? DEFAULT_PREFERENCES,
        loading: false,
        error: null,
      };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_ERROR":
      return { ...state, error: action.error, loading: false };
    case "ADD_REMINDER":
      return { ...state, reminders: [...state.reminders, action.reminder] };
    case "UPDATE_REMINDER":
      return {
        ...state,
        reminders: state.reminders.map((reminder) =>
          reminder.id === action.reminder.id ? action.reminder : reminder,
        ),
      };
    case "REMOVE_REMINDER":
      return {
        ...state,
        reminders: state.reminders.filter((reminder) => reminder.id !== action.reminderId),
      };
    case "UPDATE_PREFERENCES":
      return {
        ...state,
        preferences: { ...state.preferences, ...action.preferences },
      };
    default:
      return state;
  }
}

type RemindersContextValue = RemindersState & {
  setData: (reminders: Reminder[], preferences: ReminderPreferences) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addReminder: (reminder: Reminder) => void;
  updateReminder: (reminder: Reminder) => void;
  removeReminder: (reminderId: string) => void;
  updatePreferences: (preferences: Partial<ReminderPreferences>) => void;
};

const RemindersContext = createContext<RemindersContextValue | null>(null);

export function RemindersProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(remindersReducer, initialState);

  const actions = useMemo(
    () => ({
      setData: (reminders: Reminder[], preferences: ReminderPreferences) =>
        dispatch({ type: "SET_DATA", reminders, preferences }),
      setLoading: (loading: boolean) => dispatch({ type: "SET_LOADING", loading }),
      setError: (error: string | null) => dispatch({ type: "SET_ERROR", error }),
      addReminder: (reminder: Reminder) => dispatch({ type: "ADD_REMINDER", reminder }),
      updateReminder: (reminder: Reminder) => dispatch({ type: "UPDATE_REMINDER", reminder }),
      removeReminder: (reminderId: string) => dispatch({ type: "REMOVE_REMINDER", reminderId }),
      updatePreferences: (preferences: Partial<ReminderPreferences>) =>
        dispatch({ type: "UPDATE_PREFERENCES", preferences }),
    }),
    [],
  );

  const contextValue = useMemo(() => ({ ...state, ...actions }), [state, actions]);

  return <RemindersContext.Provider value={contextValue}>{children}</RemindersContext.Provider>;
}

export function useReminders() {
  const context = useContext(RemindersContext);
  if (!context) throw new Error("useReminders must be used inside RemindersProvider");
  return context;
}
