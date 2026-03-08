export interface Practitioner {
  id: string;
  name: string;
  specialty: string;
  category: string;
  avatar: string;
  bio: string;
  unit: string;
}

export const practitioners: Practitioner[] = [
  { id: "doc-001", name: "Dra. Ana Mendes", specialty: "Medicina Geral e Familiar", category: "medicina-geral", avatar: "", bio: "20 anos de experiência em medicina geral.", unit: "Unidade Central" },
  { id: "doc-002", name: "Dr. Ricardo Silva", specialty: "Cardiologia", category: "cardiologia", avatar: "", bio: "Especialista em cardiologia de intervenção.", unit: "Unidade Central" },
  { id: "doc-003", name: "Dra. Sofia Marques", specialty: "Dermatologia", category: "dermatologia", avatar: "", bio: "Especialista em dermatologia clínica e estética.", unit: "Unidade Central" },
  { id: "doc-004", name: "Ft. João Ferreira", specialty: "Fisioterapia", category: "fisioterapia", avatar: "", bio: "Fisioterapeuta especializado em reabilitação desportiva.", unit: "Unidade de Fisioterapia" },
  { id: "doc-005", name: "Enf. Maria Costa", specialty: "Enfermagem", category: "enfermagem", avatar: "", bio: "Enfermeira com experiência em cuidados domiciliários.", unit: "Domicílio" },
  { id: "doc-006", name: "Dr. Paulo Santos", specialty: "Imagiologia", category: "imagiologia", avatar: "", bio: "Médico radiologista com vasta experiência.", unit: "Unidade de Imagiologia" },
  { id: "doc-007", name: "Dra. Carla Rodrigues", specialty: "Medicina Dentária", category: "dentaria", avatar: "", bio: "Especialista em ortodontia e implantologia.", unit: "Clínica Dentária" },
  { id: "doc-008", name: "Dr. Miguel Almeida", specialty: "Medicina do Trabalho", category: "ocupacional", avatar: "", bio: "Especialista em saúde ocupacional.", unit: "Unidade Ocupacional" },
];

export const getPractitionersByCategory = (category: string) =>
  practitioners.filter((p) => p.category === category);
