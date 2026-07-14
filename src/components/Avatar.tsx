type Props = {
  name: string;
  src?: string | null;
  size?: number;
  online?: boolean;
};

// Renders an avatar image or a generated initials fallback (no file uploads in
// v1 — data-model.md avatar provisioning note).
export function Avatar({ name, src, size = 32, online }: Props) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      {src ? (
        <img
          src={src}
          alt={name}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <div
          aria-label={name}
          className="grid h-full w-full place-items-center rounded-full bg-discord-accent text-xs font-semibold text-white"
        >
          {initials || "?"}
        </div>
      )}
      {online !== undefined && (
        <span
          aria-label={online ? "online" : "offline"}
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-discord-sidebar ${
            online ? "bg-discord-online" : "bg-discord-offline"
          }`}
        />
      )}
    </div>
  );
}
