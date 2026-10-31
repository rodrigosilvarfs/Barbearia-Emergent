import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { errorMessage, fmtDate, useShopInfo } from "@/lib/format";
import type { Barber, Block, BlockIn } from "@/lib/types";

export function BlocksTab() {
  const qc = useQueryClient();
  const { data: info } = useShopInfo();
  const barbersQ = useQuery({ queryKey: ["admin", "barbers"], queryFn: () => apiGet<Barber[]>("/admin/barbers") });
  const blocksQ = useQuery({ queryKey: ["admin", "blocks"], queryFn: () => apiGet<Block[]>("/admin/blocks") });
  const [form, setForm] = useState<BlockIn>({ barber_id: "", date: "", start: "", end: "", reason: "" });
  const barbers = barbersQ.data ?? [];

  const create = useMutation({
    mutationFn: (body: BlockIn) => apiPost<Block>("/admin/blocks", body),
    onSuccess: () => {
      toast.success("Horário bloqueado");
      setForm((f) => ({ ...f, start: "", end: "", reason: "" }));
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/admin/blocks/${id}`),
    onSuccess: () => {
      toast.success("Bloqueio removido");
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const valid = form.barber_id && form.date && form.start && form.end && form.end > form.start;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Bloqueios de horário</h2>
        <p className="text-muted-foreground">Impede que clientes agendem em horários específicos de um barbeiro.</p>
      </div>
      <div className="grid gap-3 rounded-xl border border-line bg-panel p-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_auto_auto_1.2fr_auto]">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Barbeiro</Label>
          <Select value={form.barber_id} onValueChange={(v: string) => setForm({ ...form, barber_id: v })}>
            <SelectTrigger className="w-full" data-testid="block-barber-select">
              <SelectValue>{(v: string) => barbers.find((b) => b.id === v)?.name ?? "Selecione"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {barbers.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Data</Label>
          <Input type="date" min={info?.today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} data-testid="block-date-input" />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Início</Label>
          <Input type="time" step={1800} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} data-testid="block-start-input" />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Fim</Label>
          <Input type="time" step={1800} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} data-testid="block-end-input" />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Motivo</Label>
          <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Ex.: consulta médica" data-testid="block-reason-input" />
        </div>
        <Button className="self-end" disabled={!valid || create.isPending} onClick={() => create.mutate(form)} data-testid="block-create-button">
          <Lock className="size-4" /> Bloquear
        </Button>
      </div>

      {blocksQ.data?.length === 0 && (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-muted-foreground" data-testid="blocks-empty">Nenhum bloqueio futuro.</p>
      )}
      <div className="space-y-2" data-testid="blocks-list">
        {blocksQ.data?.map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-elevated/60 p-3" data-testid={`block-item-${b.id}`}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-mono text-gold">{fmtDate(b.date)} · {b.start}–{b.end}</span>
              <span className="font-medium">{b.barber_name}</span>
              {b.reason && <span className="text-muted-foreground">{b.reason}</span>}
            </div>
            <Button size="icon-sm" variant="ghost" className="text-red-400" onClick={() => remove.mutate(b.id)} data-testid="block-delete-button">
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
