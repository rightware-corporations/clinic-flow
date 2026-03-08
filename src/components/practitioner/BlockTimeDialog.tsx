import { useState } from "react";
import { Ban, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface BlockTimeDialogProps {
  onBlock: (startTime: string, endTime: string, reason: string) => void;
}

const timeOptions: string[] = [];
for (let h = 8; h <= 18; h++) {
  for (let m = 0; m < 60; m += 30) {
    if (h === 18 && m > 0) continue;
    timeOptions.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

export default function BlockTimeDialog({ onBlock }: BlockTimeDialogProps) {
  const [open, setOpen] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");

  const validEndTimes = timeOptions.filter((t) => t > startTime);

  const handleSubmit = () => {
    if (!startTime || !endTime) {
      toast.error("Selecione o intervalo de tempo");
      return;
    }
    onBlock(startTime, endTime, reason);
    toast.success(`Horário bloqueado: ${startTime} — ${endTime}`);
    setOpen(false);
    setStartTime("");
    setEndTime("");
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Ban className="w-4 h-4" /> Bloquear Horário
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Bloquear Horário
          </DialogTitle>
          <DialogDescription>
            Selecione o intervalo de tempo que pretende bloquear na agenda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Select value={startTime} onValueChange={(v) => { setStartTime(v); if (endTime <= v) setEndTime(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Hora início" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.slice(0, -1).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fim</Label>
              <Select value={endTime} onValueChange={setEndTime} disabled={!startTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Hora fim" />
                </SelectTrigger>
                <SelectContent>
                  {validEndTimes.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {startTime && endTime && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{startTime} — {endTime}</span>
              {" "}será bloqueado na agenda de hoje.
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Motivo (opcional)</Label>
            <Input
              placeholder="Ex: Reunião, pausa, formação..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!startTime || !endTime}>
            Bloquear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
