import { Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)} data-testid="brand-logo">
      <span className="grid size-9 place-items-center rounded-lg border border-gold/40 bg-gold/10 text-gold">
        <Scissors className="size-4" strokeWidth={1.6} />
      </span>
      <span className="font-heading text-lg leading-none tracking-tight">
        <span className="font-semibold text-white">RPG</span>{" "}
        <span className="font-light uppercase tracking-[0.25em] text-gold text-xs">Barbearia</span>
      </span>
    </span>
  );
}
