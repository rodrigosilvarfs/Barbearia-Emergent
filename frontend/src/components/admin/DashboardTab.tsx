import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarClock, CheckCircle2, Hourglass, XCircle } from "lucide-react";
import { AppointmentItem } from "@/components/AppointmentItem";
import { apiGet } from "@/lib/api";
import { fmtDateLong } from "@/lib/format";
import type { Dashboard } from "@/lib/types";

export function DashboardTab() {
  const q = useQuery({ queryKey: ["admin", "dashboard"], queryFn: () => apiGet<Dashboard>("/admin/dashboard") });
  const d = q.data;
  const kpis = [
    { id: "total-today", label: "Agendamentos hoje", value: d?.total_today, icon: CalendarClock },
    { id: "upcoming", label: "Próximos atendimentos", value: d?.upcoming_count, icon: Hourglass },
    { id: "completed", label: "Concluídos hoje", value: d?.completed_today, icon: CheckCircle2 },
    { id: "cancelled", label: "Cancelados hoje", value: d?.cancelled_today, icon: XCircle },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Visão geral</h2>
        <p className="first-letter:uppercase text-muted-foreground">{d ? fmtDateLong(d.today) : "—"}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <div
            key={k.id}
            className={`rounded-xl border bg-panel p-5 ${i === 0 ? "border-gold/40 shadow-[0_0_24px_rgba(212,175,55,0.08)]" : "border-line"}`}
            data-testid={`kpi-${k.id}`}
          >
            <k.icon className="mb-4 size-5 text-gold" strokeWidth={1.5} />
            <p className="font-mono text-4xl font-semibold" data-testid={`kpi-${k.id}-value`}>{k.value ?? "–"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-line bg-panel p-5">
          <h3 className="mb-4 text-lg font-medium">Próximos atendimentos</h3>
          {d && d.upcoming.length === 0 && <p className="text-sm text-muted-foreground" data-testid="dashboard-upcoming-empty">Nenhum atendimento futuro.</p>}
          <div className="space-y-3" data-testid="dashboard-upcoming-list">
            {d?.upcoming.map((a) => <AppointmentItem key={a.id} appt={a} showDate showBarber />)}
          </div>
        </section>
        <section className="rounded-xl border border-line bg-panel p-5" data-testid="dashboard-by-barber">
          <h3 className="text-lg font-medium">Agendamentos por barbeiro</h3>
          <p className="mb-4 text-sm text-muted-foreground">Mês atual</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d?.by_barber ?? []} margin={{ left: -20 }}>
                <CartesianGrid stroke="#232A36" vertical={false} />
                <XAxis dataKey="barber_name" stroke="#9CA3AF" fontSize={12} tickLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={12} allowDecimals={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(212,175,55,0.06)" }}
                  contentStyle={{ background: "#181D26", border: "1px solid #2E3846", borderRadius: 8 }}
                  formatter={(value: number, name: string) => [value, name === "total" ? "Total" : name === "completed" ? "Concluídos" : "Cancelados"]}
                />
                <Bar dataKey="total" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cancelled" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {d?.by_barber.map((b) => (
              <li key={b.barber_id} className="flex justify-between border-b border-line/60 pb-2" data-testid={`by-barber-${b.barber_id}`}>
                <span>{b.barber_name}</span>
                <span className="font-mono text-muted-foreground">
                  <span className="text-gold">{b.total}</span> · {b.completed} ✓ · {b.cancelled} ✕
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
