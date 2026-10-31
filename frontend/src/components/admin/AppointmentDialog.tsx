import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { errorMessage, fmtPhone } from "@/lib/format";
import type { Appointment, AppointmentCreate, AvailabilityOut, Barber, Service } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  appt: Appointment | null; // null = create
  barbers: Barber[];
  services: Service[];
  today: string;
}

export function AppointmentDialog({ open, onClose, appt, barbers, services, today }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<AppointmentCreate>({ barber_id: "", service_id: "", client_name: "", client_phone: "", date: today, time: "" });

  useEffect(() => {
    if (!open) return;
    setForm(
      appt
        ? { barber_id: appt.barber_id, service_id: appt.service_id, client_name: appt.client_name, client_phone: appt.client_phone, date: appt.date, time: appt.time }
        : { barber_id: "", service_id: "", client_name: "", client_phone: "", date: today, time: "" },
    );
  }, [open, appt, today]);

  const set = <K extends keyof AppointmentCreate>(k: K, v: AppointmentCreate[K]) => setForm((f) => ({ ...f, [k]: v }));

  const slotsQ = useQuery({
    queryKey: ["admin", "availability", form.barber_id, form.date, appt?.id ?? ""],
    queryFn: () =>
      apiGet<AvailabilityOut>(`/admin/availability?barber_id=${form.barber_id}&date=${form.date}${appt ? `&exclude_id=${appt.id}` : ""}`),
    enabled: open && !!form.barber_id && !!form.date,
  });

  const save = useMutation({
    mutationFn: (body: AppointmentCreate) =>
      appt ? apiPut<Appointment>(`/admin/appointments/${appt.id}`, body) : apiPost<Appointment>("/admin/appointments", body),
    onSuccess: () => {
      toast.success(appt ? "Agendamento alterado" : "Agendamento criado");
      qc.invalidateQueries({ queryKey: ["admin"] });
      onClose();
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      qc.invalidateQueries({ queryKey: ["admin", "availability"] });
    },
  });

  const activeBarbers = barbers.filter((b) => b.active || b.id === form.barber_id);
  const activeServices = services.filter((s) => s.active || s.id === form.service_id);
  const valid = form.barber_id && form.service_id && form.time && form.client_name.trim().length >= 3 && form.client_phone.length >= 10;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg" data-testid="appointment-dialog">
        <DialogHeader>
          <DialogTitle>{appt ? "Alterar agendamento" : "Novo agendamento"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Barbeiro</Label>
              <Select value={form.barber_id} onValueChange={(v: string) => setForm((f) => ({ ...f, barber_id: v, time: "" }))}>
                <SelectTrigger className="w-full" data-testid="appt-dialog-barber-select">
                  <SelectValue>{(v: string) => barbers.find((b) => b.id === v)?.name ?? "Selecione"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {activeBarbers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Serviço</Label>
              <Select value={form.service_id} onValueChange={(v: string) => set("service_id", v)}>
                <SelectTrigger className="w-full" data-testid="appt-dialog-service-select">
                  <SelectValue>{(v: string) => services.find((s) => s.id === v)?.name ?? "Selecione"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {activeServices.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="appt-date">Data</Label>
            <Input id="appt-date" type="date" min={today} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value, time: "" }))} data-testid="appt-dialog-date-input" />
          </div>
          <div className="grid gap-2">
            <Label>Horário (30 min)</Label>
            {!form.barber_id && <p className="text-sm text-muted-foreground">Selecione o barbeiro.</p>}
            {slotsQ.isLoading && <Loader2 className="size-4 animate-spin text-gold" />}
            {slotsQ.data && slotsQ.data.slots.length === 0 && <p className="text-sm text-muted-foreground" data-testid="appt-dialog-no-slots">Sem horários livres nesta data.</p>}
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
              {slotsQ.data?.slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("time", s)}
                  data-testid={`appt-dialog-slot-${s.replace(":", "")}`}
                  className={`rounded-md border py-1.5 font-mono text-xs transition-[background-color,border-color] duration-150 ${form.time === s ? "border-gold bg-gold text-page" : "border-line hover:border-gold/60"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="appt-name">Nome do cliente</Label>
              <Input id="appt-name" value={form.client_name} onChange={(e) => set("client_name", e.target.value)} data-testid="appt-dialog-name-input" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="appt-phone">WhatsApp</Label>
              <Input
                id="appt-phone"
                value={fmtPhone(form.client_phone)}
                onChange={(e) => set("client_phone", e.target.value.replace(/\D/g, "").slice(0, 11))}
                inputMode="tel"
                placeholder="(11) 99999-9999"
                data-testid="appt-dialog-phone-input"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="appt-dialog-cancel">Fechar</Button>
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate(form)} data-testid="appt-dialog-save">
            {save.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
