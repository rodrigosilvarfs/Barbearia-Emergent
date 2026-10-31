import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { ApiError, apiGet } from "./api";
import type { Me, ShopInfo, Status } from "./types";

export const SHOP_NAME = "RPG Barbearia";
export const WEEKDAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export const STATUS_LABEL: Record<Status, string> = {
  scheduled: "Agendado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export const toISODate = (d: Date) => format(d, "yyyy-MM-dd");
export const fromISODate = (s: string) => parseISO(s);
export const fmtDate = (s: string) => format(parseISO(s), "dd/MM/yyyy");
export const fmtDateLong = (s: string) => format(parseISO(s), "EEEE, d 'de' MMMM", { locale: ptBR });
export const fmtDateTime = (iso: string) => format(new Date(iso), "dd/MM HH:mm");

export function fmtPhone(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const whatsappLink = (digits: string) => `https://wa.me/55${digits.replace(/\D/g, "")}`;

export function errorMessage(err: unknown, fallback = "Algo deu errado. Tente novamente."): string {
  if (err instanceof ApiError) {
    const body = err.body as { detail?: unknown } | null;
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) {
      const first = body.detail[0] as { msg?: string } | undefined;
      if (first?.msg) return first.msg.replace(/^Value error, /, "");
    }
  }
  return fallback;
}

export function useShopInfo() {
  return useQuery({ queryKey: ["info"], queryFn: () => apiGet<ShopInfo>("/public/info"), staleTime: 60_000 });
}

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => apiGet<Me>("/auth/me"), retry: false });
}
