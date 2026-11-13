import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { X } from "lucide-react";

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(" ");
}

// Buttons ---------------------------------------------------------------------

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "approve";
  size?: "sm" | "md";
  busy?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "secondary", size = "md", busy, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-7 px-2.5 text-[13px]" : "h-9 px-3.5",
        variant === "primary" && "bg-denim text-white hover:bg-denim-strong",
        variant === "approve" && "bg-ok text-white hover:brightness-110",
        variant === "secondary" && "border border-line-strong bg-surface text-ink hover:bg-sunken",
        variant === "ghost" && "text-ink-2 hover:bg-sunken hover:text-ink",
        variant === "danger" && "border border-p1/40 bg-surface text-p1 hover:bg-p1-soft",
        className,
      )}
      {...rest}
    >
      {busy ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx("inline-flex size-8 items-center justify-center rounded-md text-ink-2 hover:bg-sunken hover:text-ink", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

// Form fields -----------------------------------------------------------------

/** Full width unless the caller sets its own width (w-*). */
const width = (className?: string) => (/(^|\s)w-/.test(className ?? "") ? "" : "w-full");

const fieldBase =
  "rounded-md border border-line-strong bg-surface px-2.5 text-ink placeholder:text-ink-3 focus:border-denim focus:outline-none focus:ring-2 focus:ring-denim/20 disabled:opacity-60";

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[12.5px] text-p1">{error}</p>
      ) : hint ? (
        <p className="text-[12.5px] text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx(fieldBase, width(className), "h-9", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cx(fieldBase, width(className), "min-h-24 py-2 leading-relaxed", className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(fieldBase, width(className), "h-9 pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

/** Labeled input in one call. */
export function TextField({
  label,
  hint,
  error,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <Input id={id} aria-invalid={!!error || undefined} {...rest} />
    </Field>
  );
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-line-strong accent-[var(--color-denim)]"
      />
      {label}
    </label>
  );
}

// Badges ----------------------------------------------------------------------

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "denim" | "ok" | "p1" | "p2" | "p3" | "p4"; children: ReactNode }) {
  const tones: Record<string, string> = {
    neutral: "bg-sunken text-ink-2",
    denim: "bg-denim-soft text-denim",
    ok: "bg-ok-soft text-ok",
    p1: "bg-p1-soft text-p1",
    p2: "bg-p2-soft text-p2",
    p3: "bg-p3-soft text-p3",
    p4: "bg-p4-soft text-p4",
  };
  return (
    <span className={cx("inline-flex h-5 items-center rounded-sm px-1.5 text-[12px] font-medium whitespace-nowrap", tones[tone])}>
      {children}
    </span>
  );
}

export function PriorityBadge({ p }: { p: string }) {
  return <Badge tone={(["p1", "p2", "p3", "p4"].includes(p) ? p : "neutral") as "p1"}>{p.toUpperCase()}</Badge>;
}

const STATUS_TONE: Record<string, "neutral" | "denim" | "ok" | "p1" | "p2" | "p3"> = {
  open: "denim",
  approved: "ok",
  rejected: "p1",
  needs_changes: "p2",
  resolved: "neutral",
  ok: "ok",
  logged_out: "p2",
  needs_verification: "p1",
  error: "p1",
  unknown: "neutral",
  running: "denim",
  succeeded: "ok",
  failed: "p1",
  partial: "p2",
  queued: "neutral",
  in_progress: "denim",
  done: "ok",
  blocked: "p1",
  cancelled: "neutral",
  pending: "p2",
  published: "ok",
  in_review: "p2",
};

export function StatusBadge({ s }: { s: string }) {
  return <Badge tone={STATUS_TONE[s] ?? "neutral"}>{s.replace(/_/g, " ")}</Badge>;
}

// Layout bits -----------------------------------------------------------------

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 pt-5 pb-4 md:px-6">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">{title}</h1>
        {description ? <p className="mt-0.5 max-w-[70ch] text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-lg border border-line bg-surface", className)}>
      {title || actions ? (
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          {title ? <h2 className="font-semibold">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 px-4 py-10 md:px-6">
      <p className="font-semibold">{title}</p>
      {body ? <p className="max-w-[60ch] text-ink-2">{body}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2 p-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-md bg-sunken" />
      ))}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : "Something went wrong loading this.";
  return (
    <div role="alert" className="m-4 rounded-md border border-p1/30 bg-p1-soft px-3 py-2 text-p1">
      {msg}
    </div>
  );
}

/** "Load more" for paged lists. Renders nothing when there is no next page. */
export function LoadMore({ hasMore, loading, onClick }: { hasMore: boolean; loading: boolean; onClick: () => void }) {
  if (!hasMore) return null;
  return (
    <div className="flex justify-center border-t border-line p-3">
      <Button size="sm" busy={loading} onClick={onClick}>
        Load more
      </Button>
    </div>
  );
}

// Tabs (controlled, state lives in the URL where the caller wants) ---------------

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string; count?: number }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line px-4 md:px-6">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            "-mb-px flex h-10 items-center gap-1.5 border-b-2 px-2.5 whitespace-nowrap",
            value === t.id ? "border-denim font-medium text-ink" : "border-transparent text-ink-2 hover:text-ink",
          )}
        >
          {t.label}
          {t.count ? <span className="tabular text-[12px] text-ink-3">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

// Dialog (native <dialog>: focus trap, Esc and focus restore for free) -----------

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className={cx(
        "m-auto w-[calc(100%-32px)] rounded-lg border border-line bg-surface p-0 text-ink shadow-xl",
        wide ? "max-w-2xl" : "max-w-lg",
      )}
    >
      {open ? (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-[16px] font-semibold">{title}</h2>
            <IconButton label="Close" onClick={onClose}>
              <X size={16} />
            </IconButton>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

/** Destructive confirmation: the button names exactly what will be deleted. */
export function ConfirmDelete({
  open,
  onClose,
  thing,
  name,
  consequence,
  onConfirm,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  thing: string;
  name: string;
  consequence: string;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Delete ${thing}?`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep {thing}
          </Button>
          <Button variant="danger" busy={busy} onClick={onConfirm}>
            Delete {name}
          </Button>
        </>
      }
    >
      <p className="text-ink-2">
        <span className="font-medium text-ink">{name}</span> will be removed. {consequence}
      </p>
    </Dialog>
  );
}

// Toasts ----------------------------------------------------------------------

type Toast = { id: number; text: string; tone: "ok" | "error" };
const ToastCtx = createContext<(text: string, tone?: "ok" | "error") => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "pointer-events-auto max-w-sm rounded-md border px-3 py-2 shadow-lg",
              t.tone === "ok" ? "border-line bg-surface text-ink" : "border-p1/40 bg-p1-soft text-p1",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}
