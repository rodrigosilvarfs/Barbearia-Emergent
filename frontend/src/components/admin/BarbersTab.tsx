import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Power, Trash2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { BarberDialog } from "@/components/admin/BarberDialog";
import { apiDelete, apiGet, apiPut } from "@/lib/api";
import { WEEKDAYS, errorMessage } from "@/lib/format";
import type { Barber, BarberUpdate } from "@/lib/types";

export function BarbersTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "barbers"], queryFn: () => apiGet<Barber[]>("/admin/barbers") });
  const [dialog, setDialog] = useState<{ open: boolean; barber: Barber | null }>({ open: false, barber: null });
  const [toDelete, setToDelete] = useState<Barber | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin"] });
    qc.invalidateQueries({ queryKey: ["public-barbers"] });
  };
  const toggle = useMutation({
    mutationFn: (b: Barber) => apiPut<Barber>(`/admin/barbers/${b.id}`, { active: !b.active } satisfies BarberUpdate),
    onSuccess: (b) => {
      toast.success(b.active ? "Barbeiro ativado" : "Barbeiro desativado");
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/admin/barbers/${id}`),
    onSuccess: () => {
      toast.success("Barbeiro excluído");
      setToDelete(null);
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Barbeiros</h2>
          <p className="text-muted-foreground">Cadastre profissionais, horários, intervalos e folgas.</p>
        </div>
        <Button onClick={() => setDialog({ open: true, barber: null })} data-testid="admin-new-barber-button">
          <Plus className="size-4" /> Novo barbeiro
        </Button>
      </div>

      {q.isLoading && <div className="h-32 animate-pulse rounded-xl bg-elevated" />}
      <div className="grid gap-4 md:grid-cols-2" data-testid="admin-barbers-list">
        {q.data?.map((b) => {
          const days = b.schedule.filter((d) => d.enabled);
          return (
            <div key={b.id} className="flex gap-4 rounded-xl border border-line bg-panel p-4 transition-[border-color] duration-200 hover:border-gold/40" data-testid={`barber-card-${b.id}`}>
              <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-elevated">
                {b.photo_url ? <img src={b.photo_url} alt={b.name} className="size-full object-cover" /> : <User className="m-auto mt-6 size-8 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-heading text-lg font-semibold" data-testid="barber-card-name">{b.name}</p>
                  <Badge variant={b.active ? "default" : "secondary"} data-testid="barber-card-status">{b.active ? "Ativo" : "Inativo"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{b.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {days.length ? days.map((d) => WEEKDAYS[d.weekday].slice(0, 3)).join(" · ") : "Sem dias de trabalho"}
                  {days[0] && ` — ${days[0].start}–${days[0].end}`}
                  {b.days_off.length > 0 && ` · ${b.days_off.length} folga(s)`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, barber: b })} data-testid="barber-edit-button">
                    <Pencil className="size-4" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" disabled={toggle.isPending} onClick={() => toggle.mutate(b)} data-testid="barber-toggle-button">
                    <Power className="size-4" /> {b.active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => setToDelete(b)} data-testid="barber-delete-button">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <BarberDialog open={dialog.open} barber={dialog.barber} onClose={() => setDialog({ open: false, barber: null })} />
      <ConfirmDialog
        open={!!toDelete}
        title="Excluir barbeiro?"
        description={`${toDelete?.name ?? ""} será removido e seus agendamentos futuros serão cancelados. O histórico é mantido.`}
        confirmLabel="Excluir"
        destructive
        busy={remove.isPending}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}
