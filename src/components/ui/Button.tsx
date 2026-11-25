import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};
// primary: white on #534AB7 6.9:1; danger: white on #B42318 6.6:1; ghost: primary-dark on white 10.3:1.
const LOOKS: Record<Variant, string> = {
  primary: "bg-primary text-white shadow-soft hover:bg-primary-dark",
  secondary: "bg-surface text-black hover:bg-gray-200",
  ghost: "bg-transparent text-primary-dark hover:bg-primary-soft",
  danger: "bg-danger text-white hover:bg-danger-ink",
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
export const buttonClass = (variant: Variant = "primary") =>
  `inline-block rounded-lg px-4 py-2 text-sm font-semibold transition ${LOOKS[variant]}`;
