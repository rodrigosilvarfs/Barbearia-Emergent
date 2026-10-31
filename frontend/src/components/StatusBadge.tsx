import { STATUS_LABEL } from "@/lib/format";
import type { Status } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<Status, string> = {
  scheduled: "border-gold/40 bg-gold/10 text-gold-soft",
  completed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  cancelled: "border-red-500/40 bg-red-500/10 text-red-400",
};

export function StatusBadge({ status, testId }: { status: Status; testId?: string }) {
  return (
    <span
      data-testid={testId ?? "status-badge"}
      className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", STYLES[status])}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
