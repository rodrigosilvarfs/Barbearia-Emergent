import { Link } from "react-router-dom";
import { CalendarCheck, Clock, MapPin, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { BookingWizard } from "@/components/booking/BookingWizard";

const HERO =
  "https://images.unsplash.com/photo-1536520002442-39764a41e987?crop=entropy&cs=srgb&fm=jpg&q=80&w=1800";

export default function Home() {
  return (
    <div className="grain relative min-h-svh overflow-x-hidden">
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <Link to="/login" className={buttonVariants({ variant: "outline", size: "sm" })} data-testid="staff-login-link">
            Área da equipe
          </Link>
        </div>
      </header>

      {/* hero */}
      <section className="relative isolate min-h-[88svh] overflow-hidden" data-testid="hero-section">
        <img src={HERO} alt="Interior da barbearia" className="absolute inset-0 -z-20 size-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(11,12,16,0.75)_0%,rgba(11,12,16,0.95)_100%)]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(212,175,55,0.14),transparent_55%)]" />
        <div className="mx-auto flex min-h-[88svh] max-w-7xl flex-col justify-end px-4 pb-16 pt-32 sm:px-6 sm:pb-24">
          <span className="mb-6 inline-flex w-fit animate-fade-up items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-gold-soft">
            Barbearia premium · desde sempre
          </span>
          <h1 className="max-w-3xl animate-fade-up text-5xl font-semibold leading-[1.02] text-white [animation-delay:80ms] sm:text-7xl">
            Estilo afiado,
            <br />
            <span className="gold-text">sem fila de espera.</span>
          </h1>
          <p className="mt-6 max-w-xl animate-fade-up text-lg text-gray-300 [animation-delay:160ms]">
            Escolha seu barbeiro, o serviço e o horário livre. Em menos de um minuto sua cadeira está reservada na RPG
            Barbearia.
          </p>
          <div className="mt-10 flex animate-fade-up flex-wrap items-center gap-4 [animation-delay:240ms]">
            <a href="#agendar" className={buttonVariants({ size: "lg" }) + " h-12 px-7 text-base"} data-testid="hero-book-button">
              <CalendarCheck className="size-5" /> Agendar horário
            </a>
            <div className="flex gap-6 text-sm text-gray-400">
              <span className="flex items-center gap-2"><Clock className="size-4 text-gold" /> 30 min por atendimento</span>
              <span className="hidden items-center gap-2 sm:flex"><ShieldCheck className="size-4 text-gold" /> Lembrete no WhatsApp</span>
            </div>
          </div>
        </div>
      </section>

      {/* booking */}
      <section id="agendar" className="relative z-10 scroll-mt-6 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-gold">Agendamento online</p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Reserve sua cadeira</h2>
          </div>
          <div className="rounded-2xl border border-line bg-panel/80 p-4 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
            <BookingWizard />
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-line px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <Logo />
          <span className="flex items-center gap-2"><MapPin className="size-4 text-gold" /> Atendimento somente com horário marcado</span>
          <span>© {new Date().getFullYear()} RPG Barbearia</span>
        </div>
      </footer>
    </div>
  );
}
