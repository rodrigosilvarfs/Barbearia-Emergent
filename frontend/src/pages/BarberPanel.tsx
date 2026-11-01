import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgendaCalendar } from "@/components/AgendaCalendar";
import { AppointmentItem } from "@/components/AppointmentItem";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MyScheduleTab } from "@/components/MyScheduleTab";
import { PanelShell } from "@/components/PanelShell";
import { apiGet, apiPost } from "@/lib/api";
import { errorMessage, fmtDateLong, useShopInfo } from "@/lib/format";
import type { Appointment, Me } from "@/lib/types";

const fetchMine = (params: string) => apiGet<Appointment[]>(`/barber/appointments?${params}`);

export default function BarberPanel() {
  return <PanelShell role="barber" title="Painel do barbeiro">{(me) => <BarberContent me={me} />}</PanelShell>;
}

function BarberContent({ me }: { me: Me }) {
  const qc = useQueryClient();
  const { data: info } = useShopInfo();
  const today = info?.today ?? "";
  const [toCancel, setToCancel] = useState<Appointment | null>(null);

  const todayQ = useQuery({ queryKey: ["barber-appts", "today", today], queryFn: () => fetchMine(`date_from=${today}&date_to=${today}`), enabled: !!today });
  const upcomingQ = useQuery({ queryKey: ["barber-appts", "upcoming", today], queryFn: () => fetchMine(`date_from=${today}&status=scheduled`), enabled: !!today });
  const historyQ = useQuery({ queryKey: ["barber-appts", "history"], queryFn: () => fetchMine(`status=completed,cancelled`) });

  const action = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: "complete" | "cancel" }) => apiPost<Appointment>(`/barber/appointments/${id}/${kind}`),
    onSuccess: (_, v) => {
      toast.success(v.kind === "complete" ? "Atendimento concluído" : "Agendamento cancelado");
      qc.invalidateQueries({ queryKey: ["barber-appts"] });
      setToCancel(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const todays = todayQ.data ?? [];
  const kpis = [
    { label: "Hoje", value: todays.filter((a) => a.status !== "cancelled").length, icon: CalendarClock, id: "today" },
    { label: "Pendentes", value: todays.filter((a) => a.status === "scheduled").length, icon: Clock3, id: "pending" },
    { label: "Concluídos", value: todays.filter((a) => a.status === "completed").length, icon: CheckCircle2, id: "completed" },
    { label: "Cancelados", value: todays.filter((a) => a.status === "cancelled").length, icon: XCircle, id: "cancelled" },
  ];
  const complete = (a: Appointment) => action.mutate({ id: a.id, kind: "complete" });
  const history = [...(historyQ.data ?? [])].reverse();

  return (
    <div className="animate-fade-up">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-gold">Olá, {me.name.split(" ")[0]}</p>
        <h1 className="mt-2 text-3xl font-semibold first-letter:uppercase sm:text-4xl" data-testid="barber-today-label">
          {today ? fmtDateLong(today) : "Sua agenda"}
        </h1>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.id} className="rounded-xl border border-line bg-panel p-4" data-testid={`barber-kpi-${k.id}`}>
            <k.icon className="mb-3 size-4 text-gold" strokeWidth={1.6} />
            <p className="font-mono text-3xl font-semibold">{k.value}</p>
            <p className="text-sm text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="today">
        <TabsList className="mb-6 flex-wrap" data-testid="barber-tabs">
          <TabsTrigger value="today" data-testid="barber-tab-today">Hoje</TabsTrigger>
          <TabsTrigger value="upcoming" data-testid="barber-tab-upcoming">Próximos</TabsTrigger>
          <TabsTrigger value="calendar" data-testid="barber-tab-calendar">Calendário</TabsTrigger>
          <TabsTrigger value="history" data-testid="barber-tab-history">Histórico</TabsTrigger>
          <TabsTrigger value="schedule" data-testid="barber-tab-schedule">Meus horários</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">{today && <MyScheduleTab today={today} />}</TabsContent>

        <TabsContent value="today">
          <List items={todays} loading={todayQ.isLoading} empty="Nenhum agendamento para hoje." onComplete={complete} onCancel={setToCancel} busy={action.isPending} />
        </TabsContent>
        <TabsContent value="upcoming">
          <List items={upcomingQ.data ?? []} loading={upcomingQ.isLoading} empty="Sem próximos atendimentos." showDate onComplete={complete} onCancel={setToCancel} busy={action.isPending} />
        </TabsContent>
        <TabsContent value="calendar">
          {today && (
            <AgendaCalendar
              today={today}
              queryKey="barber-appts"
              fetchRange={(f, t) => fetchMine(`date_from=${f}&date_to=${t}`)}
              onComplete={complete}
              onCancel={setToCancel}
              busy={action.isPending}
            />
          )}
        </TabsContent>
        <TabsContent value="history">
          <List items={history} loading={historyQ.isLoading} empty="Nenhum atendimento no histórico ainda." showDate />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!toCancel}
        title="Cancelar agendamento?"
        description={toCancel ? `${toCancel.client_name} às ${toCancel.time}. Os lembretes de WhatsApp também serão cancelados.` : ""}
        confirmLabel="Cancelar agendamento"
        destructive
        busy={action.isPending}
        onClose={() => setToCancel(null)}
        onConfirm={() => toCancel && action.mutate({ id: toCancel.id, kind: "cancel" })}
      />
    </div>
  );
}

function List({
  items, loading, empty, showDate, onComplete, onCancel, busy,
}: {
  items: Appointment[];
  loading: boolean;
  empty: string;
  showDate?: boolean;
  onComplete?: (a: Appointment) => void;
  onCancel?: (a: Appointment) => void;
  busy?: boolean;
}) {
  if (loading) return <div className="h-24 animate-pulse rounded-xl bg-elevated" />;
  if (!items.length)
    return (
      <p className="rounded-xl border border-dashed border-line p-8 text-center text-muted-foreground" data-testid="list-empty">
        {empty}
      </p>
    );
  return (
    <div className="space-y-3">
      {items.map((a) => (
        <AppointmentItem key={a.id} appt={a} showDate={showDate} onComplete={onComplete} onCancel={onCancel} busy={busy} />
      ))}
    </div>
  );
}
