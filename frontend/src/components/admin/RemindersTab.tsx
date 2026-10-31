import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Play, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet, apiPost } from "@/lib/api";
import { errorMessage, fmtDateTime, fmtPhone } from "@/lib/format";
import type { Reminder, RemindersOut, RunResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS: Record<Reminder["status"], { label: string; cls: string }> = {
  pending: { label: "Agendado", cls: "text-gold-soft bg-gold/10 border-gold/30" },
  sending: { label: "Enviando", cls: "text-gold-soft bg-gold/10 border-gold/30" },
  sent: { label: "Enviado", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  cancelled: { label: "Cancelado", cls: "text-muted-foreground bg-muted border-line" },
  failed: { label: "Falhou", cls: "text-red-400 bg-red-500/10 border-red-500/30" },
  skipped: { label: "Ignorado", cls: "text-muted-foreground bg-muted border-line" },
};

export function RemindersTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "reminders"], queryFn: () => apiGet<RemindersOut>("/admin/reminders") });
  const run = useMutation({
    mutationFn: () => apiPost<RunResult>("/admin/reminders/run"),
    onSuccess: (r) => {
      toast.success(`${r.processed} lembrete(s) processado(s)`);
      qc.invalidateQueries({ queryKey: ["admin", "reminders"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const simulated = q.data?.mode !== "live";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Lembretes de WhatsApp</h2>
          <p className="text-muted-foreground">Enviados automaticamente 6h e 1h antes de cada horário (verificação a cada 15 min).</p>
        </div>
        <Button variant="outline" disabled={run.isPending} onClick={() => run.mutate()} data-testid="reminders-run-button">
          <Play className="size-4" /> Processar agora
        </Button>
      </div>

      <div
        className={cn("flex gap-3 rounded-xl border p-4 text-sm", simulated ? "border-gold/30 bg-gold/5" : "border-emerald-500/30 bg-emerald-500/5")}
        data-testid="reminders-mode-banner"
      >
        <Radio className={cn("mt-0.5 size-4 shrink-0", simulated ? "text-gold" : "text-emerald-400")} />
        <div>
          <p className="font-medium">{simulated ? "Modo SIMULADO" : "WhatsApp Cloud API conectado"}</p>
          <p className="text-muted-foreground">
            {simulated
              ? "As mensagens são registradas aqui, mas não enviadas. Para envio real configure WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID (Meta WhatsApp Business Cloud API) e um template aprovado."
              : `Enviando via template "${q.data?.template_name}".`}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Envio</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="min-w-80">Mensagem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground" data-testid="reminders-empty">
                  Nenhum lembrete ainda.
                </TableCell>
              </TableRow>
            )}
            {q.data?.items.map((r) => (
              <TableRow key={r.id} data-testid={`reminder-row-${r.id}`}>
                <TableCell className="font-mono text-xs">{fmtDateTime(r.send_at)}</TableCell>
                <TableCell className="font-mono text-gold">{r.kind}</TableCell>
                <TableCell>
                  <p className="text-sm">{r.client_name}</p>
                  <p className="text-xs text-muted-foreground">{fmtPhone(r.client_phone)}</p>
                </TableCell>
                <TableCell>
                  <span className={cn("rounded-md border px-2 py-0.5 text-xs", STATUS[r.status].cls)} data-testid="reminder-status">
                    {STATUS[r.status].label}
                    {r.mode === "simulated" && r.status === "sent" ? " (simulado)" : ""}
                  </span>
                </TableCell>
                <TableCell className="whitespace-normal text-xs text-muted-foreground">{r.error ?? r.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
