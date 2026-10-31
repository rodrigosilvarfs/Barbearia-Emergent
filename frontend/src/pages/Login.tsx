import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { apiPost } from "@/lib/api";
import { errorMessage, useMe } from "@/lib/format";
import { beginSession } from "@/lib/session";
import type { LoginIn, Me } from "@/lib/types";

const SIDE =
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200";

export default function Login() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation({
    mutationFn: (body: LoginIn) => apiPost<Me>("/auth/login", body),
    onSuccess: (user) => {
      beginSession();
      qc.setQueryData(["me"], user);
      toast.success(`Bem-vindo, ${user.name.split(" ")[0]}!`);
      navigate(user.role === "admin" ? "/admin" : "/barbeiro", { replace: true });
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível entrar.")),
  });

  if (me) return <Navigate to={me.role === "admin" ? "/admin" : "/barbeiro"} replace />;

  function submit(e: FormEvent) {
    e.preventDefault();
    login.mutate({ email: email.trim(), password });
  }

  return (
    <div className="grain grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <img src={SIDE} alt="Cadeira de barbeiro" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(11,12,16,0.95),rgba(11,12,16,0.45))]" />
        <div className="absolute inset-x-10 bottom-12">
          <p className="text-xs uppercase tracking-[0.25em] text-gold">Área da equipe</p>
          <h2 className="mt-3 max-w-md text-4xl font-semibold text-white">Sua agenda, organizada como um corte perfeito.</h2>
        </div>
      </div>

      <div className="relative z-10 flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Logo />
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-gold" data-testid="login-back-home">
            <ArrowLeft className="size-4" /> Início
          </Link>
        </div>
        <div className="my-auto w-full max-w-sm py-12">
          <span className="mb-6 grid size-11 place-items-center rounded-lg border border-gold/40 bg-gold/10 text-gold">
            <Lock className="size-5" strokeWidth={1.6} />
          </span>
          <h1 className="text-3xl font-semibold">Entrar</h1>
          <p className="mt-2 text-muted-foreground">Acesso para barbeiros e administração.</p>
          <form onSubmit={submit} className="mt-8 grid gap-5" data-testid="login-form">
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="h-11"
                data-testid="login-email-input"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="h-11"
                data-testid="login-password-input"
              />
            </div>
            <Button type="submit" size="lg" className="h-11" disabled={login.isPending} data-testid="login-submit-button">
              {login.isPending && <Loader2 className="size-4 animate-spin" />} Entrar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
