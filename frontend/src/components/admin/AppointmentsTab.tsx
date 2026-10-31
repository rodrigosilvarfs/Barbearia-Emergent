import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppointmentItem } from "@/components/AppointmentItem";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AppointmentDialog } from "@/components/admin/AppointmentDialog";
import { apiGet, apiPost } from "@/lib/api";
import { STATUS_LABEL, errorMessage, useShopInfo } from "@/lib/format";
import type { Appointment, Barber, Service } from "@/lib/types";

const STATUS_OPTS: Record<string, string> = { all: "Todos os status", ...STATUS_LABEL };

export function AppointmentsTab() {
  const qc = useQueryClient();
  const { data: info } = useShopInfo();
  const today = info?.today ?? "";
  const [barberId, setBarberId] = useState("all");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; appt: Appointment | null }>({ open: false, appt: null });
  const [toCancel, setToCancel] = useState<Appointment | null>(null);

  const barbersQ = useQuery({ queryKey: ["admin", "barbers"], queryFn: () => apiGet<Barber[]>("/admin/barbers") });
  const servicesQ = useQuery({ queryKey: ["admin", "services"], queryFn: () => apiGet<Service[]>("/admin/services") });

  const from = dateFrom || today;
  const params = new URLSearchParams();
  if (barberId !== "all") params.set("barber_id", barberId);
  if (status !== "all") params.set("status", status);
  if (from) params.set("date_from", from);
  if (dateTo) params.set("date_to", dateTo);
  const qs = params.toString();

  const listQ = useQuery({
    queryKey: ["admin", "appointments", qs],
    queryFn: () => apiGet<Appointment[]>(`/admin/appointments?${qs}`),
    enabled: !!today,
  });

  const action = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: "complete" | "cancel" }) => apiPost<Appointment>(`/admin/appointments/${id}/${kind}`),
    onSuccess: (_, v) => {
      toast.success(v.kind === "complete" ? "Atendimento concluído" : "Agendamento cancelado");
      qc.invalidateQueries({ queryKey: ["admin"] });
      setToCancel(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const barbers = barbersQ.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Agendamentos</h2>
          <p className="text-muted-foreground">Filtre, crie, altere ou cancele atendimentos.</p>
        </div>
        <Button onClick={() => setDialog({ open: true, appt: null })} data-testid="admin-new-appointment-button">
          <Plus className="size-4" /> Novo agendamento
        </Button>
      </div>

      <div className="grid gap-3 rounded-xl border border-line bg-panel p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto]">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Barbeiro</Label>
          <Select value={barberId} onValueChange={(v: string) => setBarberId(v)}>
            <SelectTrigger className="w-full" data-testid="filter-barber-select">
              <SelectValue>{(v: string) => (v === "all" ? "Todos os barbeiros" : barbers.find((b) => b.id === v)?.name)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os barbeiros</SelectItem>
              {barbers.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={status} onValueChange={(v: string) => setStatus(v)}>
            <SelectTrigger className="w-full" data-testid="filter-status-select">
              <SelectValue>{(v: string) => STATUS_OPTS[v]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_OPTS).map(([k, l]) => (
                <SelectItem key={k} value={k}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">De</Label>
          <Input type="date" value={from} onChange={(e) => setDateFrom(e.target.value)} data-testid="filter-date-from" />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Até</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="filter-date-to" />
        </div>
        <Button
          variant="ghost"
          className="self-end"
          onClick={() => {
            setBarberId("all");
            setStatus("all");
            setDateFrom("");
            setDateTo("");
          }}
          data-testid="filter-reset-button"
        >
          <RotateCcw className="size-4" /> Limpar
        </Button>
      </div>

      <p className="text-sm text-muted-foreground" data-testid="appointments-count">
        {listQ.data ? `${listQ.data.length} agendamento(s)` : ""}
      </p>
      {listQ.isLoading && <div className="h-24 animate-pulse rounded-xl bg-elevated" />}
      {listQ.data?.length === 0 && (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-muted-foreground" data-testid="appointments-empty">
          Nenhum agendamento encontrado com esses filtros.
        </p>
      )}
      <div className="space-y-3" data-testid="admin-appointments-list">
        {listQ.data?.map((a) => (
          <AppointmentItem
            key={a.id}
            appt={a}
            showDate
            showBarber
            busy={action.isPending}
            onEdit={(x) => setDialog({ open: true, appt: x })}
            onComplete={(x) => action.mutate({ id: x.id, kind: "complete" })}
            onCancel={setToCancel}
          />
        ))}
      </div>

      <AppointmentDialog
        open={dialog.open}
        appt={dialog.appt}
        onClose={() => setDialog({ open: false, appt: null })}
        barbers={barbers}
        services={servicesQ.data ?? []}
        today={today}
      />
      <ConfirmDialog
        open={!!toCancel}
        title="Cancelar agendamento?"
        description={toCancel ? `${toCancel.client_name} com ${toCancel.barber_name} às ${toCancel.time}. Os lembretes serão cancelados.` : ""}
        confirmLabel="Cancelar agendamento"
        destructive
        busy={action.isPending}
        onClose={() => setToCancel(null)}
        onConfirm={() => toCancel && action.mutate({ id: toCancel.id, kind: "cancel" })}
      />
    </div>
  );
}
