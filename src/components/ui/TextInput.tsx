import { useId, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

// Grey input from the login wireframe, with a label for screen readers.
export function TextInput({ label, error, className = "", ...rest }: Props) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-lg bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand ${
          error ? "ring-2 ring-red-500" : ""
        }`}
        placeholder={label}
        {...rest}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
