import { ChevronDown, CircleAlert } from "lucide-react";
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

/** Props to spread on the control so the label, help and error are wired to it. */
export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

type FieldText = { label: string; help?: ReactNode; error?: ReactNode };

/** Label, help text and error message around one control. */
export function Field({
  label,
  help,
  error,
  id,
  className,
  children,
}: FieldText & {
  id?: string;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}) {
  const auto = useId();
  const controlId = id ?? auto;
  const helpId = `${controlId}-help`;
  const errorId = `${controlId}-error`;
  const describedBy =
    [help && helpId, error && errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cx("grid gap-1.5", className)}>
      <label htmlFor={controlId} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children({
        id: controlId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {help && (
        <p id={helpId} className="text-sm text-ink-3">
          {help}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1.5 text-sm font-medium text-danger"
        >
          <Icon icon={CircleAlert} size={16} className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

const control =
  "w-full rounded-control border border-rule bg-sheet-2 px-3.5 text-ink placeholder:text-ink-3 " +
  "transition-colors disabled:opacity-50 aria-invalid:border-danger aria-invalid:bg-danger-soft";

/** Wraps a control in a `Field` only when a label is given. */
function wrap(
  { label, help, error }: Partial<FieldText>,
  id: string | undefined,
  render: (control: Partial<FieldControlProps>) => ReactNode,
) {
  return label ? (
    <Field label={label} help={help} error={error} id={id}>
      {render}
    </Field>
  ) : (
    render({ id })
  );
}

export function Input({
  label,
  help,
  error,
  id,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & Partial<FieldText>) {
  return wrap({ label, help, error }, id, (c) => (
    <input
      className={cx(control, "min-h-11 py-2", className)}
      {...c}
      {...props}
    />
  ));
}

export function Textarea({
  label,
  help,
  error,
  id,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & Partial<FieldText>) {
  return wrap({ label, help, error }, id, (c) => (
    <textarea
      className={cx(control, "min-h-28 py-2.5", className)}
      {...c}
      {...props}
    />
  ));
}

export function Select({
  label,
  help,
  error,
  id,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & Partial<FieldText>) {
  return wrap({ label, help, error }, id, (c) => (
    <span className="relative block">
      <select
        className={cx(
          control,
          "min-h-11 appearance-none py-2 pr-10",
          className,
        )}
        {...c}
        {...props}
      >
        {children}
      </select>
      <Icon
        icon={ChevronDown}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-3"
      />
    </span>
  ));
}
