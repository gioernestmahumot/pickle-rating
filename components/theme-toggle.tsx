"use client";

/** Switches day/night mode and remembers the choice. Both icons render; CSS shows the right one. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      aria-label="Switch between day and night mode"
      title="Day / night mode"
      className={`grid size-11 place-items-center rounded-xl text-brand-ink-2 transition hover:bg-brand-2 ${className}`}
      onClick={() => {
        const dark = document.documentElement.classList.toggle("dark");
        try {
          localStorage.setItem("theme", dark ? "dark" : "light");
        } catch {
          /* private mode: the choice lasts for this page only */
        }
      }}
    >
      <svg className="size-5 dark:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
      </svg>
      <svg className="hidden size-5 dark:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}

/** Runs in <head> before first paint: the saved choice, else the phone/computer setting. */
export const THEME_SCRIPT =
  "(function(){try{var t=localStorage.getItem('theme');" +
  "if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches))" +
  "document.documentElement.classList.add('dark')}catch(e){}})();";
