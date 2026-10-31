import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { ptBR } from "react-day-picker/locale";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock, Loader2, Scissors, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPost } from "@/lib/api";
import { errorMessage, fmtDate, fmtDateLong, fmtPhone, fromISODate, toISODate, useShopInfo } from "@/lib/format";
import type { Appointment, AppointmentCreate, AvailabilityOut, BarberPublic, Service } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = ["Barbeiro", "Serviço", "Data e horário", "Seus dados", "Confirmação"];

export function BookingWizard() {
  const qc = useQueryClient();
  const { data: info } = useShopInfo();
  const barbersQ = useQuery({ queryKey: ["public-barbers"], queryFn: () => apiGet<BarberPublic[]>("/public/barbers") });
  const servicesQ = useQuery({ queryKey: ["public-services"], queryFn: () => apiGet<Service[]>("/public/services") });

  const [step, setStep] = useState(0);
  const [barberId, setBarberId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState<Appointment | null>(null);

  const barber = barbersQ.data?.find((b) => b.id === barberId);
  const service = servicesQ.data?.find((s) => s.id === serviceId);

  const slotsQ = useQuery({
    queryKey: ["availability", barberId, date],
    queryFn: () => apiGet<AvailabilityOut>(`/public/availability?barber_id=${barberId}&date=${date}`),
    enabled: !!barberId && !!date,
  });

  const book = useMutation({
    mutationFn: (body: AppointmentCreate) => apiPost<Appointment>("/public/appointments", body),
    onSuccess: (a) => {
      setDone(a);
      qc.invalidateQueries({ queryKey: ["availability"] });
      toast.success("Agendamento confirmado!");
    },
    onError: (err) => {
      toast.error(errorMessage(err, "Não foi possível agendar."));
      qc.invalidateQueries({ queryKey: ["availability"] });
      if ((err as { status?: number }).status === 409) {
        setTime("");
        setStep(2);
      }
    },
  });

  const today = info ? fromISODate(info.today) : new Date();
  const maxDate = addDays(today, info?.max_days_ahead ?? 60);
  const isDayDisabled = useMemo(
    () => (d: Date) => {
      const iso = toISODate(d);
      if (iso < toISODate(today) || d > maxDate) return true;
      if (!barber) return false;
      if (barber.days_off.includes(iso)) return true;
      const wd = (d.getDay() + 6) % 7; // JS Sunday=0 → Python Monday=0
      return !barber.schedule.find((s) => s.weekday === wd)?.enabled;
    },
    [barber, today, maxDate],
  );

  const phoneDigits = phone.replace(/\D/g, "");
  const canNext = [!!barberId, !!serviceId, !!date && !!time, name.trim().split(/\s+/).length >= 2 && phoneDigits.length >= 10, true][step];

  function reset() {
    setDone(null);
    setStep(0);
    setBarberId("");
    setServiceId("");
    setDate("");
    setTime("");
    setName("");
    setPhone("");
  }

  function confirm() {
    book.mutate({ barber_id: barberId, service_id: serviceId, client_name: name.trim(), client_phone: phoneDigits, date, time });
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-lg rounded-2xl border border-gold/40 bg-panel p-6 shadow-[0_0_40px_rgba(212,175,55,0.12)] sm:p-8"
        data-testid="booking-success"
      >
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-gold text-page">
          <Check className="size-7" />
        </div>
        <h3 className="text-center text-2xl font-semibold">Horário confirmado!</h3>
        <p className="mt-2 text-center text-muted-foreground">
          {done.client_name.split(" ")[0]}, te esperamos. Você receberá lembretes pelo WhatsApp 6h e 1h antes.
        </p>
        <div className="my-6 border-t border-dashed border-line" />
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <SummaryItem label="Barbeiro" value={done.barber_name} testId="success-barber" />
          <SummaryItem label="Serviço" value={done.service_name} testId="success-service" />
          <SummaryItem label="Data" value={fmtDate(done.date)} testId="success-date" />
          <SummaryItem label="Horário" value={`${done.time} – ${done.end_time}`} testId="success-time" />
        </dl>
        <Button className="mt-8 w-full" variant="outline" onClick={reset} data-testid="booking-new-button">
          Fazer novo agendamento
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl" data-testid="booking-wizard">
      {/* stepper */}
      <ol className="mb-8 flex items-center gap-2 overflow-x-auto pb-1" data-testid="booking-stepper">
        {STEPS.map((label, i) => (
          <li key={label} className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={i > step}
              onClick={() => setStep(i)}
              data-testid={`booking-step-${i + 1}`}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-[background-color,border-color,color] duration-200",
                i === step && "border-gold bg-gold text-page shadow-[0_0_20px_rgba(212,175,55,0.25)]",
                i < step && "border-gold/50 text-gold hover:bg-gold/10",
                i > step && "border-line text-muted-foreground",
              )}
            >
              <span className="font-mono">{i < step ? <Check className="size-3" /> : i + 1}</span>
              <span className={cn(i !== step && "hidden sm:inline")}>{label}</span>
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-4 bg-line sm:w-8" />}
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.25 }}
          className="min-h-[320px]"
        >
          {step === 0 && (
            <StepShell title="Escolha seu barbeiro" subtitle="Cada profissional tem sua própria agenda.">
              {barbersQ.isLoading && <SkeletonGrid />}
              {barbersQ.isError && <EmptyNote text="Não foi possível carregar os barbeiros agora." />}
              {barbersQ.data?.length === 0 && <EmptyNote text="Nenhum barbeiro disponível no momento." />}
              <div className="grid gap-4 sm:grid-cols-2">
                {barbersQ.data?.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    data-testid={`barber-option-${b.id}`}
                    onClick={() => {
                      setBarberId(b.id);
                      setDate("");
                      setTime("");
                      setStep(1);
                    }}
                    className={cn(
                      "group flex items-center gap-4 rounded-xl border bg-elevated/70 p-4 text-left transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-gold/50",
                      barberId === b.id ? "border-gold shadow-[0_0_20px_rgba(212,175,55,0.18)]" : "border-line",
                    )}
                  >
                    <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-panel">
                      {b.photo_url ? (
                        <img src={b.photo_url} alt={b.name} className="size-full object-cover grayscale-[30%] transition-[filter] duration-300 group-hover:grayscale-0" />
                      ) : (
                        <User className="m-auto mt-6 size-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-heading text-lg font-semibold text-white">{b.name}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{b.bio}</p>
                    </div>
                  </button>
                ))}
              </div>
            </StepShell>
          )}

          {step === 1 && (
            <StepShell title="Qual serviço?" subtitle="Todo atendimento tem duração de 30 minutos.">
              {servicesQ.isLoading && <SkeletonGrid />}
              <div className="grid gap-3 sm:grid-cols-2">
                {servicesQ.data?.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    data-testid={`service-option-${s.id}`}
                    onClick={() => {
                      setServiceId(s.id);
                      setStep(2);
                    }}
                    className={cn(
                      "flex items-start justify-between gap-3 rounded-xl border bg-elevated/70 p-4 text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-gold/50",
                      serviceId === s.id ? "border-gold shadow-[0_0_20px_rgba(212,175,55,0.18)]" : "border-line",
                    )}
                  >
                    <div className="flex gap-3">
                      <Scissors className="mt-0.5 size-4 shrink-0 text-gold" strokeWidth={1.6} />
                      <div>
                        <p className="font-medium text-white">{s.name}</p>
                        {s.description && <p className="mt-0.5 text-sm text-muted-foreground">{s.description}</p>}
                      </div>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 rounded-md bg-gold/10 px-2 py-0.5 font-mono text-xs text-gold-soft">
                      <Clock className="size-3" /> 30 min
                    </span>
                  </button>
                ))}
              </div>
            </StepShell>
          )}

          {step === 2 && (
            <StepShell title="Data e horário" subtitle={barber ? `Horários livres de ${barber.name}.` : ""}>
              <div className="grid gap-6 md:grid-cols-[auto_1fr]">
                <div className="rounded-xl border border-line bg-elevated/60 p-2" data-testid="booking-calendar">
                  <Calendar
                    mode="single"
                    locale={ptBR}
                    selected={date ? fromISODate(date) : undefined}
                    onSelect={(d) => {
                      setDate(d ? toISODate(d) : "");
                      setTime("");
                    }}
                    disabled={isDayDisabled}
                    startMonth={today}
                    endMonth={maxDate}
                    defaultMonth={date ? fromISODate(date) : today}
                    className="mx-auto"
                  />
                </div>
                <div>
                  {!date && <EmptyNote text="Selecione uma data no calendário para ver os horários livres." icon />}
                  {date && (
                    <>
                      <p className="mb-3 text-sm first-letter:uppercase text-muted-foreground" data-testid="booking-selected-date">
                        {fmtDateLong(date)}
                      </p>
                      {slotsQ.isLoading && <Loader2 className="size-5 animate-spin text-gold" />}
                      {slotsQ.isError && <EmptyNote text="Não foi possível carregar os horários." />}
                      {slotsQ.data && slotsQ.data.slots.length === 0 && (
                        <EmptyNote text="Sem horários livres nesta data. Tente outro dia." />
                      )}
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="booking-slots">
                        {slotsQ.data?.slots.map((s) => (
                          <button
                            key={s}
                            type="button"
                            data-testid={`slot-${s.replace(":", "")}`}
                            onClick={() => setTime(s)}
                            className={cn(
                              "rounded-lg border py-2.5 font-mono text-sm transition-[background-color,border-color,color] duration-150",
                              time === s
                                ? "border-gold bg-gold font-semibold text-page"
                                : "border-line bg-[#151A22] text-foreground hover:border-gold/60 hover:text-gold",
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </StepShell>
          )}

          {step === 3 && (
            <StepShell title="Seus dados" subtitle="Usaremos seu WhatsApp apenas para lembrar do horário.">
              <div className="grid max-w-md gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="client-name">Nome completo</Label>
                  <Input
                    id="client-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: João da Silva"
                    autoComplete="name"
                    className="h-11"
                    data-testid="client-name-input"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="client-phone">Telefone / WhatsApp</Label>
                  <Input
                    id="client-phone"
                    value={fmtPhone(phone)}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder="(11) 99999-9999"
                    inputMode="tel"
                    autoComplete="tel"
                    className="h-11 font-mono"
                    data-testid="client-phone-input"
                  />
                </div>
              </div>
            </StepShell>
          )}

          {step === 4 && (
            <StepShell title="Confirme seu agendamento" subtitle="Confira os dados antes de confirmar.">
              <div className="max-w-lg rounded-2xl border border-gold/30 bg-panel p-6" data-testid="booking-summary">
                <dl className="grid grid-cols-2 gap-5 text-sm">
                  <SummaryItem label="Cliente" value={name.trim()} testId="summary-client" />
                  <SummaryItem label="WhatsApp" value={fmtPhone(phoneDigits)} testId="summary-phone" />
                  <SummaryItem label="Barbeiro" value={barber?.name ?? ""} testId="summary-barber" />
                  <SummaryItem label="Serviço" value={service?.name ?? ""} testId="summary-service" />
                  <SummaryItem label="Data" value={date ? fmtDate(date) : ""} testId="summary-date" />
                  <SummaryItem label="Horário" value={time} testId="summary-time" />
                </dl>
                <p className="mt-6 text-xs text-muted-foreground">
                  Sem pagamento online — o pagamento é feito diretamente na barbearia.
                </p>
              </div>
            </StepShell>
          )}
        </motion.div>
      </AnimatePresence>

      {/* nav — sticky on mobile */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-8 flex items-center justify-between gap-3 border-t border-line bg-page/90 px-4 py-3 backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button
          variant="ghost"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          data-testid="booking-back-button"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Button>
        {step < 4 ? (
          <Button size="lg" disabled={!canNext} onClick={() => setStep((s) => s + 1)} data-testid="booking-next-button">
            Continuar <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button size="lg" disabled={book.isPending} onClick={confirm} data-testid="booking-confirm-button">
            {book.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Confirmar agendamento
          </Button>
        )}
      </div>
    </div>
  );
}

function StepShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-2xl font-semibold sm:text-3xl">{title}</h3>
      {subtitle && <p className="mt-1 mb-6 text-muted-foreground">{subtitle}</p>}
      {children}
    </section>
  );
}

function SummaryItem({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium text-white" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function EmptyNote({ text, icon }: { text: string; icon?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-line p-5 text-sm text-muted-foreground" data-testid="empty-note">
      {icon && <CalendarDays className="size-5 text-gold" strokeWidth={1.5} />}
      {text}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-xl bg-elevated" />
      ))}
    </div>
  );
}
