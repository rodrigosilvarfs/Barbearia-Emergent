// Hand-written mirrors of backend/models/schemas.py — keep in sync on every model change.

export type Status = "scheduled" | "completed" | "cancelled";

export interface DaySchedule {
  weekday: number; // 0 = segunda ... 6 = domingo
  enabled: boolean;
  start: string;
  end: string;
  break_start: string | null;
  break_end: string | null;
}

export interface BarberPublic {
  id: string;
  name: string;
  bio: string;
  photo_url: string;
  schedule: DaySchedule[];
  days_off: string[];
}

export interface Barber extends BarberPublic {
  active: boolean;
  email: string | null;
}

export interface BarberCreate {
  name: string;
  bio: string;
  photo_url: string;
  active: boolean;
  schedule: DaySchedule[];
  days_off: string[];
  email: string;
  password: string;
}

export type BarberUpdate = Partial<Omit<BarberCreate, "password">> & { password?: string };

export interface Service {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

export interface ServiceIn {
  name: string;
  description: string;
  active: boolean;
}

export interface AppointmentCreate {
  barber_id: string;
  service_id: string;
  client_name: string;
  client_phone: string;
  date: string;
  time: string;
}

export interface Appointment {
  id: string;
  barber_id: string;
  barber_name: string;
  service_id: string;
  service_name: string;
  client_name: string;
  client_phone: string;
  date: string;
  time: string;
  end_time: string;
  duration_minutes: number;
  status: Status;
  source: "online" | "manual";
  starts_at: string;
  created_at: string;
}

export interface AvailabilityOut {
  barber_id: string;
  date: string;
  slots: string[];
}

export interface BlockIn {
  barber_id: string;
  date: string;
  start: string;
  end: string;
  reason: string;
}

export interface Block extends BlockIn {
  id: string;
  barber_name: string;
}

export interface Reminder {
  id: string;
  appointment_id: string;
  kind: "6h" | "1h";
  send_at: string;
  status: "pending" | "sending" | "sent" | "cancelled" | "failed" | "skipped";
  mode: "simulated" | "live" | null;
  message: string;
  client_name: string;
  client_phone: string;
  barber_name: string;
  sent_at: string | null;
  error: string | null;
}

export interface RemindersOut {
  mode: "simulated" | "live";
  template_name: string;
  items: Reminder[];
}

export interface RunResult {
  processed: number;
}

export interface LoginIn {
  email: string;
  password: string;
}

export interface Me {
  id: string;
  email: string;
  name: string;
  role: "admin" | "barber";
  barber_id: string | null;
}

export interface ShopInfo {
  shop_name: string;
  today: string;
  now_time: string;
  timezone: string;
  slot_minutes: number;
  max_days_ahead: number;
}

export interface BarberStat {
  barber_id: string;
  barber_name: string;
  total: number;
  completed: number;
  cancelled: number;
}

export interface Dashboard {
  today: string;
  total_today: number;
  upcoming_count: number;
  completed_today: number;
  cancelled_today: number;
  upcoming: Appointment[];
  by_barber: BarberStat[];
}
