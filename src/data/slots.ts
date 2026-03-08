export type SlotStatus = "available" | "selected" | "occupied" | "unavailable";

export interface TimeSlot {
  id: string;
  time: string;
  status: SlotStatus;
}

export function generateSlots(date: Date, serviceDuration: number): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const start = 8;
  const end = 18;
  const interval = serviceDuration >= 45 ? 60 : 30;
  let id = 0;

  for (let h = start; h < end; h++) {
    for (let m = 0; m < 60; m += interval) {
      if (h === end - 1 && m + interval > 60) continue;
      const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const rand = Math.random();
      const status: SlotStatus = rand < 0.3 ? "occupied" : rand < 0.35 ? "unavailable" : "available";
      slots.push({ id: `slot-${id++}`, time, status });
    }
  }
  return slots;
}
