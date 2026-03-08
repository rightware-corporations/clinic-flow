import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Clock, Play, X, Check, UserX, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Layout from "@/components/layout/Layout";
import BlockTimeDialog from "@/components/practitioner/BlockTimeDialog";
import WeeklyView from "@/components/practitioner/WeeklyView";
import { toast } from "sonner";

type AppointmentStatus = "confirmed" | "pending" | "blocked" | "completed" | "in_progress" | "cancelled" | "no_show";

interface Appointment {
  id: string;
  patient: string;
  service: string;
  time: string;
  duration: number;
  status: AppointmentStatus;
}

const initialAgenda: Appointment[] = [
  { id: "b1", patient: "João Silva", service: "Consulta de Medicina Geral", time: "09:30", duration: 30, status: "confirmed" },
  { id: "b2", patient: "Maria Santos", service: "Consulta de Medicina Geral", time: "10:00", duration: 30, status: "confirmed" },
  { id: "b3", patient: "Pedro Costa", service: "Consulta de Medicina Geral", time: "10:30", duration: 30, status: "pending" },
  { id: "b4", patient: "--", service: "Bloqueado", time: "11:00", duration: 30, status: "blocked" },
  { id: "b5", patient: "Ana Ferreira", service: "Consulta de Medicina Geral", time: "11:30", duration: 30, status: "confirmed" },
  { id: "b6", patient: "Carlos Oliveira", service: "Consulta de Medicina Geral", time: "14:00", duration: 30, status: "confirmed" },
];

const statusConfig: Record<AppointmentStatus, { label: string; color: string }> = {
  confirmed: { label: "Confirmada", color: "bg-success/10 text-success" },
  pending: { label: "Pendente", color: "bg-warning/10 text-warning" },
  blocked: { label: "Bloqueado", color: "bg-muted text-muted-foreground" },
  completed: { label: "Realizada", color: "bg-primary/10 text-primary" },
  in_progress: { label: "Em curso", color: "bg-info/10 text-info" },
  cancelled: { label: "Cancelada", color: "bg-destructive/10 text-destructive" },
  no_show: { label: "Não compareceu", color: "bg-destructive/10 text-destructive" },
};

export default function PractitionerDashboard() {
  const [agenda, setAgenda] = useState<Appointment[]>(initialAgenda);
  const [weekOffset, setWeekOffset] = useState(0);
  const [dialogState, setDialogState] = useState<{ open: boolean; action: "cancel" | "no_show" | null; aptId: string | null }>({
    open: false, action: null, aptId: null,
  });

  const updateStatus = (id: string, status: AppointmentStatus) => {
    setAgenda((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  };

  const handleStart = (apt: Appointment) => {
    updateStatus(apt.id, "in_progress");
    toast.success(`Consulta de ${apt.patient} iniciada`);
  };

  const handleComplete = (apt: Appointment) => {
    updateStatus(apt.id, "completed");
    toast.success(`Consulta de ${apt.patient} concluída`);
  };

  const handleBlock = (startTime: string, endTime: string, reason: string) => {
    // Generate blocked slots in 30min intervals
    const newBlocks: Appointment[] = [];
    let [h, m] = startTime.split(":").map(Number);
    let idx = agenda.length;
    while (`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` < endTime) {
      const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      newBlocks.push({
        id: `block-${idx++}`,
        patient: "--",
        service: reason || "Bloqueado",
        time,
        duration: 30,
        status: "blocked",
      });
      m += 30;
      if (m >= 60) { h++; m = 0; }
    }
    setAgenda((prev) => [...prev, ...newBlocks].sort((a, b) => a.time.localeCompare(b.time)));
  };

  const confirmAction = () => {
    if (!dialogState.aptId || !dialogState.action) return;
    const apt = agenda.find((a) => a.id === dialogState.aptId);
    if (!apt) return;
    if (dialogState.action === "cancel") {
      updateStatus(apt.id, "cancelled");
      toast("Marcação cancelada", { description: `${apt.patient} — ${apt.time}` });
    } else {
      updateStatus(apt.id, "no_show");
      toast("Registado como não compareceu", { description: `${apt.patient} — ${apt.time}` });
    }
    setDialogState({ open: false, action: null, aptId: null });
  };

  const getActions = (apt: Appointment) => {
    switch (apt.status) {
      case "confirmed":
      case "pending":
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary" title="Iniciar" onClick={() => handleStart(apt)}>
              <Play className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Cancelar" onClick={() => setDialogState({ open: true, action: "cancel", aptId: apt.id })}>
              <X className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-warning hover:text-warning" title="Não compareceu" onClick={() => setDialogState({ open: true, action: "no_show", aptId: apt.id })}>
              <UserX className="w-4 h-4" />
            </Button>
          </div>
        );
      case "in_progress":
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-success hover:text-success" title="Concluir" onClick={() => handleComplete(apt)}>
              <Check className="w-4 h-4" />
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  const dialogApt = dialogState.aptId ? agenda.find((a) => a.id === dialogState.aptId) : null;

  return (
    <Layout>
      <div className="container py-8 md:py-12">
        <div className="flex flex-col gap-4 mb-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Agenda Profissional</h1>
            <p className="text-muted-foreground text-sm">Dra. Ana Mendes · Medicina Geral</p>
          </div>
          <div className="flex justify-start md:justify-end">
            <BlockTimeDialog onBlock={handleBlock} />
          </div>
        </div>

        <Tabs defaultValue="today" className="space-y-6">
          <TabsList>
            <TabsTrigger value="today">Hoje ({agenda.filter((a) => a.status !== "blocked").length})</TabsTrigger>
            <TabsTrigger value="week">Semanal</TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            <div className="space-y-3">
              {agenda.map((apt, i) => {
                const isDimmed = apt.status === "blocked" || apt.status === "cancelled" || apt.status === "no_show";
                return (
                  <motion.div
                    key={apt.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`medical-card p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 ${isDimmed ? "opacity-50" : ""} ${apt.status === "in_progress" ? "ring-2 ring-primary/30 border-primary/40" : ""}`}
                  >
                    <div className="flex items-center gap-3 md:gap-4 min-w-0">
                      <div className="text-center min-w-[56px] md:min-w-[60px] shrink-0">
                        <p className="text-xl md:text-lg font-bold text-primary">{apt.time}</p>
                        <p className="text-[11px] md:text-[10px] text-muted-foreground">{apt.duration}min</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold md:font-medium text-base md:text-sm">{apt.patient}</p>
                        <p className="text-sm md:text-xs text-muted-foreground line-clamp-1">{apt.service}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-3 md:gap-2 shrink-0">
                      <span className={`px-2.5 md:px-2 py-1 md:py-0.5 rounded-full text-xs md:text-[10px] font-medium whitespace-nowrap ${statusConfig[apt.status].color}`}>
                        {statusConfig[apt.status].label}
                      </span>
                      {getActions(apt)}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="week">
            <WeeklyView appointments={agenda} weekOffset={weekOffset} onWeekChange={setWeekOffset} />
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={dialogState.open} onOpenChange={(open) => !open && setDialogState({ open: false, action: null, aptId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {dialogState.action === "cancel" ? "Cancelar marcação" : "Registar não comparecimento"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialogState.action === "cancel"
                ? `Tem a certeza que pretende cancelar a marcação de ${dialogApt?.patient} às ${dialogApt?.time}?`
                : `Registar que ${dialogApt?.patient} não compareceu à marcação das ${dialogApt?.time}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {dialogState.action === "cancel" ? "Cancelar marcação" : "Confirmar no-show"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
