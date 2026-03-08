export interface Service {
  id: string;
  name: string;
  slug: string;
  category: ServiceCategory;
  description: string;
  longDescription: string;
  duration: number; // minutes
  price?: number;
  requiresPreparation: boolean;
  preparationNotes?: string;
  requiredDocuments?: string[];
  unit: string;
  image: string;
  featured: boolean;
  practitionerCategory?: string;
}

export type ServiceCategory =
  | "consultas"
  | "especialidades"
  | "exames"
  | "analises"
  | "fisioterapia"
  | "enfermagem"
  | "vacinacao"
  | "domicilio"
  | "ambulancia"
  | "dentaria"
  | "ocupacional"
  | "outros";

export const categoryLabels: Record<ServiceCategory, string> = {
  consultas: "Consultas",
  especialidades: "Especialidades",
  exames: "Exames de Diagnóstico",
  analises: "Análises Clínicas",
  fisioterapia: "Fisioterapia",
  enfermagem: "Enfermagem",
  vacinacao: "Vacinação",
  domicilio: "Domicílio",
  ambulancia: "Ambulância",
  dentaria: "Medicina Dentária",
  ocupacional: "Medicina Ocupacional",
  outros: "Outros Serviços",
};

export const categoryIcons: Record<ServiceCategory, string> = {
  consultas: "Stethoscope",
  especialidades: "HeartPulse",
  exames: "ScanLine",
  analises: "TestTubes",
  fisioterapia: "Dumbbell",
  enfermagem: "Syringe",
  vacinacao: "Shield",
  domicilio: "Home",
  ambulancia: "Ambulance",
  dentaria: "Smile",
  ocupacional: "Briefcase",
  outros: "MoreHorizontal",
};

export const services: Service[] = [
  {
    id: "srv-001",
    name: "Consulta de Medicina Geral",
    slug: "consulta-medicina-geral",
    category: "consultas",
    description: "Consulta médica generalista para avaliação, diagnóstico e orientação clínica.",
    longDescription: "A consulta de Medicina Geral e Familiar é o primeiro contacto do paciente com o sistema de saúde. Nesta consulta, o médico realiza uma avaliação completa do estado de saúde, incluindo história clínica, exame físico e orientação terapêutica. Ideal para check-ups regulares, queixas gerais e encaminhamento para especialidades.",
    duration: 30,
    price: 45,
    requiresPreparation: false,
    requiredDocuments: ["Cartão de Cidadão", "Cartão de Utente"],
    unit: "Unidade Central",
    image: "/placeholder.svg",
    featured: true,
    practitionerCategory: "medicina-geral",
  },
  {
    id: "srv-002",
    name: "Cardiologia",
    slug: "cardiologia",
    category: "especialidades",
    description: "Avaliação e acompanhamento de doenças cardiovasculares.",
    longDescription: "A consulta de Cardiologia destina-se à avaliação, diagnóstico e tratamento de doenças do coração e sistema circulatório. Inclui avaliação de fatores de risco cardiovascular, interpretação de exames complementares e definição de plano terapêutico personalizado.",
    duration: 45,
    price: 75,
    requiresPreparation: false,
    requiredDocuments: ["Cartão de Cidadão", "Exames anteriores"],
    unit: "Unidade Central",
    image: "/placeholder.svg",
    featured: true,
    practitionerCategory: "cardiologia",
  },
  {
    id: "srv-003",
    name: "Eletrocardiograma (ECG)",
    slug: "eletrocardiograma",
    category: "exames",
    description: "Registo da atividade elétrica do coração para diagnóstico cardiovascular.",
    longDescription: "O Eletrocardiograma é um exame não invasivo que regista a atividade elétrica do coração. Permite detetar arritmias, isquemia miocárdica, alterações estruturais e outras condições cardíacas. É um exame rápido, indolor e fundamental no diagnóstico cardiovascular.",
    duration: 15,
    price: 25,
    requiresPreparation: true,
    preparationNotes: "Evitar cafeína 4 horas antes. Vestir roupa confortável.",
    requiredDocuments: ["Cartão de Cidadão", "Requisição médica"],
    unit: "Unidade Central",
    image: "/placeholder.svg",
    featured: true,
    practitionerCategory: "cardiologia",
  },
  {
    id: "srv-004",
    name: "Hemograma Completo",
    slug: "hemograma-completo",
    category: "analises",
    description: "Análise de sangue completa para avaliação geral do estado de saúde.",
    longDescription: "O Hemograma Completo é uma das análises mais pedidas na prática clínica. Avalia os glóbulos vermelhos, glóbulos brancos e plaquetas, permitindo detetar anemias, infeções, doenças hematológicas e monitorizar tratamentos.",
    duration: 10,
    price: 15,
    requiresPreparation: true,
    preparationNotes: "Jejum de 8-12 horas. Pode beber água.",
    requiredDocuments: ["Cartão de Cidadão", "Requisição médica"],
    unit: "Laboratório",
    image: "/placeholder.svg",
    featured: true,
    practitionerCategory: "analises",
  },
  {
    id: "srv-005",
    name: "Fisioterapia - Sessão",
    slug: "fisioterapia-sessao",
    category: "fisioterapia",
    description: "Sessão de reabilitação física personalizada.",
    longDescription: "As sessões de Fisioterapia são conduzidas por fisioterapeutas especializados, utilizando técnicas manuais, exercícios terapêuticos e equipamentos modernos para recuperação de lesões, reabilitação pós-cirúrgica e tratamento de dor crónica.",
    duration: 45,
    price: 40,
    requiresPreparation: true,
    preparationNotes: "Trazer roupa confortável e relatório médico.",
    unit: "Unidade de Fisioterapia",
    image: "/placeholder.svg",
    featured: true,
    practitionerCategory: "fisioterapia",
  },
  {
    id: "srv-006",
    name: "Vacinação COVID-19",
    slug: "vacinacao-covid",
    category: "vacinacao",
    description: "Administração de vacina contra COVID-19.",
    longDescription: "Serviço de vacinação contra COVID-19, incluindo avaliação pré-vacinal, administração e período de observação pós-vacinal de 30 minutos. Disponíveis as vacinas recomendadas pelo plano nacional de vacinação.",
    duration: 20,
    price: 0,
    requiresPreparation: false,
    requiredDocuments: ["Cartão de Cidadão", "Boletim de vacinas"],
    unit: "Centro de Vacinação",
    image: "/placeholder.svg",
    featured: false,
    practitionerCategory: "enfermagem",
  },
  {
    id: "srv-007",
    name: "Enfermagem ao Domicílio",
    slug: "enfermagem-domicilio",
    category: "domicilio",
    description: "Serviço de enfermagem no conforto do seu lar.",
    longDescription: "Serviço de enfermagem domiciliário para administração de medicação, pensos, colheitas, monitorização de sinais vitais e apoio a pacientes com mobilidade reduzida. Disponível em todo o concelho.",
    duration: 60,
    price: 55,
    requiresPreparation: false,
    requiredDocuments: ["Cartão de Cidadão", "Prescrição médica"],
    unit: "Domicílio",
    image: "/placeholder.svg",
    featured: true,
    practitionerCategory: "enfermagem",
  },
  {
    id: "srv-008",
    name: "Transporte em Ambulância",
    slug: "ambulancia",
    category: "ambulancia",
    description: "Transporte medicalizado para consultas e exames.",
    longDescription: "Serviço de transporte em ambulância para deslocação de pacientes a consultas, exames ou tratamentos. Equipada com material de emergência e acompanhada por técnicos qualificados.",
    duration: 0,
    price: 80,
    requiresPreparation: false,
    requiredDocuments: ["Cartão de Cidadão"],
    unit: "Base de Ambulâncias",
    image: "/placeholder.svg",
    featured: false,
    practitionerCategory: "emergencia",
  },
  {
    id: "srv-009",
    name: "Dermatologia",
    slug: "dermatologia",
    category: "especialidades",
    description: "Consulta especializada em doenças da pele, cabelo e unhas.",
    longDescription: "A consulta de Dermatologia é dedicada ao diagnóstico e tratamento de patologias da pele, cabelo, unhas e mucosas. Inclui rastreio de lesões pigmentadas, tratamento de acne, eczema, psoríase e outras condições dermatológicas.",
    duration: 30,
    price: 70,
    requiresPreparation: false,
    unit: "Unidade Central",
    image: "/placeholder.svg",
    featured: false,
    practitionerCategory: "dermatologia",
  },
  {
    id: "srv-010",
    name: "Ecografia Abdominal",
    slug: "ecografia-abdominal",
    category: "exames",
    description: "Exame de imagem do abdómen por ultrassom.",
    longDescription: "A Ecografia Abdominal utiliza ondas de ultrassom para visualizar os órgãos abdominais: fígado, vesícula, pâncreas, baço e rins. É um exame não invasivo, sem radiação, fundamental para o diagnóstico de diversas patologias abdominais.",
    duration: 30,
    price: 55,
    requiresPreparation: true,
    preparationNotes: "Jejum de 6 horas. Bexiga cheia (beber 1L de água 1h antes).",
    requiredDocuments: ["Cartão de Cidadão", "Requisição médica"],
    unit: "Unidade de Imagiologia",
    image: "/placeholder.svg",
    featured: true,
    practitionerCategory: "imagiologia",
  },
  {
    id: "srv-011",
    name: "Medicina Dentária - Consulta",
    slug: "medicina-dentaria",
    category: "dentaria",
    description: "Consulta de medicina dentária geral.",
    longDescription: "Consulta de avaliação da saúde oral, incluindo diagnóstico, plano de tratamento e orientação para higiene oral. Realizamos destartarização, restaurações, endodontia e cirurgia oral.",
    duration: 30,
    price: 40,
    requiresPreparation: false,
    unit: "Clínica Dentária",
    image: "/placeholder.svg",
    featured: false,
    practitionerCategory: "dentaria",
  },
  {
    id: "srv-012",
    name: "Medicina do Trabalho",
    slug: "medicina-trabalho",
    category: "ocupacional",
    description: "Exames de admissão, periódicos e ocasionais para empresas.",
    longDescription: "Serviço de Medicina do Trabalho para empresas, incluindo exames de admissão, exames periódicos e ocasionais. Cumprimos toda a legislação em vigor e emitimos fichas de aptidão.",
    duration: 45,
    price: 60,
    requiresPreparation: false,
    requiredDocuments: ["Cartão de Cidadão", "Ficha de identificação da empresa"],
    unit: "Unidade Ocupacional",
    image: "/placeholder.svg",
    featured: false,
    practitionerCategory: "ocupacional",
  },
];

export const getServicesByCategory = (category: ServiceCategory) =>
  services.filter((s) => s.category === category);

export const getFeaturedServices = () => services.filter((s) => s.featured);

export const getServiceBySlug = (slug: string) => services.find((s) => s.slug === slug);
