/** Feedback types, shared by the form and the admin inbox. Keep in sync with the database check. */
export const FEEDBACK_KINDS = [
  { value: "suggestion", label: "Suggestion", hint: "An idea or a feature you want" },
  { value: "problem", label: "Problem with the app", hint: "Something broken or confusing" },
  { value: "score", label: "Score or rating issue", hint: "A match or rating that looks wrong" },
] as const;
