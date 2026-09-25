# CLINICFLOW — MASTER HANDOFF / CONTINUIDADE DE TRABALHO

**Versão:** 2026-09-25 · Handoff de continuidade, não reinício do projecto  
**Empresa:** RIGHTWARE · **Produto:** ClinicFlow  
**Repositório:** https://github.com/rightware-corporations/clinic-flow  
**Referência técnica auditada ANTES deste handoff:** `main@5cabdc0a5c3ef90fd57ec228f19e887ca879d18b`  
**Último incremento funcional integrado:** **CF-N03**, PR #16, 25/09/2026  
**Último CI `main` verificado:** https://github.com/rightware-corporations/clinic-flow/actions/runs/36168725121 — frontend PASS, backend PASS  
**Ficheiro de arranque para o próximo chat:** `docs/clinicflow/CLINICFLOW_NEXT_CHAT_PROMPT_2026-09-25.md`  
**IMPORTANTE:** Este documento é o ponto de continuidade do chat anterior, que ficou cheio. Antes de implementar, verificar novamente o HEAD actual de `main`, PRs abertas, mudanças de outras sessões e CI. Os HEADs aqui são um snapshot verificável, não uma autorização para reverter commits futuros.

## 0. Regra de leitura e fiabilidade

- `[VERIFICADO]`: confirmado no repositório/GitHub Actions no momento deste handoff.
- `[DECISÃO]`: orientação explícita aprovada pelo utilizador; prevalece sobre sugestões antigas.
- `[PENDENTE]`: ainda sem implementação, homologação ou evidência suficiente.
- `[HIPÓTESE]`: ideia de produto/arquitectura sujeita a investigação e validação, **não** backlog automaticamente aprovado.
- `[RELATÓRIO A VERIFICAR]`: informação oriunda de investigação externa; não promover a verdade factual sem verificar fontes primárias.
- Handoffs históricos em `docs/clinicflow/` descrevem o estado **na data do respectivo slice**, não necessariamente o estado actual. Em conflito, comparar com `main` actual, contrato mais recente e decisão expressa do utilizador.

## 1. Visão estratégica, âmbito e investigação

### 1.1 [DECISÃO] Posicionamento
- ClinicFlow é um mini-SaaS/ClinicFlow Core da RIGHTWARE para gestão clínica e jornadas de saúde, com CRUDs reais, capacidades por *engines*, segurança, DevOps e posterior personalização por clínica.
- Ambição do produto: **definir/destacar-se estruturalmente na categoria**, não copiar outro SaaS nem limitar a inovação ao catálogo dos concorrentes. Inteligência competitiva é informação de mercado, não o tecto da arquitectura.
- Proteger a diferenciação através de desenho das jornadas clínicas e operacionais, dados e capacidades sistemáticas; não inventar funcionalidades ou claims para marketing.
- Este estado funcional é engenharia incremental com dados sintéticos, **não** prova de adequação clínica, legal, comercial ou de lançamento.

### 1.2 [DECISÃO] Método de investigação
- Uma única pesquisa/relatório do Perplexity NÃO encerra a investigação. Fazer triangulação e verificação independente antes de fixar diferenciação, arquitectura avançada e alegações quantitativas.
- Não considerar entrevistas frias ou visitas exploratórias a clínicas moçambicanas desconhecidas como etapa obrigatória. O utilizador rejeitou esse método nesta fase pela sensibilidade dos processos internos e falta de confiança institucional.
- Preferir fontes públicas e oficiais moçambicanas, publicações científicas, documentação de sistemas abertos, normas publicamente disponíveis, observação ética de jornadas públicas e simulações com dados totalmente sintéticos. Não aceder a dados privados, não se fazer passar por paciente ou profissional.
- Perplexity = pesquisa e recolha; ChatGPT = leitura crítica/triangulação/arquitectura; RIGHTWARE = decisão e execução. Classificar cada afirmação como documento verificado, relato público, inferência ou hipótese.
- **As decisões de produto inovadoras NÃO foram automaticamente aprovadas** por aparecerem num relatório.

### 1.3 Fontes anteriores a recuperar quando necessárias
Os seguintes artefactos foram trabalhados em conversas anteriores, mas **não figuram entre os ficheiros listados em `docs/clinicflow/` no snapshot auditado**. Se o próximo chat não os tiver anexados nem no Project/Library, pedir acesso apenas quando forem essenciais à próxima pesquisa — não inventar o conteúdo integral:
1. `Relatório de Investigação_ Oportunidades para o Cl.pdf` (relatório inicial Perplexity; o nome exacto do upload pode variar).
2. `CLINICFLOW — R04_ ESTRUTURA E OPORTUNIDADES DO MER.pdf` (mapeamento preliminar do mercado/segmentos).
3. `CLINICFLOW — R05_ FRONTEIRAS DA INOVAÇÃO E ARQUITE.pdf` (hipóteses de inovação/arquitectura).
4. Documentos técnicos históricos no próprio repositório: `docs/clinicflow/CF_*.md`.

**[RELATÓRIO A VERIFICAR]** O primeiro relatório apresenta alegações como ~27 sistemas de informação em saúde em Moçambique, ~40% do tempo profissional gasto em registo, ~42% de duplicação de dados, custo anual estimado de USD 20 M e concentração de 63% de 224 unidades privadas em Maputo. NÃO publicar nem usar estes números como factos de mercado até inspeccionar metodologia, ano, população e fonte primária de cada número. A enumeração aqui é para facilitar a auditoria, não uma validação.

**[RELATÓRIO A VERIFICAR]** O R04 examina consultórios independentes, especialidades, policlínicas, centros de diagnóstico, redes e hospitais privados; menciona ICOR, Clídis, Centro Médico Embondeiro, Lenmed/Hospital Privado de Maputo, Beira Private Hospital e fornecedores PHC, O-Clinic, KHIS e Trusty. Nomes, maturidade digital e posicionamentos precisam de revalidação actual.

**[HIPÓTESE; NÃO APROVADO]** O R05 considera Journey Engine e process mining, Task Orchestrator/escalada, multi-tenancy metadata-driven, sincronização offline-first com resolução de conflitos e interoperabilidade FHIR-native. Não começar a implementá-los apenas por constarem do relatório. Priorizar evidência de problemas, segurança, custo de implementação e validação clínica.

## 2. Arquitectura, ambiente e restrições técnicas

| Dimensão | Estado e regra |
|---|---|
| Repo | `rightware-corporations/clinic-flow`; `main` autoritativa. |
| Backend | Java 21, Spring Boot 4.1.1, Spring MVC/JDBC/Security/Validation/Actuator. **Não** trocar stack sem decisão. |
| Persistência | PostgreSQL; Flyway V1–V11 em `backend/src/main/resources/db/migration/`; composite FKs com `tenant_id`. |
| Frontend | React 18 + TypeScript 5.8 + Vite 5, React Router, TanStack Query, Tailwind/shadcn-ui, Vitest. |
| CI | `.github/workflows/clinicflow-ci.yml`: PostgreSQL 16 no GitHub Actions, Maven verify; `npm ci`, ESLint, TS, Vitest e build. |
| Auth | Sessão Spring, cookie HttpOnly, CSRF nas mutações, pertença activa por tenant, permissões validadas no servidor. |
| Multi-tenant | Um utilizador pode ter pertenças em clínicas distintas; papel por tenant na base actual. Operações usam `X-Clinicflow-Tenant`, mas nunca confiam só no header. |
| Auditoria | Eventos na mesma transacção, sem payload clínico, texto livre ou token bruto. |
| Desenvolvimento | PC com **8 GB RAM**; **sem Docker local** como requisito. Java/PostgreSQL nativos e CI remota. |
| Railway | Destino de produção proposto, **deployment e staging não validados**. |
| Redis | Não está no runtime mínimo. Só adoptar com necessidade demonstrada de cache, rate-limiting ou sessões distribuídas. |
| Dados | **Sintéticos exclusivamente** até homologação clínica, privacidade, segurança e operações. |
| Git | Branches isoladas; PRs controladas pelo executor autorizado, sem aceitar PRs de terceiros por rotina; squash/merge não destrutivo, nunca force-push ou sobrescrita de `main`. |
| Quality gate | AUDIT → UNDERSTAND → PLAN → PRESERVE → IMPLEMENT → TEST → REPAIR → VERIFY → REPORT. |

**Não confundir:** O antigo README ainda se intitula "MED Clinica"; é herança do frontend e deverá ser actualizado de forma controlada. O site público e `/agendar` mantêm partes demonstrativas; não os declarar integrados ao backend sem auditoria. O browser usa a data do dispositivo em vários dashboards, embora V8 já configure timezone da organização, por defeito `Africa/Maputo`.

## 3. Portais e política de implementação

**[DECISÃO] Oito interfaces/portais lógicos** (a enumeração lógica coloca Admin primeiro, mas **o Admin completo e SuperAdmin são construídos por último**):
1. SuperAdmin global: supervisão do SaaS, organização e operações de plataforma — **completo pendente**.
2. Admin da clínica: configuração e gestão integral — **dashboard parcial e fundações mínimas já existentes; consolidar completo no fim**.
3. Recepção: pacientes administrativos, agenda, chegada e fila — implementado por slices.
4. Médico/Praticante: agenda própria, chegadas, relatórios clínicos, observações da enfermagem — implementado por slices.
5. Enfermagem: unidades atribuídas, chegadas limitadas, observações e correcções — CF-N01/N02/N03 integrados.
6. Interno/Estagiário: interface presente, mas funcionalidades clínicas intencionalmente bloqueadas até contrato de supervisão, vínculo à consulta e auditoria.
7. Paciente: interface presente, mas dados clínicos/marcações próprias bloqueados até associação **verificada** entre conta e registo de paciente e política de divulgação.
8. Público: website e experiência de agendamento demonstrativa; persistência pública real ainda não aprovada/concluída.

A ordem operacional já seguida foi Recepção → Médico → Enfermagem. **Não iniciar Admin completo apenas porque existem ecrãs e operações de provisionamento mínimas**. Não ampliar permissões implicitamente de um papel para outro.

## 4. Histórico integral de entregas [VERIFICADO]

Os PRs #1–#16 estão fechados como merged no snapshot de 25/09/2026; PR #16 é o último incremento funcional.

| Bloco | PR | Entrega |
|---|---:|---|
| CF-B1 | [#1](https://github.com/rightware-corporations/clinic-flow/pull/1) | Backend inicial, identidade, tenancy, sessão/CSRF, catálogo básico, Flyway V1, CI. |
| CF-B2 | [#2](https://github.com/rightware-corporations/clinic-flow/pull/2) | Registo demográfico CRUD com arquivo e versões, V2. |
| CF-B3 | [#3](https://github.com/rightware-corporations/clinic-flow/pull/3) | Profissionais, especialidades e atribuições a unidades/serviços, V3. |
| CF-B4 | [#4](https://github.com/rightware-corporations/clinic-flow/pull/4) | Agenda semanal, bloqueios e previews determinísticos, V4. |
| CF-B5 | [#5](https://github.com/rightware-corporations/clinic-flow/pull/5) | Marcações transaccionais, idempotência, versionamento e exclusões contra colisões, V5. |
| CF-B5B | [#6](https://github.com/rightware-corporations/clinic-flow/pull/6) | Agenda interna autenticada e marcações reais. |
| CF-B6 | [#7](https://github.com/rightware-corporations/clinic-flow/pull/7) | Relatórios médicos com rascunhos, finalização imutável, adendas, V6. |
| CF-B6B | [#8](https://github.com/rightware-corporations/clinic-flow/pull/8) | Interface de relatórios da autoria do médico. |
| CF-B7 | [#9](https://github.com/rightware-corporations/clinic-flow/pull/9) | Convites tenant-scoped com token único/expirável e onboarding, V7. Mais tarde alargados a NURSE em CF-N01. |
| CF-B8 | [#10](https://github.com/rightware-corporations/clinic-flow/pull/10) | Dashboards de papéis ligados a APIs reais; remoção dos dados simulados de áreas autenticadas alvo. |
| CF-B9 | [#11](https://github.com/rightware-corporations/clinic-flow/pull/11) | Ecrã Admin mínimo de unidades/serviços com desactivação segura; não é Admin final. |
| CF-R01 | [#12](https://github.com/rightware-corporations/clinic-flow/pull/12) | Check-in e fila WAITING/CALLED, bloqueios pós-chegada, timezone por clínica V8. |
| CF-C01 | [#13](https://github.com/rightware-corporations/clinic-flow/pull/13) | Sinais de chegada apenas para consultas do próprio médico. |
| CF-N01 | [#14](https://github.com/rightware-corporations/clinic-flow/pull/14) | Papel NURSE, convites, unidade explícita, chegadas limitadas e provisionamento, V9. |
| CF-N02 | [#15](https://github.com/rightware-corporations/clinic-flow/pull/15) | Observações da enfermagem, sinais vitais opcionais, submissão imutável, confirmação de recepção pelo médico, V10. |
| CF-N03 | [#16](https://github.com/rightware-corporations/clinic-flow/pull/16) | Histórico da própria enfermeira, correcções textuais aditivas imutáveis e recepção individual pelo médico, V11. |

**Snapshots de referência:**
- R01 `main@b88f871b407390d1b1907aacff618f0a39b438f8`.
- C01 `main@ce964e5a6b21b85b1aef58ab2699e644da09cf16`.
- N01 `main@af630b65258586050e27fba748851690438e5a9c`.
- N02 `main@8d018dd37e9d4ad71a07c93a04b69e71c140aff8`.
- **N03 `main@5cabdc0a5c3ef90fd57ec228f19e887ca879d18b`**.
- CI de N03 branch: `36168398552` PASS; PR: `36168474127` PASS; pós-merge `main`: `36168725121` PASS **frontend + backend**. As falhas temporárias nos commits intermédios de N03 (Jackson não declarado num teste, mock em testes React) foram reparadas **antes do merge**. Não tratar esses erros antigos como blockers activos sem reproduzir em `main`.

## 5. Modelo de dados / migrações que existem

`V1` identidade/tenant/unidades/serviços; `V2` pacientes; `V3` perfis e especialidades de profissionais; `V4` regras de disponibilidade e bloqueios; `V5` marcações e eventos; `V6` relatórios médicos, adendas e eventos imutáveis; `V7` convites; `V8` chegada e fila de recepção + `organizations.time_zone`; `V9` NURSE e atribuições de unidades; `V10` observações de enfermagem e estados/eventos; `V11` correcções textuais aditivas e recibos independentes.

Nunca alterar migrations já integradas para introduzir uma regra nova. Criar `V12+` aditiva, com plano de rollback operacional separado e testes de migração sobre PostgreSQL real. A integridade `(tenant_id, id)` e composite FKs é invariável. Não fazer hard-delete de originais clínicos.

## 6. Jornadas efectivamente implementadas

### 6.1 Recepção / marcações
- Admin/recepção gere registo demográfico, agenda interna, confirmação/cancelamento e check-in autorizado.
- A marcação CONFIRMED pode receber check-in no dia da clínica. Um check-in existente é idempotente e proíbe cancelamento, no-show e remarcação posteriores.
- A fila WAITING → CALLED regista actor/timestamp e versão optimista. A recepção não inicia consulta nem vê relatórios clínicos.
- Médico vê sinal de chegada apenas nas suas marcações. Falha de API mostra **indisponibilidade**, nunca falsa ausência.

### 6.2 Médico
- Agenda própria. Iniciar e concluir consulta continua no fluxo real de marcações.
- Relatórios da própria autoria: DRAFT editável → FINALIZED imutável com adendas append-only, ligados à consulta atribuída em progresso/concluída; sem acesso amplo ao registo de pacientes.
- Observação de enfermagem: médico atribuído apenas vê registo SUBMITTED/ACKNOWLEDGED; confirma **recepção**, não validação clínica. Correcções posteriores requerem recibos individuais.

### 6.3 Enfermagem CF-N01/N02/N03
- Entra por convite CLINIC_ADMIN; aceitação cria membership + nursing_profile; **zero acesso a chegadas sem atribuição explícita de unidades activas**.
- `/enfermagem`: chegadas mínimas das suas unidades, sem diagnóstico nem conteúdo de relatórios.
- `/enfermagem/observacoes/:appointmentId`: após check-in, autora cria DRAFT, regista queixa/nota e *medidas opcionais* com unidades fixas e timestamp, guarda com versão e submete. Não inferir valores não medidos; não calcular severidade.
- SUBMITTED é imutável no backend e PostgreSQL. ACKNOWLEDGED só atesta recepção pelo médico atribuído. A autora lê o original após COMPLETED **enquanto conserva unidade activa**; edição após a conclusão da consulta é bloqueada.
- `/enfermagem/historico`: histórico paginado, metadados mínimos, apenas observações da própria autora nas unidades actualmente atribuídas, incluindo consultas concluídas.
- `/enfermagem/historico/:appointmentId`: original e correcções; **adendas textuais** de 1–3000 caracteres, imutáveis, com UUID de idempotência, SHA-256 e actor/timestamp próprios. Repetição mesma chave/mesmo conteúdo devolve a entrada; mesma chave/outro conteúdo dá HTTP 409.
- `/profissional/observacoes-enfermagem/:appointmentId`: original e correcções posteriores, cada qual com recibo independente. Não apresentar “tudo recebido” porque apenas o original foi confirmado.
- Revogação de unidade/membership da enfermeira termina acesso ao conteúdo e ao histórico. Outra enfermeira, mesmo da mesma unidade, não herda autoria/leitura da nota.

### 6.4 Endpoints a localizar (não reconstruir)
- `/api/v1/auth/{login,logout,csrf}`, `/api/v1/me`, convites e aceitação.
- `/api/v1/patients`, unidades, serviços, profissionais e especialidades, scheduling/appointments e eventos.
- `/api/v1/reception/check-ins`, `/api/v1/reception/queue`, `/api/v1/practitioner/arrivals`.
- `/api/v1/clinical-reports` + elegibilidade/finalização/adendas.
- `/api/v1/admin/nursing-team` e `/.../{userId}/units`; `/api/v1/nursing/units`, `/api/v1/nursing/arrivals`.
- `/api/v1/nursing/observations` + `/{appointmentId}`, `/submit`, `/history`, `/history/{appointmentId}`, `/addenda`.
- `/api/v1/practitioner/nursing-observations/{appointmentId}` + `/acknowledge`, `/addenda`, `/addenda/{id}/acknowledge`.
- A fonte de verdade é o controller actual, não esta lista resumida.

## 7. Matriz de acesso em alto nível (não substituir por autorização client-side)

| Papel | Permitido hoje | Não inferir/conceder |
|---|---|---|
| CLINIC_ADMIN | CRUD administrativo do tenant, equipa/convites, catálogo, agenda, provisionamento de unidades da enfermagem, dashboard mínimo. | Notas da enfermagem e relatórios médicos por ser Admin. |
| RECEPTION | Demografia administrativa, agenda autorizada, check-in, fila e chamada. | Diagnósticos, relatórios e registos clínicos da enfermagem. |
| PRACTITIONER | Própria agenda, próprios relatórios, próprias chegadas, observações submetidas da sua consulta e correcções/recibos. | Notas de outro médico, DRAFT da enfermeira, registo geral de pacientes sem contrato. |
| NURSE | Chegadas de unidades activas atribuídas; apenas próprias notas/correcções; nenhuma leitura de relatórios médicos. | Todas as unidades, registo completo de pacientes, triagem automática ou qualquer diagnóstico. |
| INTERN | Dashboard restrito. | Consulta de dados clínicos sem supervisor/vínculo/auditoria explicitamente aprovados. |
| PATIENT | Dashboard restrito, perfil e links de demonstração. | Consultas, exames, prescrições ou outros registos sem identidade paciente verificada. |
| Global SuperAdmin | Layout/rota herdados; fundações de plataforma existentes. | Dashboard administrativo integral ou acesso arbitrário a conteúdo clínico. |
| Público | Landing/serviços/demo. | Public booking persistente ou acesso a recursos privados sem contratos novos. |

## 8. CHECKLIST — concluído e verificado

### Backend / estrutura
- [x] Repo existente auditado; backend Java/Spring e PostgreSQL/Flyway introduzidos.
- [x] Sessão, autenticação, CSRF, perfil e tenant membership server-side.
- [x] Segurança por tenant, composite FKs e audit trail básico sem conteúdos clínicos.
- [x] Registry demográfico CRUD com archive, permissões e optimistic locking.
- [x] Catálogo de profissionais/especialidades/unidades/serviços e atribuições.
- [x] Motor determinístico de disponibilidade/bloqueios e marcações transaccionais.
- [x] Exclusões no PostgreSQL para reduzir double booking e idempotência na criação.
- [x] Relatórios médicos DRAFT/FINALIZED imutáveis + adendas.
- [x] Convites seguros, roles de equipa e aceitação de NURSE.
- [x] Recepção check-in e WAITING/CALLED com conflitos/versionamento.
- [x] Fuso horário por tenant introduzido em V8, default Africa/Maputo.
- [x] Sinais de chegada restritos à agenda do médico.
- [x] Perfil de enfermagem, atribuição explícita de unidades activas e chegada limitada.
- [x] Observações de enfermagem e confirmação de recepção do original.
- [x] Histórico paginado de observações da autora, inclusive consultas concluídas.
- [x] Correcções de enfermagem textuais aditivas, idempotentes e imutáveis.
- [x] Recibo médico independente para cada correcção.
- [x] Migrações Flyway V1–V11 integradas.

### Frontend / integração
- [x] Login ligado ao backend e rotas protegidas por sessão/perfil verificados.
- [x] Registo demográfico, catálogo administrativo mínimo, equipa/convites e agenda interna reais.
- [x] Dashboard da recepção e fila de chegadas reais.
- [x] Dashboard do médico com chegadas/relatórios reais, observações da enfermagem e correcções.
- [x] Portal de enfermagem, editor de observações, histórico e editor de correcções.
- [x] Dashboard do interno e do paciente deixam claras as funções clínicas ainda indisponíveis; não mostrar dados fictícios como reais.
- [x] Erros de API/403/404/409 representados sem inventar resultados.
- [x] N03 corrigiu a expiração do cache React Query no desmontar do histórico, reduzindo persistência inadvertida de metadados de pacientes.

### Git e automação
- [x] PRs funcionais #1–#16 merged sem force-push.
- [x] CI remoto backend com PostgreSQL 16 e frontend lint/TypeScript/Vitest/build.
- [x] PR #16 branch CI PASS (`36168398552`).
- [x] PR #16 PR CI PASS (`36168474127`).
- [x] PR #16 post-merge main CI PASS **ambos** (`36168725121`).
- [x] Nenhum PR funcional aberto no snapshot imediatamente anterior a este handoff.

## 9. CHECKLIST — pendências reais / NÃO declarar prontas

### Segurança, clínica e operação (BLOCKERS de dados reais)
- [ ] Homologação do fluxo de enfermagem e validação de campos por direcção clínica local.
- [ ] Rever limites, unidades, idade/pediatria e procedimento de escalada com clínicos; **não** inventar regras de triagem/scores.
- [ ] Política de correcção, supervisão, assinatura e acesso de emergência explicitamente validada.
- [ ] Política de tratamento de dados em saúde/privacidade legal em Moçambique, confidencialidade e retenção.
- [ ] Threat model, gestão de credenciais, rate limit, MFA/recuperação, controlo de sessões e testes de segurança.
- [ ] Revisão de logs/telemetria e superfícies legadas quanto a PHI e dados introduzidos em localStorage.
- [ ] Browser/E2E com PostgreSQL local ou staging real, com dados sintéticos.
- [ ] Railway staging, migrations, secrets, HTTPS/cookies/proxy, health e smoke test.
- [ ] Backups e ensaio de restore, observabilidade, alertas, incident response, disponibilidade e plano de recuperação.
- [ ] Separação de ambientes e revisão operacional de timezone/DST, não confiar na data do dispositivo.
- [ ] Aprovar retenção/exportação dos registos clínicos e correcções (sem apagamento silencioso).
- [ ] Revisão clínica e privacidade ANTES de qualquer paciente real ou alegação de segurança clínica.

### Produto / portais seguintes (PROPOSTAS — confirmar ordem contra o HEAD)
- [ ] Auditoria do `main` actual, endpoints já implementados, UX real, cobertura de testes e TODOs; não reconstruir CF-N03.
- [ ] **CF-I01 candidato:** contrato de supervisão do Interno (vínculo supervisor–consulta–unidade, visibilidade mínima, actos autorizados, assinatura e auditoria); nenhum acesso clínico até aprovação.
- [ ] **CF-P01 candidato:** identidade e vínculo verificável conta–paciente por tenant; divulgação mínima e consentimento/política aprovados antes da área do paciente.
- [ ] **CF-W01 candidato:** converter descoberta de serviços e booking público demonstrativo em fluxo real seguro multi-tenant, com validação de identidade/anti-abuso e timezone.
- [ ] Completar jornada de médico quando houver necessidades clínicas validadas (não agregar privilégios por conveniência).
- [ ] Trabalhar notificações, lista de tarefas/engines e interoperabilidade **somente** após contratos/evidência, nunca presumir aprovação do R05.
- [ ] Admin completo da clínica e SuperAdmin **por último**, depois de se conhecerem os módulos operacionais definitivos.
- [ ] Refactor selectivo do frontend herdado, README `MED Clinica`, identidade ClinicFlow aprovada e remoção segura de demos; não apagar localStorage legado com eventuais dados sem política explícita.
- [ ] Métricas agregadas reais para volumes acima do limite da API (dashboard actual não deve fingir precisão se >1000 entradas).

### Investigação de produto (paralela à engenharia; pendente)
- [ ] Ler criticamente relatórios inicial/R04/R05 e recuperar links e citações primárias.
- [ ] Validar data, população e método das alegações numéricas do primeiro relatório.
- [ ] Separar dores comprovadas, hipóteses e diferenciação defensável.
- [ ] Examinar documentação pública de SIS-RME, padrões e sistemas open-source pertinentes, sem acesso indevido.
- [ ] Criar matriz de evidências problema → fonte → implicação → risco → possível solução.
- [ ] Seleccionar diferenciação por benefício estrutural mensurável, não por semelhança competitiva.
- [ ] Testes com dados sintéticos e cenários operacionais; não exigir entrevistas frias a clínicas desconhecidas.

## 10. Próxima sessão — ordem de execução segura

1. **Não começar do zero.** Abrir este ficheiro e `docs/clinicflow/CLINICFLOW_NEXT_CHAT_PROMPT_2026-09-25.md`.
2. Usar o conector GitHub para recuperar `main` actual, últimos 10 commits, PRs abertas e CI do HEAD. Confirmar se `main@5cabdc0...` continua no histórico; este handoff poderá já ter sido mergeado acima dele.
3. Ler `docs/clinicflow/CF_N02_NURSING_OBSERVATIONS_CONTRACT.md` e `CF_N03_NURSING_CONTINUITY_ADDENDA_CONTRACT.md`, código dos controllers, V10/V11 e testes. Identificar apenas dívidas **reais no estado actual**, não reabrir falhas de commits intermédios já corrigidas.
4. Fazer auditoria orientada à segurança do fluxo N03, especialmente concorrência/idempotência, mudança de unidade/médico, submissão/correcção, isolamento do cache e disclosures. Corrigir achados reproduzíveis em branch independente, com teste de regressão.
5. Em seguida desenhar o contrato do **Interno supervisionado** como próximo portal lógico candidato. Atribuições clínicas e supervisão requerem validação; contrato e ecrãs de estado podem preceder operações clínicas.
6. Desenvolver a menor fatia coerente autorizada; branch desde o `main` actual; testes backend + frontend, PR Draft, branch CI + PR CI, review, squash merge não destrutivo, main CI pós-merge, handoff actualizado.
7. Se a próxima tarefa for estratégia/investigação, não misturar hipóteses R04/R05 com funcionalidades aprovadas; verificar primeiro as fontes e devolver relatório de evidência.
8. Fechar cada execução com `MERGED + MAIN CI PASS`, `READY FOR REVIEW` ou `BLOCKED`, incluindo PR/HEAD/run IDs, o que foi feito, o que não foi testado e próximo item. Nunca afirmar trabalho assíncrono.

## 11. Leituras de referência no repositório

**Arquitectura / plataforma:** `CF_B0_B1_EXECUTION_HANDOFF.md`; `CF_B2_PATIENTS_CRUD_HANDOFF.md`; `CF_B3_PROFESSIONAL_CATALOG_HANDOFF.md`; `CF_B4_SCHEDULING_FOUNDATION_HANDOFF.md`; `CF_B5B_INTERNAL_APPOINTMENTS_UI_HANDOFF.md`; `CF_B6_CLINICAL_REPORTS_IMPLEMENTATION.md`; `CF_B6B_CLINICAL_REPORTS_FRONTEND_HANDOFF.md`; `CF_B7_SECURE_INVITATIONS_HANDOFF.md`; `CF_B8_ROLE_DASHBOARDS_HANDOFF.md`; `CF_B9_CLINIC_CATALOG_HANDOFF.md`.

**Portais operacionais:** `CF_R01_RECEPTION_CHECKIN_QUEUE_HANDOFF.md`; `CF_C01_PRACTITIONER_ARRIVALS_HANDOFF.md`; `CF_N01_NURSING_ASSIGNED_UNITS_HANDOFF.md`; `CF_N02_NURSING_OBSERVATIONS_CONTRACT.md`; `CF_N03_NURSING_CONTINUITY_ADDENDA_CONTRACT.md`.

**Código:** `backend/src/main/java/com/rightware/clinicflow/`, `backend/src/main/resources/db/migration/`, `backend/src/test/java/com/rightware/clinicflow/`, `src/App.tsx`, `src/lib/clinicflow-api.ts`, `src/pages/`, `src/test/`, `.github/workflows/clinicflow-ci.yml`.

**PRs de ponta:** https://github.com/rightware-corporations/clinic-flow/pull/14, https://github.com/rightware-corporations/clinic-flow/pull/15, https://github.com/rightware-corporations/clinic-flow/pull/16.

## 12. Axiomas de continuidade / anti-regressão

- **Código actual e CI têm precedência** sobre resumos antigos; a intenção do utilizador e os gates clínicos mantêm-se vinculativos.
- **NÃO** fundir papéis; o `tenant_id`, a autoria e a relação de cuidado são obrigatórios.
- **NÃO** chamar triagem automática ao simples armazenamento de sinais vitais; nem admitir diagnósticos ou scores criados pela aplicação.
- **NÃO** substituir o original clínico com correcção; é sempre entrada aditiva rastreável.
- **NÃO** equiparar `ACKNOWLEDGED` a revisão médica ou assinatura clínica.
- **NÃO** fabricar números, agendamentos, chegadas, pacientes, relatórios, métricas ou resultados de teste.
- **NÃO** activar dados reais ou produção por CI verde isoladamente.
- **NÃO** aceitar automaticamente PRs de terceiros, fazer force-push ou tentar escrever num disco Windows a partir de sandbox.
- **NÃO** exigir Docker local; usar GitHub Actions/PostgreSQL 16 para gates reproduzíveis.
- **SIM:** investigar independentemente, validar cada decisão, aproveitar os módulos existentes, implementar com isolamento e auditoria, testar, reportar estado real e preservar o histórico Git.

---
**Este documento foi escrito para transferência de contexto entre chats. Quando abrir nova conversa, começar pelo prompt companheiro abaixo, apontando para o `main` actual e para este handoff.**
