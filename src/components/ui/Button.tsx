import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};
// danger: white on red-700 is 6.5:1.
const LOOKS: Record<Variant, string> = {
  primary: "bg-brand text-white hover:opacity-90",
  secondary: "bg-surface text-black hover:bg-gray-200",
  danger: "bg-red-700 text-white hover:bg-red-800",
};

// Black button ("Купить билет", "Получить код") or grey button ("Билеты").
export function Button({ variant = "primary", className = "", type = "button", ...rest }: Props) {
  const look = LOOKS[variant];
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
