import type { ActionState } from "@/app/actions";

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error) return <p role="alert" className="rounded-xl bg-bad-tint px-3 py-2 text-sm text-bad">{state.error}</p>;
  if (state.message) return <p role="status" className="rounded-xl bg-good-tint px-3 py-2 text-sm text-good">{state.message}</p>;
  return null;
}
