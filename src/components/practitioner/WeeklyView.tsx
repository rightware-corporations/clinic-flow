import React, { useMemo, useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { format, startOfWeek, addDays, isSameDay, isToday } from "date-fns";
import { pt } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

type AppointmentStatus = "confirmed" | "pending" | "blocked" | "completed" | "in_progress" | "cancelled" | "no_show";

interface Appointment {
  id: string;
  patient: string;
  service: string;
  time: string;
  duration: number;
  status: AppointmentStatus;
  date?: string;
}

interface WeeklyViewProps {
  appointments: Appointment[];
  weekOffset: number;
  onWeekChange: (offset: number) => void;
}

const statusColors: Record<AppointmentStatus, string> = {
  confirmed: "bg-primary/15 border-primary/30 text-primary",
  pending: "bg-warning/15 border-warning/30 text-warning",
  blocked: "bg-muted border-border text-muted-foreground",
  completed: "bg-success/15 border-success/30 text-success",
  in_progress: "bg-info/15 border-info/30 text-info",
  cancelled: "bg-destructive/10 border-destructive/20 text-destructive opacity-50",
  no_show: "bg-destructive/10 border-destructive/20 text-destructive opacity-50",
};

const hours = Array.from({ length: 11 }, (_, i) => i + 8);

export default function WeeklyView({ appointments, weekOffset, onWeekChange }: WeeklyViewProps) {
  const isMobile = useIsMobile();
  const today = new Date();
  const weekStart = startOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 1 });
  const [mobileStartIdx, setMobileStartIdx] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart.toISOString()]
  );

  // Reset mobile index on week change
  useEffect(() => { setMobileStartIdx(0); }, [weekOffset]);

  const visibleDays = isMobile ? days.slice(mobileStartIdx, mobileStartIdx + 2) : days;
  const colCount = visibleDays.length;

  const weekLabel = `${format(days[0], "d MMM", { locale: pt })} — ${format(days[6], "d MMM yyyy", { locale: pt })}`;

  const getAptsForDay = (day: Date) => {
    if (isSameDay(day, today)) return appointments.filter(a => a.status !== "cancelled" && a.status !== "no_show");
    const dow = day.getDay();
    if (dow === 0 || dow === 6) return [];
    return appointments.filter(a => a.status === "confirmed").slice(0, 2);
  };

  const canPrev = mobileStartIdx > 0;
  const canNext = mobileStartIdx + 2 < 7;

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onWeekChange(weekOffset - 1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold capitalize">{weekLabel}</p>
          {weekOffset !== 0 && (
            <button onClick={() => onWeekChange(0)} className="text-xs text-primary hover:underline">
              Voltar a esta semana
            </button>
          )}
        </div>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onWeekChange(weekOffset + 1)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Mobile day navigation */}
      {isMobile && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            disabled={!canPrev}
            onClick={() => setMobileStartIdx((i) => Math.max(0, i - 2))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex gap-1 overflow-hidden flex-1 justify-center">
            {days.map((day, idx) => {
              const isVisible = idx >= mobileStartIdx && idx < mobileStartIdx + 2;
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setMobileStartIdx(Math.min(idx, 5))}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-colors min-w-[38px] ${
                    isVisible
                      ? isToday(day) ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      : isToday(day) ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <span className="capitalize">{format(day, "EEEEE", { locale: pt })}</span>
                  <span className="block text-[10px]">{format(day, "d")}</span>
                </button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            disabled={!canNext}
            onClick={() => setMobileStartIdx((i) => Math.min(5, i + 2))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Grid */}
      <div ref={gridRef} className={isMobile ? "" : "overflow-x-auto -mx-4 px-4"}>
        <div className={isMobile ? "" : "min-w-[700px]"}>
          {/* Day headers (desktop only — mobile has the pill nav above) */}
          {!isMobile && (
            <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-px mb-1">
              <div />
              {days.map((day) => {
                const today_ = isToday(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={`text-center py-2 rounded-t-lg text-xs font-medium ${
                      today_ ? "bg-primary/10 text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <span className="capitalize">{format(day, "EEE", { locale: pt })}</span>
                    <br />
                    <span className={`text-sm font-bold ${today_ ? "text-primary" : "text-foreground"}`}>
                      {format(day, "d")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Mobile day headers */}
          {isMobile && (
            <div className={`grid grid-cols-[48px_repeat(${colCount},1fr)] gap-px mb-1`} style={{ gridTemplateColumns: `48px repeat(${colCount}, 1fr)` }}>
              <div />
              {visibleDays.map((day) => {
                const today_ = isToday(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={`text-center py-2 rounded-t-lg text-xs font-medium ${
                      today_ ? "bg-primary/10 text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <span className="capitalize">{format(day, "EEE", { locale: pt })}</span>
                    <br />
                    <span className={`text-sm font-bold ${today_ ? "text-primary" : "text-foreground"}`}>
                      {format(day, "d")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Time grid */}
          <div
            className="gap-px border rounded-lg overflow-hidden bg-border grid"
            style={{ gridTemplateColumns: `${isMobile ? 48 : 60}px repeat(${colCount}, 1fr)` }}
          >
            {hours.map((hour) => (
              <React.Fragment key={`row-${hour}`}>
                <div className="bg-background py-3 px-1.5 text-[10px] text-muted-foreground text-right font-medium">
                  {String(hour).padStart(2, "0")}:00
                </div>
                {visibleDays.map((day) => {
                  const dayApts = getAptsForDay(day);
                  const hourApts = dayApts.filter((a) => parseInt(a.time.split(":")[0], 10) === hour);

                  return (
                    <div
                      key={`${day.toISOString()}-${hour}`}
                      className={`bg-background min-h-[48px] p-0.5 relative ${isToday(day) ? "bg-primary/[0.02]" : ""}`}
                    >
                      {hourApts.map((apt) => (
                        <motion.div
                          key={apt.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`rounded px-1.5 py-1 text-[10px] leading-tight border mb-0.5 truncate ${statusColors[apt.status]}`}
                          title={`${apt.time} — ${apt.patient}`}
                        >
                          <span className="font-semibold">{apt.time}</span>
                          <br />
                          <span className="truncate">{apt.patient}</span>
                        </motion.div>
                      ))}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
