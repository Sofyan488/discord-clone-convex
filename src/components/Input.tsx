import { forwardRef, InputHTMLAttributes } from "react";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className = "", ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`w-full rounded bg-black/30 px-3 py-2 text-sm text-discord-text outline-none ring-discord-accent focus:ring-2 ${className}`}
      {...props}
    />
  );
});
