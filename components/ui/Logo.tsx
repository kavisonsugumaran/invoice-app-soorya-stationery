import { Receipt } from "lucide-react";

export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg text-primary-foreground"
      style={{
        width: size,
        height: size,
        backgroundImage: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
      }}
    >
      <Receipt size={Math.round(size * 0.55)} strokeWidth={2.25} />
    </span>
  );
}
