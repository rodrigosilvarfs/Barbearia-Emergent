import { Check, Clock, MessageCircle, Pencil, Phone, Scissors, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDate, fmtPhone, whatsappLink } from "@/lib/format";
import type { Appointment } from "@/lib/types";

interface Props {
  appt: Appointment;
  showDate?: boolean;
  showBarber?: boolean;
  onComplete?: (a: Appointment) => void;
  onCancel?: (a: Appointment) => void;
  onEdit?: (a: Appointment) => void;
  busy?: boolean;
}

export function AppointmentItem({ appt, showDate, showBarber, onComplete, onCancel, onEdit, busy }: Props) {
  const active = appt.status === "scheduled";
  return (
    <div
      data-testid={`appointment-item-${appt.id}`}
      className="group flex flex-col gap-3 rounded-xl border border-line bg-elevated/70 p-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-gold/40 sm:flex-row sm:items-center"
    >
      <div className="flex shrink-0 items-center gap-3 sm:w-28 sm:flex-col sm:items-start sm:gap-0.5">
        <span className="font-mono text-2xl font-semibold text-gold" data-testid="appointment-time">
          {appt.time}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" /> {appt.duration_minutes} min · até {appt.end_time}
        </span>
        {showDate && <span className="text-xs text-muted-foreground" data-testid="appointment-date">{fmtDate(appt.date)}</span>}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 font-medium text-white" data-testid="appointment-client-name">
            <User className="size-3.5 text-muted-foreground" /> {appt.client_name}
          </span>
          <StatusBadge status={appt.status} testId="appointment-status" />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5" data-testid="appointment-service">
            <Scissors className="size-3.5" /> {appt.service_name}
          </span>
          <a
            href={whatsappLink(appt.client_phone)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:text-gold"
            data-testid="appointment-phone"
          >
            <Phone className="size-3.5" /> {fmtPhone(appt.client_phone)}
          </a>
          {showBarber && (
            <span className="flex items-center gap-1.5" data-testid="appointment-barber">
              <User className="size-3.5" /> {appt.barber_name}
            </span>
          )}
        </div>
      </div>

      {active && (onComplete || onCancel || onEdit) && (
        <div className="flex flex-wrap gap-2">
          <a
            href={whatsappLink(appt.client_phone)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2.5 text-sm text-muted-foreground transition-colors hover:border-gold/50 hover:text-gold"
            data-testid="appointment-whatsapp-button"
          >
            <MessageCircle className="size-4" />
          </a>
          {onEdit && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onEdit(appt)} data-testid="appointment-edit-button">
              <Pencil className="size-4" /> Alterar
            </Button>
          )}
          {onComplete && (
            <Button size="sm" disabled={busy} onClick={() => onComplete(appt)} data-testid="appointment-complete-button">
              <Check className="size-4" /> Concluir
            </Button>
          )}
          {onCancel && (
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => onCancel(appt)} data-testid="appointment-cancel-button">
              <X className="size-4" /> Cancelar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
