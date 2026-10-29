import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

// Black button ("Купить билет", "Получить код") or grey button ("Билеты").
export function Button({ variant = "primary", className = "", type = "button", ...rest }: Props) {
  const look =
    variant === "primary"
      ? "bg-brand text-white hover:opacity-90"
      : "bg-surface text-black hover:bg-gray-200";
  return (
    <button
      type={type}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${look} ${className}`}
      {...rest}
    />
  );
}

// Same look, for links (<Link className={buttonClass()} />)
export const buttonClass = (variant: "primary" | "secondary" = "primary") =>
  `inline-block rounded-lg px-4 py-2 text-sm font-semibold transition ${
    variant === "primary" ? "bg-brand text-white hover:opacity-90" : "bg-surface text-black hover:bg-gray-200"
  }`;
