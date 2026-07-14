import { ReactNode, useEffect, useRef } from "react";

type Props = {
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
};

// Lightweight right-click menu used for channel/message/member actions.
export function ContextMenu({ x, y, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 min-w-[160px] rounded-md bg-discord-rail p-1 text-sm shadow-xl"
      style={{ top: y, left: x }}
    >
      {children}
    </div>
  );
}

export function ContextMenuItem({
  onSelect,
  danger,
  children,
}: {
  onSelect: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      role="menuitem"
      onClick={onSelect}
      className={`block w-full rounded px-2 py-1.5 text-left hover:bg-discord-accent hover:text-white ${
        danger ? "text-discord-danger" : "text-discord-text"
      }`}
    >
      {children}
    </button>
  );
}
