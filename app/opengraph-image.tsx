import { ImageResponse } from "next/og";

export const alt = "Pickle Rating: Philippine pickleball rankings";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const HOLES = [[190, 196], [300, 170], [330, 280], [214, 318], [262, 246]];

/** The preview card shown when a link to the site is shared (Facebook, Messenger, Viber). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 64, padding: "0 96px", background: "#1b2a4a", color: "#ffffff" }}>
        <svg width="300" height="300" viewBox="92 92 328 328">
          <circle cx="256" cy="256" r="164" fill="#ff8a3d" />
          {HOLES.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="26" fill="#1b2a4a" />)}
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 88, fontWeight: 800, letterSpacing: -2 }}>Pickle Rating</div>
          <div style={{ fontSize: 38, color: "#d6dcea", lineHeight: 1.3 }}>Philippine pickleball rankings from confirmed matches.</div>
          <div style={{ fontSize: 30, color: "#ff8a3d", fontWeight: 700 }}>Free · No DUPR needed</div>
        </div>
      </div>
    ),
    size,
  );
}
