import { Label } from "@/components/ui/label";

export function Field({
  label,
  hint,
  full,
  children,
}: {
  label: string;
  hint?: string | undefined;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-[12.5px]">
        {label}
        {hint && (
          <span className="ml-1 text-[10.5px] font-normal text-muted-foreground">{hint}</span>
        )}
      </Label>
      {children}
    </div>
  );
}

export function Unit({ unit, children }: { unit: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] text-muted-foreground">
        {unit}
      </span>
    </div>
  );
}

export function SelectBox({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: readonly string[];
}) {
  return (
    <select
      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      value={value}
      onChange={onChange}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function TagGroup({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={`rounded-full border px-4 py-2 text-[12.5px] font-medium transition-colors ${
              on
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-accent"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
