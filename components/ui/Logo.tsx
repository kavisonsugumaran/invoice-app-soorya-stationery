// The full KadeBill logo lockup (icon + wordmark + tagline), used as-is —
// not split into an icon crop + separately-styled HTML text. Only the
// favicon (app/icon.png) uses an icon-only crop instead, since a browser
// tab icon is too small to render the wordmark legibly; that's a hard
// technical constraint, not a stylistic choice.
const ASPECT_RATIO = 424 / 400; // matches public/kadebill-logo.png's own dimensions

export default function Logo({ height = 40 }: { height?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/kadebill-logo.png"
      alt="KadeBill — Billing made simple"
      width={Math.round(height * ASPECT_RATIO)}
      height={height}
      className="shrink-0"
      style={{ height, width: "auto" }}
    />
  );
}
