import { BellRing, CalendarRange, LayoutDashboard, Lock, Scissors, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PanelShell } from "@/components/PanelShell";
import { DashboardTab } from "@/components/admin/DashboardTab";
import { AppointmentsTab } from "@/components/admin/AppointmentsTab";
import { BarbersTab } from "@/components/admin/BarbersTab";
import { ServicesTab } from "@/components/admin/ServicesTab";
import { BlocksTab } from "@/components/admin/BlocksTab";
import { RemindersTab } from "@/components/admin/RemindersTab";

const TABS = [
  { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
  { id: "appointments", label: "Agendamentos", icon: CalendarRange },
  { id: "barbers", label: "Barbeiros", icon: Users },
  { id: "services", label: "Serviços", icon: Scissors },
  { id: "blocks", label: "Bloqueios", icon: Lock },
  { id: "reminders", label: "Lembretes", icon: BellRing },
];

export default function AdminPanel() {
  return (
    <PanelShell role="admin" title="Administração">
      {() => (
        <Tabs defaultValue="dashboard" className="animate-fade-up">
          <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <TabsList className="w-max" data-testid="admin-tabs">
              {TABS.map((t) => (
                <TabsTrigger key={t.id} value={t.id} data-testid={`admin-tab-${t.id}`} className="gap-1.5">
                  <t.icon className="size-4" strokeWidth={1.6} /> {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="dashboard"><DashboardTab /></TabsContent>
          <TabsContent value="appointments"><AppointmentsTab /></TabsContent>
          <TabsContent value="barbers"><BarbersTab /></TabsContent>
          <TabsContent value="services"><ServicesTab /></TabsContent>
          <TabsContent value="blocks"><BlocksTab /></TabsContent>
          <TabsContent value="reminders"><RemindersTab /></TabsContent>
        </Tabs>
      )}
    </PanelShell>
  );
}
