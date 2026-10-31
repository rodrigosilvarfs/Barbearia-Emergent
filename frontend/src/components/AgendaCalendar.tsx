import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppointmentItem } from "@/components/AppointmentItem";
import { fromISODate, toISODate } from "@/lib/format";
import type { Appointment } from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "day" | "week" | "month";
const VIEWS: { id: View; label: string }[] = [
  { id: "day", label: "Dia" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mês" },
];

interface Props {
  today: string;
  queryKey: string;
  fetchRange: (from: string, to: string) => Promise<Appointment[]>;
  onComplete?: (a: Appointment) => void;
  onCancel?: (a: Appointment) => void;
  showBarber?: boolean;
  busy?: boolean;
}

export function AgendaCalendar({ today, queryKey, fetchRange, onComplete, onCancel, showBarber, busy }: Props) {
  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState<string>(today);
  const a = fromISODate(anchor);

  const [from, to] = useMemo(() => {
    if (view === "day") return [anchor, anchor];
    if (view === "week") return [toISODate(startOfWeek(a, { weekStartsOn: 1 })), toISODate(endOfWeek(a, { weekStartsOn: 1 }))];
    return [toISODate(startOfWeek(startOfMonth(a), { weekStartsOn: 1 })), toISODate(endOfWeek(endOfMonth(a), { weekStartsOn: 1 }))];
  }, [view, anchor]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = useQuery({ queryKey: [queryKey, "range", from, to], queryFn: () => fetchRange(from, to) });
  const byDate = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const appt of q.data ?? []) m.set(appt.date, [...(m.get(appt.date) ?? []), appt]);
    return m;
  }, [q.data]);

  function shift(dir: 1 | -1) {
    if (view === "day") setAnchor(toISODate(addDays(a, dir)));
    else if (view === "week") setAnchor(toISODate(addDays(a, 7 * dir)));
    else setAnchor(toISODate(addMonths(a, dir)));
  }

  const label =
    view === "day"
      ? format(a, "EEEE, d 'de' MMMM", { locale: ptBR })
      : view === "week"
        ? `${format(fromISODate(from), "d MMM", { locale: ptBR })} – ${format(fromISODate(to), "d MMM yyyy", { locale: ptBR })}`
        : format(a, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div data-testid="agenda-calendar">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => shift(-1)} data-testid="calendar-prev-button">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => shift(1)} data-testid="calendar-next-button">
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAnchor(today)} data-testid="calendar-today-button">
            Hoje
          </Button>
          <span className="ml-1 font-heading text-lg font-medium first-letter:uppercase" data-testid="calendar-range-label">
            {label}
          </span>
        </div>
        <div className="inline-flex w-fit rounded-lg border border-line bg-elevated p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              data-testid={`calendar-view-${v.id}`}
              className={cn(
                "rounded-md px-3 py-1 text-sm transition-[background-color,color] duration-150",
                view === v.id ? "bg-gold text-page" : "text-muted-foreground hover:text-white",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {q.isError && <p className="text-sm text-muted-foreground">Não foi possível carregar a agenda.</p>}

      {view === "day" && (
        <DayList items={byDate.get(anchor) ?? []} loading={q.isLoading} {...{ onComplete, onCancel, showBarber, busy }} />
      )}

      {view === "week" && (
        <div className="grid gap-3 md:grid-cols-7">
          {eachDayOfInterval({ start: fromISODate(from), end: fromISODate(to) }).map((d) => {
            const iso = toISODate(d);
            const items = byDate.get(iso) ?? [];
            return (
              <button
                type="button"
                key={iso}
                onClick={() => {
                  setAnchor(iso);
                  setView("day");
                }}
                data-testid={`calendar-week-day-${iso}`}
                className={cn(
                  "min-h-28 rounded-xl border bg-elevated/60 p-3 text-left transition-[border-color] duration-150 hover:border-gold/50",
                  iso === today ? "border-gold/60" : "border-line",
                )}
              >
                <p className="text-xs uppercase text-muted-foreground">{format(d, "EEE", { locale: ptBR })}</p>
                <p className="font-heading text-lg">{format(d, "dd")}</p>
                <div className="mt-2 space-y-1">
                  {items.map((it) => (
                    <p
                      key={it.id}
                      className={cn(
                        "truncate rounded px-1.5 py-0.5 text-xs",
                        it.status === "scheduled" && "bg-gold/15 text-gold-soft",
                        it.status === "completed" && "bg-emerald-500/10 text-emerald-400",
                        it.status === "cancelled" && "bg-red-500/10 text-red-400 line-through",
                      )}
                    >
                      <span className="font-mono">{it.time}</span> {it.client_name.split(" ")[0]}
                    </p>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {view === "month" && (
        <div>
          <div className="mb-2 grid grid-cols-7 text-center text-xs uppercase text-muted-foreground">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {eachDayOfInterval({ start: fromISODate(from), end: fromISODate(to) }).map((d) => {
              const iso = toISODate(d);
              const items = (byDate.get(iso) ?? []).filter((x) => x.status !== "cancelled");
              return (
                <button
                  type="button"
                  key={iso}
                  onClick={() => {
                    setAnchor(iso);
                    setView("day");
                  }}
                  data-testid={`calendar-month-day-${iso}`}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border text-sm transition-[border-color] duration-150 hover:border-gold/50 sm:aspect-auto sm:h-20",
                    iso === today ? "border-gold/60" : "border-line",
                    !isSameMonth(d, a) && "opacity-35",
                  )}
                >
                  <span>{format(d, "d")}</span>
                  {items.length > 0 && (
                    <span className="rounded-full bg-gold px-1.5 font-mono text-[10px] font-semibold text-page">{items.length}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DayList({
  items, loading, onComplete, onCancel, showBarber, busy,
}: {
  items: Appointment[];
  loading: boolean;
  onComplete?: (a: Appointment) => void;
  onCancel?: (a: Appointment) => void;
  showBarber?: boolean;
  busy?: boolean;
}) {
  if (loading) return <div className="h-24 animate-pulse rounded-xl bg-elevated" />;
  if (!items.length)
    return (
      <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted-foreground" data-testid="calendar-empty">
        Nenhum agendamento neste dia.
      </p>
    );
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <AppointmentItem key={it.id} appt={it} onComplete={onComplete} onCancel={onCancel} showBarber={showBarber} busy={busy} />
      ))}
    </div>
  );
}
