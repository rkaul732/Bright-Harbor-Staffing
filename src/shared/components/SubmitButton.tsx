"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/cn";

export function SubmitButton({
  children,
  className,
  disabled = false,
  variant = "primary"
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={cn(
        variant === "primary" && "primary-button",
        variant === "secondary" && "secondary-button",
        variant === "ghost" && "ghost-button",
        className
      )}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
      {pending ? "Working..." : children}
    </button>
  );
}
