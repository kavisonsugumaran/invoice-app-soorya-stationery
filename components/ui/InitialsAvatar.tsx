import { avatarColor, initials } from "@/lib/avatar-colors";

type InitialsAvatarProps = {
  name: string;
  size?: number;
  shape?: "circle" | "square";
  colorSeed?: string;
};

export default function InitialsAvatar({
  name,
  size = 28,
  shape = "circle",
  colorSeed,
}: InitialsAvatarProps) {
  const { bg, text } = avatarColor(colorSeed ?? name);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center text-xs font-semibold ${
        shape === "circle" ? "rounded-full" : "rounded-md"
      }`}
      style={{ width: size, height: size, backgroundColor: bg, color: text }}
    >
      {initials(name)}
    </span>
  );
}
