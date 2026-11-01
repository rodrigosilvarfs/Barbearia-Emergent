import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarOff, Loader2, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet, apiPut } from "@/lib/api";
import { WEEKDAYS, errorMessage, fmtDate, fmtDateLong } from "@/lib/format";
import type { BarberPublic, DayHours, MyScheduleUpdate } from "@/lib/types";

export function MyScheduleTab({ today }: { today: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["barber-profile"], queryFn: () => apiGet<BarberPublic>("/barber/profile") });
  const [hours, setHours] = useState<DayHours[]>([]);
  const [daysOff, setDaysOff] = useState<string[]>([]);
  const [newOff, setNewOff] = useState("");

  useEffect(() => {
    if (!q.data) return;
    setHours(q.data.schedule.map((d) => ({ weekday: d.weekday, start: d.start, end: d.end })));
    setDaysOff(q.data.days_off.filter((d) => d >= today));
  }, [q.data, today]);

  const save = useMutation({
    mutationFn: (body: MyScheduleUpdate) => apiPut<BarberPublic>("/barber/schedule", body),
    onSuccess: (b) => {
      qc.setQueryData(["barber-profile"], b);
      qc.invalidateQueries({ queryKey: ["availability"] });
      toast.success("Horários atualizados");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const setDay = (wd: number, patch: Partial<DayHours>) => setHours((hs) => hs.map((h) => (h.weekday === wd ? { ...h, ...patch } : h)));
  const invalid = hours.some((h) => h.end <= h.start);
  const schedule = q.data?.schedule ?? [];

  if (q.isLoading) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;
  if (q.isError) return <p className="text-sm text-muted-foreground">Não foi possível carregar seus horários.</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <section className="rounded-xl border border-line bg-panel p-5" data-testid="my-hours-section">
        <h3 className="text-lg font-medium">Horário de atendimento</h3>
        <p className="mb-4 text-sm text-muted-foreground">Defina quando começa e termina seu expediente em cada dia.</p>
        <div className="space-y-2">
          {hours.map((h) => {
            const day = schedule.find((d) => d.weekday === h.weekday);
            return (
              <div key={h.weekday} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-elevated/50 p-3" data-testid={`my-hours-row-${h.weekday}`}>
                <span className="w-24 text-sm font-medium">{WEEKDAYS[h.weekday]}</span>
                {day?.enabled ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Input type="time" step={1800} value={h.start} onChange={(e) => setDay(h.weekday, { start: e.target.value })} className="h-9 w-[7.5rem]" data-testid={`my-hours-start-${h.weekday}`} />
                    até
                    <Input type="time" step={1800} value={h.end} onChange={(e) => setDay(h.weekday, { end: e.target.value })} className="h-9 w-[7.5rem]" data-testid={`my-hours-end-${h.weekday}`} />
                    {day.break_start && day.break_end && <span className="hidden sm:inline">· pausa {day.break_start}–{day.break_end}</span>}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Folga semanal</span>
                )}
              </div>
            );
          })}
        </div>
        {invalid && <p className="mt-3 text-sm text-red-400" data-testid="my-hours-error">O término deve ser depois do início.</p>}
      </section>

      <section className="rounded-xl border border-line bg-panel p-5" data-testid="my-daysoff-section">
        <h3 className="flex items-center gap-2 text-lg font-medium"><CalendarOff className="size-4 text-gold" /> Dias sem atendimento</h3>
        <p className="mb-4 text-sm text-muted-foreground">Escolha um dia para resolver assuntos pessoais. Clientes não poderão agendar nessa data.</p>
        <div className="flex gap-2">
          <Input type="date" min={today} value={newOff} onChange={(e) => setNewOff(e.target.value)} className="h-9" data-testid="my-dayoff-input" />
          <Button
            variant="outline"
            disabled={!newOff || newOff < today}
            onClick={() => {
              if (!daysOff.includes(newOff)) setDaysOff([...daysOff, newOff].sort());
              setNewOff("");
            }}
            data-testid="my-dayoff-add-button"
          >
            <Plus className="size-4" /> Adicionar
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {daysOff.length === 0 && <p className="text-sm text-muted-foreground" data-testid="my-daysoff-empty">Nenhum dia de folga marcado.</p>}
          {daysOff.map((d) => (
            <div key={d} className="flex items-center justify-between rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-sm" data-testid={`my-dayoff-${d}`}>
              <span><span className="font-mono text-gold">{fmtDate(d)}</span> <span className="text-muted-foreground first-letter:uppercase">· {fmtDateLong(d).split(",")[0]}</span></span>
              <button type="button" onClick={() => setDaysOff(daysOff.filter((x) => x !== d))} className="text-muted-foreground transition-colors hover:text-red-400" aria-label="Remover" data-testid={`my-dayoff-remove-${d}`}>
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Agendamentos já marcados não são cancelados automaticamente — confira sua agenda.</p>
      </section>

      <div className="lg:col-span-2">
        <Button size="lg" disabled={invalid || save.isPending} onClick={() => save.mutate({ hours, days_off: daysOff })} data-testid="my-schedule-save-button">
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar alterações
        </Button>
      </div>
    </div>
  );
}
