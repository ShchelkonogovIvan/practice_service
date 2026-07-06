import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "default" | "lg";
  asChild?: boolean;
  href?: string;
};

export function Button({
  className,
  variant = "primary",
  size = "default",
  asChild,
  href,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center rounded-md font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-55",
    variant === "primary" && "bg-primary text-white shadow-sm hover:bg-blue-800",
    variant === "secondary" && "border border-border bg-white text-foreground hover:bg-slate-50",
    variant === "ghost" && "text-foreground hover:bg-slate-100",
    size === "lg" ? "h-11 px-5 text-base" : "h-10 px-4 text-sm",
    className
  );

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>;
    return React.cloneElement(child, {
      className: cn(classes, child.props.className)
    });
  }

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
