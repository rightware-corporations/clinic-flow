# ClinicFlow — Arquitectura de Portais, RBAC e Experiências V1

> **Estado:** PROPOSTA DE ARQUITECTURA — estudo e contrato para discussão; não é autorização para processar dados clínicos reais.
> **Data:** 24-09-2026 (Moçambique).
> **Baseline auditada:** \`main@3ab234f5907f44c7b4e89681ebcaa2b1e402f422\`, após CF-B9.
> **Âmbito:** distinguir o operador do SaaS da gestão institucional, operação administrativa, prestação clínica e auto-atendimento do paciente. A arquitectura deve preceder a criação de novos ecrãs.

## 1. Resultado do estudo: 8 interfaces, não 8 sistemas

A proposta tem **8 experiências de utilização**: 7 autenticadas e 1 pública. A nona experiência, financeira, é uma extensão opcional futura. Os portais distinguem tarefas, informação, autenticação, navegação e acesso real; a partilha de frontend, domínio e design system é intencional.

| # | Portal | Principal | Âmbito de dados | Estado no baseline |
|---|---|---|---|---|
| 1 | Platform Console / SuperAdmin | Operador RIGHTWARE do SaaS | Metadados de tenants e operação da plataforma; nunca PHI por defeito | Demo órfão: /super com números e locais fictícios; sem role global no backend |
| 2 | Clinic Management | Gestor/proprietário da organização clínica | Organização e unidades autorizadas; pessoas/equipa, catálogo e KPIs administrativos | Parcial real: /admin, /catalogo, /equipa, /profissionais |
| 3 | Front Desk / Reception | Recepcionista e gestor de agendamento | Unidades autorizadas, identificação administrativa e agenda | Parcial real: /staff, /pacientes, /marcacoes |
| 4 | Clinical Workspace | Médico e profissional clínico habilitado | Consultas atribuídas, episódios e documentos da sua autoria | Parcial real: /profissional, /marcacoes, /relatorios |
| 5 | Nursing / Triage | Enfermeiros e triagem | Pacientes/episódios atribuídos; sinais vitais e notas de enfermagem | Ainda não implementado |
| 6 | Patient Portal | Paciente verificado, futuramente representante legal | Apenas a sua ficha associada e dados explicitamente publicados | Placeholder /paciente; nenhuma ligação segura user->patient |
| 7 | Supervised Intern | Interno/estagiário + supervisor | Só tarefas e episódios especificamente delegados | Placeholder /interno; não existe motor de supervisão |
| 8 | Public Experience | Visitante | Conteúdo publicado e eventual pedido de reserva | /agendar e catálogo públicos ainda são demonstrações |

**A futura nona área** (Finance/Back Office) possui papéis e políticas próprios: caixa, facturas, pagamentos, seguros e conciliação. Não é um privilégio implícito de recepcionista nem exige acesso à ficha clínica.

## 2. Auditoria verificável do repositório

- \`V1__identity_tenancy_clinics_catalog.sql\`: um utilizador por email, uma membership \`(tenant_id,user_id)\` com **um único papel** por organização. Papéis actuais: \`CLINIC_ADMIN\`, \`RECEPTION\`, \`PRACTITIONER\`, \`INTERN\`, \`PATIENT\`; não existe \`PLATFORM_ADMIN\` ou \`NURSE\`.
- \`TenantAccessService\`: a função \`requireMembership\` valida conta habilitada + membership activa + organização activa; \`requireClinicAdmin\` só valida \`CLINIC_ADMIN\`; a pesquisa administrativa de pacientes é limitada a admin/recepção.
- \`IdentityController\`: \`/api/v1/me\` devolve memberships de tenants activos; autenticação global existe, mas identidade/autorização de operador da plataforma não.
- \`App.tsx\`: \`/super\` usa \`allowedRoles=["platform"]\`. \`ProtectedRoute.tsx\` mapeia os cinco papéis do backend para cinco papéis legacy, **não tem platform**, pelo que esse painel não dispõe actualmente de um fluxo legítimo de acesso.
- \`SuperDashboard.tsx\`: contém estatísticas e unidades fixas de Lisboa, Porto e Faro. NÃO reutilizar como a interface oficial do SuperAdmin e não apresentar esses números como dados reais.
- \`DashboardLayout.tsx\`: um \`switch(role)\` gera todas as sidebars dentro do mesmo shell; precisa ser dividido em layouts orientados ao trabalho, não apenas renomeado.
- CF-B5/B6/B7/B8/B9 disponibilizam backend e algumas páginas reais para agendas, relatórios privados, convites, dashboards e catálogo. O portal do paciente, triagem, supervisão e experiência pública de reserva ainda não possuem contratos funcionais equivalentes.
- Um único tenant pode já ter várias \`clinic_units\`. Não confundir \`organization\` (cliente/tenant comercial) com \`clinic_unit\` (unidade física ou local de trabalho) nem com \`practitioner\`.

**Fontes da auditoria:** ficheiros concretos em
https://github.com/rightware-corporations/clinic-flow/tree/3ab234f5907f44c7b4e89681ebcaa2b1e402f422/

## 3. Modelo de âmbitos: não usar apenas o papel

**Hierarquia de autoridade, sem herança de dados clínicos:**

\`PLATFORM -> ORGANIZATION/TENANT -> CLINIC_UNIT -> CARE_TEAM/ENCOUNTER -> INDIVIDUAL PATIENT\`.

São **âmbitos**, não uma pirâmide onde acesso superior dá acesso a tudo:
- PLATFORM_ADMIN administra subscrições, quotas, activação, configuração global, segurança e suporte da plataforma. Não recebe poderes implícitos para ver processos clínicos, nomes de pacientes ou conteúdo de notas.
- CLINIC_ADMIN gere a operação comercial e institucional da sua organização e das unidades abrangidas. Não recebe automaticamente leitura do corpo de notas clínicas.
- UNIT_MANAGER, se necessário, limita-se a unidades atribuídas e indicadores administrativos.
- RECEPTION consulta identificação administrativa mínima, serviços, disponibilidade, agendas e filas das suas unidades. Não acede a diagnósticos, tratamentos, notas clínicas ou adendas.
- PRACTITIONER opera apenas como profissional habilitado e, para conteúdo clínico, sobre episódios em que exista relação assistencial verificada; o vínculo não advém simplesmente de pertencer à clínica.
- NURSE opera triagem e Observations de enfermagem nos episódios atribuídos; não pode assinar o documento original do médico.
- INTERN não tem leitura geral de processos, nem mesmo "read-only", até existir supervisor, delegação por episódio, finalidade e auditoria.
- PATIENT só consulta os seus dados após vinculação \`user_id -> patient_id\` verificada e política de divulgação; eventual representante tem outro vínculo, temporal e revogável.
- PUBLIC só consulta dados deliberadamente publicados. Pedido de reserva não significa acesso ou escrita de dados clínicos.

Adoptar **RBAC + ABAC + relação ao objecto (ReBAC)**: papel activo, tenant activo, unidade atribuída, profissional que presta o cuidado, episódio, estado do episódio, finalidade e consentimento/divulgação quando aplicável. A negação é a regra por defeito. O frontend oculta funções inadequadas por usabilidade; **cada endpoint, query e acção transaccional reafirma a autorização**.

### 3.1 Modelo de dados de acesso, evolução não destrutiva

Proposta (não migrar sem preparar contratos e fixtures):
- \`platform_operator_grants(user_id, platform_role, active, mfa_verified_at, ...)\`: separação total do tenant; usar identidades de operador administradas e protegidas.
- Manter \`tenant_memberships\` para a ligação básica tenant-actor, mas migrar o **papel único** para \`tenant_role_grants(tenant_id,user_id,role,unit_id?,active,...)\` ou equivalente, permitindo múltiplas funções reais e escopo por unidade.
- \`practitioner_profiles\` continua a representar a qualificação e os serviços/locais; isso NÃO é, por si só, um grant para ler todas as fichas.
- \`encounters\`, \`encounter_care_team\`, \`care_relationship_grants\`, \`supervision_assignments\`: relação explícita com cada episódio.
- \`patient_account_links(user_id,tenant_id,patient_id,verification_status,verified_by,...)\` e futuros representantes.
- \`authorization_audit\`/audit_events sem conteúdo clínico, registando ator, acção, recurso, tenant, unidade, resultado e finalidade quando necessário.

**Compatibilidade:** preservar todas as memberships e agendas actuais; migrar dados existentes com testes de equivalência, sem \`DROP\` destrutivo e sem assumir que um utilizador só pode trabalhar numa clínica.

## 4. Portal por portal: tarefas e desenho da informação

### 4.1 Platform Console — começar por aqui

**Identidade:** \`PLATFORM_SUPERADMIN\` gerido fora das memberships clínicas. O operador pode ter também uma conta clínica, mas deve seleccionar contexto explicitamente: nunca somar silenciosamente grants.

**Ecrã inicial:** estado operacional verificável: tenants activos/suspensos, tentativas falhadas de provisionamento, eventos de segurança, saúde de serviços, estado de planos e incidentes. Só métricas reais, com período e origem conhecidos.

**Navegação proposta:** Visão geral; Organizações; Planos/subscrições; Provisionamento; Funcionalidades/quotas; Operação/saúde; Auditoria da plataforma; Suporte; Definições de segurança.

**Fluxo principal:** criar organização -> atribuir plano e limites -> definir região/timezone/moeda da organização -> emitir onboarding para o primeiro gestor da clínica -> activar tenant -> observar health checks. Suspender organização requer política definida para não interromper serviços clínicos em curso de forma insegura.

**Proibições:** não ver fichas de pacientes, agendas nominativas, diagnósticos, notas nem fotografias médicas por defeito; não copiar dados de uma clínica para outra; não usar "entrar como utilizador" livre de autorização. Suporte técnico deve trabalhar inicialmente com logs técnicos minimizados, IDs pseudónimos e autorização institucional, sem impersonação clínica. Qualquer futuro acesso de emergência deve ser um procedimento separado, temporário, justificado e auditado, após revisão jurídica/segurança.

**Não aceitar o actual \`SuperDashboard.tsx\` como prova de implementação.** Deve desaparecer da navegação operacional até a identidade global, API do tenant lifecycle e UI real estarem implementadas.

### 4.2 Clinic Management — gestor/proprietário

**Ecrã inicial:** próximas marcações, faltas, ocupação das unidades, total de profissionais e serviços activos; não mostrar conteúdo de relatórios.

**Navegação:** Resumo; Unidades; Serviços e especialidades; Equipa e convites; Profissionais e atribuições; Horários; Marcações; Pacientes — dados administrativos; Configurações da organização; Auditoria administrativa; facturação quando existir um módulo autorizado.

**Fluxos:** configurar unidade -> configurar catálogo -> convidar profissionais/recepção -> ligar profissional aos serviços/unidades -> atribuir disponibilidade -> verificar capacidade -> acompanhar indicadores. Operações de desactivação respeitam marcações activas e integridade histórica.

**Subperfil futuro:** UNIT_MANAGER recebe subset por unidade, não acesso automático a todas as filiais.

### 4.3 Front Desk — recepção e atendimento administrativo

**Ecrã inicial:** fila de chegadas HOJE e agenda por hora/unidade, pesquisa rápida, novos pedidos, faltas, cancelamentos e verificações pendentes.

**Navegação:** Hoje/Check-in; Agenda e marcações; Pacientes (identificação administrativa); Disponibilidade; Solicitações públicas pendentes; Fila/atendimento; Comunicações administrativas.

**Fluxo:** receber pedido -> localizar ou criar identidade administrativa sem duplicação -> escolher serviço/unidade/profissional elegível -> visualizar disponibilidade -> reservar atomicamente -> confirmar -> chegada/check-in -> eventual chamada para triagem -> entregar episódio à equipa assistencial. Não introduzir diagnóstico na recepção.

**Regra:** autorização para agendar não equivale a autorização para iniciar tratamento ou assinar relatório.

### 4.4 Clinical Workspace — médico / profissional habilitado

**Ecrã inicial:** minhas consultas hoje, pacientes em atendimento, documentos pendentes de finalização e mensagens clínicas atribuídas quando existir canal seguro.

**Navegação:** A minha agenda; Encontros clínicos; Pacientes sob os meus cuidados; Notas/relatórios; Planos de seguimento; Horários próprios; Perfil profissional.

**Fluxo:** aceitar consulta atribuída -> abrir/encontrar Encounter -> ler informação clínica autorizada relacionada com o episódio -> registar avaliação/diagnóstico/conduta -> guardar rascunho -> finalizar conforme habilitação -> acrescentar adenda em vez de reescrever documento assinado -> finalizar episódio. Prescrição/ordens médicas são módulos futuros separados com regras locais, não texto que a UI chama "receita válida".

### 4.5 Nursing / Triage — enfermeiro

**Ecrã inicial:** pacientes que chegaram e aguardam triagem, prioridade, tempos de espera e handoff pendente ao profissional.

**Navegação:** Fila de triagem; Sinais vitais; Registos de enfermagem; Tarefas atribuídas; Handoff; Os meus turnos.

**Fluxo:** chegada confirmada -> triagem por enfermeiro atribuído -> registar sinais vitais como observações estruturadas, autoria e hora -> classificar prioridade apenas dentro de protocolo clínico aprovado -> entregar ao médico/profissional designado. Enfermagem não altera relatório finalizado de outro autor.

**Gate:** criar papel e perfis próprios, verbos de autorização, registos de Observations e transição de episódios. Não acrescentar um simples tab "Enfermagem" ao dashboard de médico.

### 4.6 Patient Portal — paciente verificado

**Ecrã inicial:** próxima consulta e pedidos pendentes; só informações vinculadas e divulgáveis.

**Navegação:** Início; Minhas marcações; Pedir/reagendar; Meus documentos divulgados; Perfil; Preferências de comunicação; Autorizações/representantes quando legalmente aplicável; Suporte.

**Fluxo:** registo/invitação -> verificação de identidade -> vínculo explícito à ficha da clínica -> consultar seus dados -> pedir marcação/reagendamento -> obter confirmação -> receber documentos publicados, não automaticamente todos os rascunhos clínicos. Auto-agendamento precisa de regras de antiabuso, privacidade e conflitos antes de abrir ao público.

### 4.7 Supervised Intern — interno e supervisor

**Ecrã inicial:** tarefas delegadas, supervisor, estágio e actividades permitidas.

**Navegação:** Meu estágio; Casos atribuídos; Notas para revisão; Feedback do supervisor; Calendário de formação.

**Fluxo:** supervisor autoriza episódio e acção com validade -> interno produz nota de formação claramente identificada como pendente -> supervisor revê e aprova/rejeita -> histórico de autoria e auditoria. Nenhuma pesquisa geral de pacientes. Dados sintéticos devem ser usados para formação fora dos episódios autorizados.

**Gate:** sem vínculo de supervisão e aprovação de políticas, manter o portal desactivado como no CF-B8; não oferecer falsas consultas.

### 4.8 Public Experience — site e pedido de marcação

**Ecrã inicial:** identidade/configuração publicada pela clínica, serviços e profissionais públicos, localização e contacto.

**Navegação:** Clínica; Serviços; Profissionais públicos; Pedir marcação; Contactos; Privacidade.

**Fluxo:** encontrar clínica -> consultar catálogo público específico do tenant -> consultar opções publicáveis -> enviar pedido -> receber confirmação administrativa e instruções, quando a política estiver aprovada. O visitante não adquire conta interna por criar um pedido; os dados publicados vêm de um \`PublicCatalogProjection\` próprio, nunca do CRUD administrativo bruto.

**Gate:** o actual \`/agendar\` é demonstração. Quando a funcionalidade real chegar, distinguir \`REQUESTED\` da confirmação efectiva pelo backoffice e implementar limite de pedidos, validação e consentimentos adequados.

### 4.9 Extensão: Finance/Back Office

Separar sessão de caixa, factura, pagamento, seguro/convénios e reconciliação. Visibilidade administrativa suficiente para cobrar sem ler diagnóstico nem relatório clínico. Auditoria de alterações e operações de estorno; aprovação e cargos separados quando se justificar.

## 5. Experiências visuais distintas, design system partilhado

Implementação inicial no monorepo existente, com **um único Vite/React** e Spring Boot modular, sem 8 deployments nem 8 bases de dados. As páginas são distribuídas por portal e carregadas por rota; cada portal tem layout, sidebar e ecrã inicial próprios. Reutilizar botões, formulários, tabelas, feedback, identidade visual base, autenticação e componentes de acessibilidade.

Estrutura proposta (apenas direcção, não ficheiros existentes):
\`\`\`text
src/
  portals/
    platform/       layout + tenants + plans + operations + platform-audit
    management/     layout + units + catalog + team + capacity
    frontdesk/      layout + daily-queue + bookings + patient-registry
    clinical/       layout + my-agenda + encounters + reports
    nursing/        layout + triage + observations + handoffs
    patient/        layout + my-bookings + released-documents
    intern/         layout + delegated-cases + supervision
    public/         public-site + published-catalog + booking-request
  shared/
    ui/             accessible primitives, forms, typography, states
    auth/           session, explicit context switch, capabilities
    api/            typed resources, no role inference in client
    tokens/         product core + future tenant brand settings
\`\`\`

Rotas-alvo (conceito): \`/platform/*\`, \`/o/:tenantId/manage/*\`, \`/o/:tenantId/frontdesk/*\`, \`/o/:tenantId/clinical/*\`, \`/o/:tenantId/nursing/*\`, \`/o/:tenantId/intern/*\`, \`/patient/*\`, \`/c/:slug/*\`. Não alterar URLs actuais sem redirects explícitos e testes E2E. O **tenant no URL é contexto de navegação, não uma credencial**. Todas as queries e mutações repetem verificação no backend. Em múltiplas organizações/unidades, fornecer selector contextual de âmbito; trocar de tenant invalida caches React Query do anterior.

Cada área deve possuir wireframes de tarefa real: estados vazios, erros, permissões insuficientes, conectividade fraca, loading, conflitos de versão, procedimentos de confirmação, layout mobile, pesquisa e navegação por teclado. Não clonar um dashboard de cartões para todos os actores.

## 6. Ciclo clínico e fronteira Appointment vs Encounter

O FHIR distingue \`Appointment\` (reserva planeada de data/hora) de \`Encounter\` (actividade assistencial efectiva). Não usar mudanças de status em Appointment como substituto permanente de um modelo clínico de episódios.

\`\`\`text
PUBLIC REQUEST (optional)
    -> FRONT DESK: registration / identity validation / book
    -> APPOINTMENT: REQUESTED -> CONFIRMED
    -> ARRIVAL / CHECK-IN + OPERATIONAL QUEUE
    -> [NURSING: optional assigned triage + vital signs]
    -> ENCOUNTER START (assigned clinician)
    -> CLINICAL NOTE DRAFT -> FINALIZE -> immutable ADDENDA
    -> ENCOUNTER COMPLETE
    -> [PATIENT: published summary if disclosure policy allows]
    -> [FINANCE: separate administrative charge and reconciliation]
\`\`\`

Estado actual: CF-B5 colocou \`REQUESTED/CONFIRMED/IN_PROGRESS/COMPLETED/CANCELLED/NO_SHOW\` numa única tabela de appointments. A transição precisa ser **evolutiva, não destrutiva**: introduzir Encounter e fila/chegadas respeitando eventos existentes e report-to-appointment FKs; preservar documentos finalizados, auditoria, concorrência e compatibilidade dos endpoints internos até migração validada.

## 7. Matriz de autorização de referência (proposta)

Legenda: O=organização autorizada; U=unidade atribuída; E=episódio e relação assistencial; SELF=vínculo próprio verificado; PUB=informação publicada; —=negado por defeito.

| Operação | Platform | Clinic Admin | Reception | Clinician | Nurse | Patient | Intern |
|---|---|---|---|---|---|---|---|
| Gerir tenants/planos SaaS | PLATFORM | — | — | — | — | — | — |
| Gerir unidades/serviços | — | O | — | — | — | — | — |
| Convidar funcionários | — | O | — | — | — | — | — |
| Consultar identificações administrativas | — | O | U | E mínimo | E mínimo | SELF | E delegado mínimo |
| Criar/alterar agendamento | — | O | U | pedido próprio* | — | pedir apenas* | — |
| Check-in/gestão de fila | — | O | U | ver atribuídos | U triagem | SELF estado publicado | tarefas atribuídas |
| Ler ficha clínica/observações | — | — por defeito | — | E | E limitado | SELF divulgado | E delegado |
| Registar sinais vitais | — | — | — | E com habilitação | E | — | E delegado/pendente |
| Editar/finalizar relatório médico | — | — | — | E autor habilitado | — | — | — |
| Ver documentos publicados | — | — | — | E | E limitado | SELF | — |
| Auditoria plataforma | PLATFORM | — | — | — | — | — | — |
| Auditoria administrativa clínica | — | O | — | — | — | — | — |

\* Fluxos solicitáveis apenas depois de se definirem contratos e políticas de auto-agendamento. O médico não recebe poder irrestrito de agendar para terceiros por ser médico.

Condição universal: \`authorize(subject,tenant,role,unit,resource,action,careRelationship,recordState,purpose)\`. Em falha ou insuficiência de contexto: **DENY**. Negação de acesso não deve revelar a existência de uma ficha de outra clínica. Logs de acesso nunca incluem diagnósticos nem conteúdo dos relatórios.

## 8. Roadmap de implementação — começar no SuperAdmin

### F0 — Contracts & route inventory (read-only/sem regressão)
- Fixar este documento como DRAFT até validação conceptual.
- Mapear página/rota actual -> portal de destino -> backend real -> política de autorização -> estado (real/demo/placeholder).
- Preservar contratos de CF-B0–B9 e gerar um plano de redirects sem links quebrados.
- Criar matrizes actor/tarefa/dado/unidade/estado e wireframe atlas de cada área.
- Não apagar nem migrar automaticamente dados de localStorage antigos potencialmente introduzidos pelo utilizador.

### F1 — Platform foundation / primeira implementação
- Criar identidades/grants globais **separados** das memberships clínicas; onboarding inicial de operador e MFA de produção sujeito a validação.
- Criar endpoints reais: tenant overview, criação/provisionamento idempotente de organização, admin inicial por convite, alteração controlada de plano, estado e quotas; auditoria da plataforma.
- Nova \`PlatformLayout\` e páginas reais; desactivar a antiga /super com os dados fictícios e redireccionar de forma controlada.
- Garantir em testes que o operador da plataforma não acede a /api/v1/clinical-reports ou /api/v1/patients por privilégio global.

### F2 — Management + unit scope
- \`ManagementLayout\`, contratos de grupos de tarefas e settings por organização/unidade.
- Preservar CF-B9 e integrar fluxo completo organização -> unidade -> catálogo -> convite -> profissional -> horários.
- Resolver membership com vários papéis/unidades, sem conceder herança de superutilizador aos dados clínicos.

### F3 — Front Desk + arrival/queue
- \`FrontDeskLayout\`, agenda real e recepção organizada por tempo e unidade.
- Workflow de chegadas/check-in, fila, remarcação, no-show, confirmação e pedidos públicos recebidos.
- Diferenciar agenda administrativa de episódio clínico.

### F4 — Clinical Encounter
- \`ClinicalLayout\`, caso/episódio com atribuição de care team e histórico auditado.
- Preservar imutabilidade e assinatura dos relatórios CF-B6.
- Garantir que ficha clínica só é visível por care relationship comprovada, sem pesquisa irrestrita.

### F5 — Nursing + supervised interns
- Regras de papel NURSE, triagem, sinais vitais/Observation e handoff.
- Definir delegado/supervisor para INTERN por episódio e validade, revisão explícita.

### F6 — Patient + public booking
- Identidade verificada e account-to-patient link, política de representante e release de resultados.
- Publicação de catálogo a partir de projecções seguras e pedido de marcação com antiabuso.
- Fluxos mobile-first; não utilizar demo como se fosse uma marcação aceite.

### F7 — Finance, operations hardening, staging
- Finance como portal próprio quando o negócio exigir.
- Timezone por clínica, políticas de privacidade e retenção aplicáveis, backup/restore,
  recuperação, observabilidade, limitação de pedidos, performance e QA de acessibilidade.
- Railway staging + QA E2E com dados sintéticos antes de qualquer utilização clínica real.

## 9. Gates que bloqueiam cada portal

Cada área só poderá receber etiqueta operacional "REAL" quando cumprir:
- Rotas e navegação próprias; zero números inventados e acções sem persistência.
- Permissões deny-by-default testadas por papel, tenant, unidade e objecto.
- Uso de APIs reais e mensagens claras em loading/erro/403/409.
- Testes unitários, frontend, integração HTTP com PostgreSQL, lint, TypeScript, build.
- Teste negativo de cross-tenant, troca de unidade e switch entre papéis.
- Auditoria de leituras clínicas, alterações de permissões e decisões de acesso.
- Teste E2E manual/browsers para os fluxos completos, responsividade e teclado.
- Revisão específica da legislação e política de tratamento de informação clínica antes
  de inserir dados reais; testes de restauro e resposta a incidentes.

Em particular, **não** se aceita PLATFORM_ADMIN herdar CLINIC_ADMIN ou ler PHI,
RECEPTION ler diagnóstico, INTERN pesquisar prontuários sem supervisão, NURSE
finalizar relatório assinado por médico, PATIENT obter ficha por correspondência
de email/nome, nem nenhuma query cross-tenant apenas por manipular URL/header.

## 10. Decisões pendentes, conscientemente não presumidas

1. Modelo comercial: uma organização contratante com várias clínicas/unidades;
   se gestores de filiais recebem autonomia ou só acesso parcial.
2. Separação profissional CLINICIAN vs DOCTOR vs NURSE: habilitação e actos clínicos
   permitidos localmente; responsáveis clínicos e eventuais aprovadores.
3. Metodologia de verificação de patient-account link e representante, com idade/
   autorização conforme política e jurisdição.
4. Supervisor/interno: vínculo, duração, âmbito, revisão e utilização de casos reais.
5. Regras de agendamento e consentimento público e eventual pagamento antecipado.
6. País/região, fuso horário por unidade, moeda padrão, retenção, release de resultados
   e base legal de tratamento de dados médicos.
7. Incident/break-glass: se for previsto, quem aprova, janela, motivo, alertas,
   monitorização e revisão externa. Não implementar com acesso livre do operador.
8. Política de permissões financeiras e aprovação de reembolsos/estornos.

As questões não impedem desenhar os shells e contratos, mas **bloqueiam** funcionalidades
que impliquem acesso sensível antes de políticas aprovadas.

## 11. Referências externas: pesquisa, não alegação de conformidade

1. [HL7 FHIR — PractitionerRole](https://hl7.org/fhir/R5/practitionerrole.html):
   papel efectivo do profissional na organização, local e serviços.
2. [HL7 FHIR — Appointment](https://hl7.org/fhir/R5/appointment.html):
   planeamento do horário, recursos e participantes, distinto de actividades clínicas.
3. [HL7 FHIR — Encounter](https://hl7.org/fhir/R5/encounter.html):
   cuidado efectivamente prestado, ciclo de vida, chegada e triagem.
4. [HL7 FHIR — Observation](https://hl7.org/fhir/R5/observation.html):
   sinais vitais e resultados estruturados.
5. [HL7 FHIR — AuditEvent](https://hl7.org/fhir/R5/auditevent.html):
   registo de acessos, decisões de segurança e eventos de privacidade.
6. [OWASP — Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html):
   least privilege, deny-by-default, object-level authorization, ABAC/ReBAC.
7. [NIST SP 800-162](https://csrc.nist.gov/pubs/sp/800/162/upd2/final):
   combinar atributos do sujeito, recurso, acção, contexto e políticas.

O uso destas referências **não** significa que o ClinicFlow já suporte FHIR, cumpra
legislação local de dados médicos ou esteja pronto para produção clínica.
