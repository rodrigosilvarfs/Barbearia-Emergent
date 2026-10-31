import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Pencil, Plus, Power, Scissors, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import type { Service, ServiceIn } from "@/lib/types";

export function ServicesTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "services"], queryFn: () => apiGet<Service[]>("/admin/services") });
  const [editing, setEditing] = useState<Service | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ServiceIn>({ name: "", description: "", active: true });
  const [toDelete, setToDelete] = useState<Service | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin"] });
    qc.invalidateQueries({ queryKey: ["public-services"] });
  };
  const save = useMutation({
    mutationFn: ({ id, body }: { id?: string; body: ServiceIn }) => (id ? apiPut<Service>(`/admin/services/${id}`, body) : apiPost<Service>("/admin/services", body)),
    onSuccess: (_, v) => {
      toast.success(v.id ? "Serviço atualizado" : "Serviço cadastrado");
      setOpen(false);
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/admin/services/${id}`),
    onSuccess: () => {
      toast.success("Serviço excluído");
      setToDelete(null);
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  function openDialog(s: Service | null) {
    setEditing(s);
    setForm(s ? { name: s.name, description: s.description, active: s.active } : { name: "", description: "", active: true });
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Serviços</h2>
          <p className="text-muted-foreground">Todo atendimento ocupa um horário de 30 minutos.</p>
        </div>
        <Button onClick={() => openDialog(null)} data-testid="admin-new-service-button">
          <Plus className="size-4" /> Novo serviço
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2" data-testid="admin-services-list">
        {q.data?.map((s) => (
          <div key={s.id} className="flex items-start justify-between gap-3 rounded-xl border border-line bg-panel p-4" data-testid={`service-card-${s.id}`}>
            <div className="flex gap-3">
              <Scissors className="mt-1 size-4 text-gold" strokeWidth={1.6} />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium" data-testid="service-card-name">{s.name}</p>
                  <Badge variant={s.active ? "default" : "secondary"}>{s.active ? "Ativo" : "Inativo"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{s.description}</p>
                <p className="mt-1 flex items-center gap-1 font-mono text-xs text-gold-soft"><Clock className="size-3" /> 30 min</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="icon-sm" variant="ghost" onClick={() => openDialog(s)} data-testid="service-edit-button"><Pencil className="size-4" /></Button>
              <Button size="icon-sm" variant="ghost" onClick={() => save.mutate({ id: s.id, body: { name: s.name, description: s.description, active: !s.active } })} data-testid="service-toggle-button">
                <Power className="size-4" />
              </Button>
              <Button size="icon-sm" variant="ghost" className="text-red-400" onClick={() => setToDelete(s)} data-testid="service-delete-button"><Trash2 className="size-4" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="service-dialog">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="s-name">Nome</Label>
              <Input id="s-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="service-name-input" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-desc">Descrição</Label>
              <Textarea id="s-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="service-description-input" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
            <Button disabled={form.name.trim().length < 2 || save.isPending} onClick={() => save.mutate({ id: editing?.id, body: form })} data-testid="service-dialog-save">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!toDelete}
        title="Excluir serviço?"
        description={`"${toDelete?.name ?? ""}" deixará de ser oferecido. Agendamentos existentes não são afetados.`}
        confirmLabel="Excluir"
        destructive
        busy={remove.isPending}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}
