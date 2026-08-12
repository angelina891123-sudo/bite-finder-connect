import { Check, X } from "lucide-react";
import { passwordScore } from "@/lib/regions";

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const { checks, score, strong } = passwordScore(password);
  const label = strong ? (score === 4 ? "強" : "中等") : "太弱";
  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all ${strong ? "bg-primary" : "bg-destructive"}`}
            style={{ width: `${(score / 4) * 100}%` }}
          />
        </div>
        <span className={`text-[11px] font-medium ${strong ? "text-primary" : "text-destructive"}`}>
          密碼強度：{label}
        </span>
      </div>
      <ul className="grid gap-0.5 sm:grid-cols-2">
        {checks.map((c) => (
          <li
            key={c.label}
            className={`flex items-center gap-1 text-[11px] ${c.ok ? "text-muted-foreground" : "text-destructive"}`}
          >
            {c.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
