import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiPost, apiPut } from "@/lib/api";
import { WEEKDAYS, errorMessage, fmtDate } from "@/lib/format";
import type { Barber, BarberCreate, BarberUpdate, DaySchedule } from "@/lib/types";

const defaultSchedule = (): DaySchedule[] =>
  WEEKDAYS.map((_, i) => ({ weekday: i, enabled: i < 6, start: "09:00", end: "19:00", break_start: "12:00", break_end: "13:00" }));

const empty = (): BarberCreate => ({ name: "", bio: "", photo_url: "", active: true, schedule: defaultSchedule(), days_off: [], email: "", password: "" });

export function BarberDialog({ open, barber, onClose }: { open: boolean; barber: Barber | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<BarberCreate>(empty);
  const [dayOff, setDayOff] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(
      barber
        ? { name: barber.name, bio: barber.bio, photo_url: barber.photo_url, active: barber.active, schedule: barber.schedule, days_off: barber.days_off, email: barber.email ?? "", password: "" }
        : empty(),
    );
    setDayOff("");
  }, [open, barber]);

  const set = <K extends keyof BarberCreate>(k: K, v: BarberCreate[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setDay = (i: number, patch: Partial<DaySchedule>) =>
    setForm((f) => ({ ...f, schedule: f.schedule.map((d) => (d.weekday === i ? { ...d, ...patch } : d)) }));

  const save = useMutation({
    mutationFn: () => {
      if (barber) {
        const body: BarberUpdate = { ...form, password: form.password || undefined };
        return apiPut<Barber>(`/admin/barbers/${barber.id}`, body);
      }
      return apiPost<Barber>("/admin/barbers", form);
    },
    onSuccess: () => {
      toast.success(barber ? "Barbeiro atualizado" : "Barbeiro cadastrado");
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["public-barbers"] });
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const valid = form.name.trim().length >= 2 && form.email.includes("@") && (barber ? !form.password || form.password.length >= 6 : form.password.length >= 6);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl" data-testid="barber-dialog">
        <DialogHeader>
          <DialogTitle>{barber ? "Editar barbeiro" : "Novo barbeiro"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="b-name">Nome</Label>
            <Input id="b-name" value={form.name} onChange={(e) => set("name", e.target.value)} data-testid="barber-name-input" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="b-photo">URL da foto</Label>
            <Input id="b-photo" value={form.photo_url} onChange={(e) => set("photo_url", e.target.value)} placeholder="https://..." data-testid="barber-photo-input" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="b-bio">Descrição</Label>
            <Textarea id="b-bio" rows={2} value={form.bio} onChange={(e) => set("bio", e.target.value)} data-testid="barber-bio-input" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="b-email">E-mail de acesso</Label>
            <Input id="b-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} data-testid="barber-email-input" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="b-pass">{barber ? "Nova senha (opcional)" : "Senha (mín. 6)"}</Label>
            <Input id="b-pass" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} data-testid="barber-password-input" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.active} onCheckedChange={(c) => set("active", !!c)} data-testid="barber-active-checkbox" />
            Ativo (aparece para agendamento)
          </label>
        </div>

        <div className="mt-2">
          <h4 className="mb-2 text-sm font-medium text-gold">Horário de trabalho e intervalo</h4>
          <div className="space-y-2">
            {form.schedule.map((d) => (
              <div key={d.weekday} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-elevated/50 p-2" data-testid={`schedule-row-${d.weekday}`}>
                <label className="flex w-28 items-center gap-2 text-sm">
                  <Checkbox checked={d.enabled} onCheckedChange={(c) => setDay(d.weekday, { enabled: !!c })} data-testid={`schedule-enabled-${d.weekday}`} />
                  {WEEKDAYS[d.weekday]}
                </label>
                {d.enabled ? (
                  <>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Input type="time" step={1800} value={d.start} onChange={(e) => setDay(d.weekday, { start: e.target.value })} className="h-8 w-[7.5rem]" data-testid={`schedule-start-${d.weekday}`} />
                      até
                      <Input type="time" step={1800} value={d.end} onChange={(e) => setDay(d.weekday, { end: e.target.value })} className="h-8 w-[7.5rem]" data-testid={`schedule-end-${d.weekday}`} />
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      pausa
                      <Input type="time" step={1800} value={d.break_start ?? ""} onChange={(e) => setDay(d.weekday, { break_start: e.target.value || null })} className="h-8 w-[7.5rem]" data-testid={`schedule-break-start-${d.weekday}`} />
                      –
                      <Input type="time" step={1800} value={d.break_end ?? ""} onChange={(e) => setDay(d.weekday, { break_end: e.target.value || null })} className="h-8 w-[7.5rem]" data-testid={`schedule-break-end-${d.weekday}`} />
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Folga semanal</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-gold">Dias de folga</h4>
          <div className="flex gap-2">
            <Input type="date" value={dayOff} onChange={(e) => setDayOff(e.target.value)} className="max-w-48" data-testid="barber-dayoff-input" />
            <Button
              type="button"
              variant="outline"
              disabled={!dayOff}
              onClick={() => {
                if (!form.days_off.includes(dayOff)) set("days_off", [...form.days_off, dayOff].sort());
                setDayOff("");
              }}
              data-testid="barber-dayoff-add-button"
            >
              <Plus className="size-4" /> Adicionar
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {form.days_off.map((d) => (
              <span key={d} className="inline-flex items-center gap-1 rounded-md border border-gold/30 bg-gold/10 px-2 py-0.5 text-xs text-gold-soft" data-testid={`barber-dayoff-${d}`}>
                {fmtDate(d)}
                <button type="button" onClick={() => set("days_off", form.days_off.filter((x) => x !== d))} aria-label="Remover">
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="barber-dialog-cancel">Fechar</Button>
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate()} data-testid="barber-dialog-save">
            {save.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
