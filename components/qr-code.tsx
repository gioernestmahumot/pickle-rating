import QRCode from "qrcode";

/** Server-rendered QR code for a link on this site. Phone cameras open it directly. */
export async function QrCode({ url, label }: { url: string; label: string }) {
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1b2a4a", light: "#ffffff" } });
  return (
    <figure className="flex flex-col items-center gap-2">
      {/* Generated here from our own URL, not user content. Always dark on white so any camera can read it, even in night mode. */}
      <div role="img" aria-label={label} className="w-48 rounded-2xl border border-line bg-white p-3 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption className="max-w-56 text-center text-xs text-ink-3">{label}</figcaption>
    </figure>
  );
}
