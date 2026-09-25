import type { NursingMeasurements, NursingObservation } from "@/lib/clinicflow-api";

export const measurementFields: {key: keyof NursingMeasurements; label: string; unit: string; min: number; max: number; step: string}[] = [
  {key:"temperatureC",label:"Temperatura corporal",unit:"°C",min:-100,max:100,step:"0.01"},
  {key:"heartRate",label:"Frequência cardíaca",unit:"bpm",min:0,max:1000,step:"1"},
  {key:"respiratoryRate",label:"Frequência respiratória",unit:"resp./min",min:0,max:1000,step:"1"},
  {key:"spo2Percent",label:"Saturação periférica de oxigénio",unit:"%",min:0,max:100,step:"1"},
  {key:"systolicMmhg",label:"Pressão sistólica",unit:"mmHg",min:0,max:1000,step:"1"},
  {key:"diastolicMmhg",label:"Pressão diastólica",unit:"mmHg",min:0,max:1000,step:"1"},
];

export function emptyMeasurements(): NursingMeasurements {
  return {temperatureC:null,heartRate:null,respiratoryRate:null,
    spo2Percent:null,systolicMmhg:null,diastolicMmhg:null};
}
export function recordedAt(value: string | null): string {
  if (!value) return "Não registado";
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? "Data indisponível" : time.toLocaleString("pt-MZ");
}

export default function ObservationReview({note}:{note:NursingObservation}) {
  const measured=measurementFields.filter(field=>note.measurements[field.key]!==null);
  return <section className="space-y-5" aria-label="Registo de enfermagem">
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="border-t pt-3">
        <h3 className="text-sm font-semibold">Motivo referido</h3>
        <p className="mt-1 text-sm whitespace-pre-wrap break-words">
          {note.presentingConcern||"Não registado"}
        </p>
      </div>
      <div className="border-t pt-3">
        <h3 className="text-sm font-semibold">Observações da enfermagem</h3>
        <p className="mt-1 text-sm whitespace-pre-wrap break-words">
          {note.observationNotes||"Não registado"}
        </p>
      </div>
    </div>
    <div className="border-t pt-4 space-y-3">
      <h3 className="text-sm font-semibold">Medições registadas</h3>
      {measured.length===0?<p className="text-sm text-muted-foreground">
        Não foram registadas medições.
      </p>:<>
        <p className="text-xs text-muted-foreground">Momento da medição: {recordedAt(note.measuredAt)}</p>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {measured.map(field=><div key={field.key} className="rounded-md border p-3">
            <dt className="text-xs text-muted-foreground">{field.label}</dt>
            <dd className="mt-1 font-semibold tabular-nums">
              {note.measurements[field.key]} {field.unit}
            </dd>
          </div>)}
        </dl>
      </>}
    </div>
    <p className="text-xs text-muted-foreground">
      Estes valores são transcritos sem interpretação, alerta automático ou classificação de urgência.
    </p>
  </section>;
}
