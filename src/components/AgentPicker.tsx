import { AGENTS } from "@/lib/format";
import { cx } from "./ui";

/** Toggle chips for which bots may use a connection or site. */
export function AgentPicker({ value, onChange, label }: { value: string[]; onChange: (v: string[]) => void; label: string }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <fieldset>
      <legend className="mb-1 text-[13px] font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {AGENTS.map((a) => {
          const on = value.includes(a.id);
          return (
            <button
              type="button"
              key={a.id}
              aria-pressed={on}
              onClick={() => toggle(a.id)}
              className={cx(
                "h-7 rounded-md border px-2 text-[13px]",
                on ? "border-denim bg-denim-soft text-denim" : "border-line-strong text-ink-2 hover:bg-sunken",
              )}
            >
              {a.short}
            </button>
          );
        })}
      </div>
      {value.length === 0 ? <p className="mt-1 text-[12.5px] text-p2">No bot can use this until you pick at least one.</p> : null}
    </fieldset>
  );
}
