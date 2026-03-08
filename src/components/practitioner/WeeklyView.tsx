import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { format, startOfWeek, addDays, isSameDay, isToday } from "date-fns";
import { pt } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

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
  const [selectedDayIndices, setSelectedDayIndices] = useState<number[]>([0, 1]);
  const [comboOpen, setComboOpen] = useState(false);

  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart.toISOString()]
  );

  // Reset selection on week change — default to today's pair if in range
  useEffect(() => {
    const todayIdx = days.findIndex((d) => isToday(d));
    const start = todayIdx >= 0 ? todayIdx : 0;
    setSelectedDayIndices([start, Math.min(start + 1, 6)]);
  }, [weekOffset]);

  // Selecting a pair: click any day to show that day + next
  const selectPair = (startIdx: number) => {
    const end = Math.min(startIdx + 1, 6);
    setSelectedDayIndices([startIdx, end]);
    setComboOpen(false);
  };

  const visibleDays = isMobile
    ? selectedDayIndices.map((i) => days[i]).filter(Boolean)
    : days;
  const colCount = visibleDays.length;

  const weekLabel = `${format(days[0], "d MMM", { locale: pt })} — ${format(days[6], "d MMM yyyy", { locale: pt })}`;

  const selectedLabel = isMobile
    ? selectedDayIndices.map((i) => format(days[i], "EEE d", { locale: pt })).join(", ")
    : "";

  const getAptsForDay = (day: Date) => {
    if (isSameDay(day, today)) return appointments.filter(a => a.status !== "cancelled" && a.status !== "no_show");
    const dow = day.getDay();
    if (dow === 0 || dow === 6) return [];
    return appointments.filter(a => a.status === "confirmed").slice(0, 2);
  };

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

      {/* Mobile day selector — Combobox */}
      {isMobile && (
        <Popover open={comboOpen} onOpenChange={setComboOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between h-10 text-sm capitalize">
              <span className="flex items-center gap-2 truncate">
                <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="truncate">{selectedLabel}</span>
              </span>
              <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder="Filtrar dias..." />
              <CommandList>
                <CommandEmpty>Sem resultados</CommandEmpty>
                <CommandGroup>
                  {days.map((day, idx) => {
                    const isSelected = selectedDayIndices.includes(idx);
                    const todayMark = isToday(day);
                    const label = format(day, "EEEE, d 'de' MMMM", { locale: pt });
                    return (
                      <CommandItem
                        key={idx}
                        value={label}
                        onSelect={() => toggleDay(idx)}
                        className="capitalize"
                      >
                        <Check className={cn("w-4 h-4 mr-2 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                        <span className={cn("flex-1", todayMark && "font-semibold text-primary")}>
                          {label}
                          {todayMark && <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">hoje</span>}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {/* Grid */}
      <div className={isMobile ? "" : "overflow-x-auto -mx-4 px-4"}>
        <div className={isMobile ? "" : "min-w-[700px]"}>
          {/* Day headers */}
          <div
            className="gap-px mb-1 grid"
            style={{ gridTemplateColumns: `${isMobile ? 48 : 60}px repeat(${colCount}, 1fr)` }}
          >
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
