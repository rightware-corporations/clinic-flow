# CLINICFLOW — HANDOFF PARA O AGENTE DE CÓDIGO

**RIGHTWARE · 25 de Setembro de 2026 · Transferência de responsabilidade de execução**  
**Estado:** HANDOFF / REVISÃO PENDENTE — NÃO AUTORIZA MERGE NEM NOVAS FEATURES  
**Projecto:** ClinicFlow, produto SaaS da RIGHTWARE  
**Repositório:** https://github.com/rightware-corporations/clinic-flow  
**Pasta de documentação:** https://drive.google.com/drive/folders/1xq0F1ooY7pdmDFfZve52gMSCklSIWnjR

## 0. Delimitação obrigatória de responsabilidades

**ChatGPT nesta conversa = arquitectura de visão do produto, product management e investigação.** As suas entregas daqui em diante são documentação, requisitos, jornadas, wireframes conceptuais, hipóteses, análise de mercado, critérios de aceitação e revisão funcional daquilo que o agente reportar. NÃO faz commits, edita controllers, cria branches, implementa backend/frontend, mexe em migrations nem executa merges sem uma alteração explícita desta decisão pelo utilizador.

**Agente de código = execução técnica.** É responsável por inspeccionar código e CI, identificar conflitos, planear alterações, implementar apenas requisitos aprovados pelo proprietário do produto, escrever testes, gerir branches/PRs, apresentar provas e preparar revisão. **A PR #18 não deve ser fundida automaticamente.** Se houver divergência entre um documento estratégico e o código actual, reporta-a antes de efectuar alterações.

**Proprietário do produto = utilizador / RIGHTWARE.** Aprova prioridades, âmbito de cada sprint, mudanças de segurança ou políticas clínicas, arquitectura permanente e integração de PRs. Uma proposta de R01–R05 ou de um handoff NÃO equivale à aprovação de implementação.

## 1. Porque existe este handoff

Durante as fases anteriores, a conversa de estratégia avançou inadvertidamente da arquitectura conceptual para uma implementação no backend. O proprietário determinou agora a separação: o agente de código assume toda a engenharia; a presente conversa mantém-se exclusivamente no estudo e desenho do produto.

**Não eliminar nem reconstruir esse trabalho:** a implementação CF-J01A existe numa branch isolada e numa PR Draft, preparada para revisão do agente. O objectivo imediato deste handoff é transferir-lhe o contexto de forma exacta e sem forçar integração.

## 2. Estado verificado no GitHub no momento deste handoff

| Item | Valor |
|---|---|
| Repo | `rightware-corporations/clinic-flow` |
| `main` | `0333baedafff4f4e46194970573bc8d159cebc31` |
| Última entrega integrada antes da documentação | CF-N03, PR #16, migrações V1–V11 |
| Documentação mestre integrada | PR #17; `docs/clinicflow/CLINICFLOW_MASTER_HANDOFF_2026-09-25.md` |
| Branch da mudança técnica pendente | `feat/cf-j01a-practitioner-handoff-read-model` |
| PR | #18, OPEN / DRAFT / NÃO MERGED |
| HEAD verificado da PR #18 | `e587435334fa9619321372b962be0e38cf605b89` |
| Commit anterior com implementação e documentação | `246716442d1bf4c828ac29781975d254c127a238` |
| Commits subsequentes | `c3caa03`: testes de revogação de membership/reatribuição de consulta; `e587435`: documentação de regressão e semântica temporal |
| CI `push` da PR no HEAD actual | `36177082283`: success |
| CI `pull_request` da PR no HEAD actual | `36177087170`: success |

**Estas referências são snapshots de 25/09/2026 e podem mudar.** Primeira obrigação do agente: verificar novamente os SHA de `main`, da PR e as execuções CI antes de qualquer acção. Não efectuar reset, force-push, cherry-pick especulativo nem reverter trabalho de outros agentes.

Links directos:
- PR #18: https://github.com/rightware-corporations/clinic-flow/pull/18
- Branch: https://github.com/rightware-corporations/clinic-flow/tree/feat/cf-j01a-practitioner-handoff-read-model
- CI push actual: https://github.com/rightware-corporations/clinic-flow/actions/runs/36177082283
- CI PR actual: https://github.com/rightware-corporations/clinic-flow/actions/runs/36177087170
- Handoff mestre `main`: https://github.com/rightware-corporations/clinic-flow/blob/main/docs/clinicflow/CLINICFLOW_MASTER_HANDOFF_2026-09-25.md
- Contrato CF-N03: https://github.com/rightware-corporations/clinic-flow/blob/main/docs/clinicflow/CF_N03_NURSING_CONTINUITY_ADDENDA_CONTRACT.md

## 3. O que já existe e não pode ser reconstruído por engano

A base integrada inclui autenticação Spring com sessão, CSRF e pertença a organizações; PostgreSQL/Flyway V1–V11; registo demográfico CRUD; catálogo de unidades, profissionais e serviços; horários e marcações transaccionais; relatórios médicos imutáveis e adendas; convites e papéis; chegadas e fila; interface de médico; enfermagem com unidades explicitamente atribuídas; observações da própria enfermeira; confirmação de recepção e histórico de correcções aditivas com recibos independentes. A API existente verifica escopo por tenant, profissional/autor e recurso. Não alargar acesso do administrador a conteúdo clínico.

**Portais lógicos da visão:** SuperAdmin, Admin da clínica, recepção, médico, enfermagem, interno supervisionado, paciente e público. Admin completo e SuperAdmin devem ser implementados por último; as operações mínimas existentes de provisionamento podem continuar.

**Stack actual (não substituir sem decisão):** Java 21, Spring Boot 4.1.1, JDBC/Security, PostgreSQL 16 em CI, Flyway, React/TypeScript/Vite, Vitest. PC local com 8 GB RAM: não impor Docker no desenvolvimento. Railway é proposta operacional, não staging homologado. Redis não é dependência obrigatória actual.

## 4. Transferência exacta da CF-J01A: implementação pendente

**Endpoint criado na PR #18:** `GET /api/v1/practitioner/handoffs/{appointmentId}`.

Finalidade: projectar, em leitura limitada e numa consulta SQL, informação operacional já existente nas tabelas de marcações, chegadas, observações de enfermagem e respectivas adendas. Exige identidade autenticada, pertença e perfil profissional activos, tenant correcto e atribuição actual da consulta ao médico autenticado. Não apresenta texto clínico, sinais vitais, diagnóstico, nomes de pacientes ou rascunhos da enfermeira. A leitura audita metadados sem reconhecer automaticamente uma nota.

Indicadores: `NO_CHECK_IN`, `NO_SUBMITTED_NOTE`, `ORIGINAL_RECEIPT_PENDING`, `CORRECTION_RECEIPTS_PENDING`, `ALL_RECEIPTS_RECORDED`, `INCONSISTENT`; erro de fonte devolve HTTP 503, não uma falsa ausência. `ALL_RECEIPTS_RECORDED` é **recepção documental apenas**; não significa revisão clínica, autorização de alta, conclusão de episódio ou segurança do paciente.

Ficheiros introduzidos na branch:
1. `backend/src/main/java/com/rightware/clinicflow/domain/clinical/PractitionerHandoffController.java`.
2. `backend/src/test/java/com/rightware/clinicflow/clinical/PractitionerHandoffHttpIntegrationTest.java`.
3. `backend/src/test/java/com/rightware/clinicflow/domain/clinical/PractitionerHandoffProjectionTest.java`.
4. `docs/clinicflow/CF_J01A_PRACTITIONER_HANDOFF_READ_MODEL.md`.

O HEAD actual inclui os testes de reatribuição da consulta e revogação da pertença (`c3caa03`) e uma actualização documental sobre semântica temporal (`e587435`), posteriores ao primeiro relatório arquivado no Drive. **Usar a PR actual, não um ZIP histórico, como verdade do código.** A PR mantém-se Draft apesar do CI verde. Não houve alteração às migrations V1–V11 na CF-J01A.

## 5. Missão inicial do agente de código — REVISÃO, não novas funcionalidades

Realizar auditoria não destrutiva da PR #18 no HEAD mais recente:

1. Comparar `main` actual e PR #18; verificar que os quatro ficheiros acima continuam a representar o diff funcional/documental.
2. Rever o SQL de projecção, o escopo de actor/tenant/consulta e o comportamento ao mudar a atribuição médica, suspender um tenant, desactivar um perfil ou revogar uma membership. Testar confidencialidade de DRAFT e privacidade da resposta.
3. Confirmar que correcções tardias alteram o indicador apenas quando existe fundamento e que a confirmação de leitura da nota original não reconhece automaticamente adendas.
4. Inspeccionar o tratamento de exceções, ausência de conteúdo clínico em auditoria/logs e política de cache. Verificar se erro de fonte nunca resulta em estado negativo enganador.
5. Rever testes MockMvc/PostgreSQL e unitários existentes; identificar lacunas reproduzíveis. Se houver defeito comprovado, apresentar relatório de risco e plano de reparação antes de alterar o código.
6. Confirmar os CI de branch e PR na revisão mais recente. Se fizer correcções autorizadas, executar novamente os gates e actualizar a PR. **Não fundir a PR sem aprovação explícita da RIGHTWARE.**
7. Entregar um relatório factual: `READY FOR REVIEW` ou `BLOCKED`, SHA, diffs, testes, riscos, questões para o Product Manager e eventual recomendação técnica de resolução (sem alterar decisões de produto por conta própria).

**Nenhuma nova feature está autorizada por este handoff.** CF-J01B (indicador visual no portal médico), CF-I01 (interno supervisionado), CF-P01 (vínculo do paciente), CF-W01 (booking público), FHIR, labs e Journey Engine configurável permanecem propostas cujo contrato/prioridade devem ser aprovados primeiro na vertente de Product Management.

## 6. Estratégia de produto: o que o agente deve entender, não implementar automaticamente

A RIGHTWARE investigou cinco frentes: R01 mercado/problema; R02 operações; R03 sistemas existentes; R04 mercado privado moçambicano; R05 inovação. **Hipótese estratégica ainda em validação:** o ClinicFlow poderá tornar-se uma plataforma premium de continuidade/coordenação operacional de cuidados que combina processos configuráveis, responsabilidades, evidência de execução, confirmação de recepção, gestão de excepções e integração com sistemas existentes. A evidência não demonstra ainda uma lacuna universal na concorrência nem intenção de compra de qualquer clínica. A proposta não é autorização para desenvolver toda uma suite laboratorial, process mining ou IA.

Documento estratégico: https://drive.google.com/file/d/1amOJ0UfGpLrifyarqTDXiDOL3ODSr7rB/view

Fase A (tese, evidências, arquitectura do problema, decisões): https://drive.google.com/file/d/1kJegwMhhVn6KSppRR9sOBNafD6fsLvLT/view

Fase B (auditoria e experiência sintética, NÃO código integrado): https://drive.google.com/file/d/1Bgk05GNIczVC5ET6eQUmPhNma-Yn9Q2l/view

Fase C (contrato J01, proposta API/SQL, gates, NÃO integração): https://drive.google.com/file/d/1JPrW1X-P3RCMvuo-mkHEYxC5C0UL3lPU/view

Fase D (relatório J01A do HEAD anterior + documentos): https://drive.google.com/file/d/19OSzBLSQgKzi_m30ylAFlgwOub05Q1zw/view

**Importante:** resultados de simulações sintéticas apenas demonstram o simulador; CI verde não constitui aprovação clínica ou de produção. Em investigação, separar documento original verificado, alegação secundária, inferência e hipótese.

## 7. Gates inegociáveis

- **Dados sintéticos apenas.** Não carregar pacientes reais nem activar a função para operação clínica real.
- Sem acesso clínico implícito para Admin, recepção, interno ou outros papéis. Acesso médico depende da relação assistencial actual; acesso de enfermagem depende da própria autoria e unidades activas.
- Preservar histórico clínico imutável e correcções aditivas. Confirmação de recepção ≠ validação médica.
- Não criar triagem automática, scores, diagnósticos, prescrições, acções de emergência nem interrupções automáticas de cuidados sem aprovação clínica e contratual.
- Migrações existentes são imutáveis; novos esquemas somente com especificação aprovada e versão posterior aditiva.
- Git: nenhuma mudança directa em `main`, sem force-push, sem merge automático, sem reescrever trabalho de outro agente.
- Gates por incremento autorizado: backend Maven verify/PostgreSQL16/Flyway; frontend lint/TS/Vitest/build quando aplicável; testes de papéis e cross-tenant; CI da branch e da PR; pós-merge CI apenas depois de autorização explícita.
- Produção ainda bloqueada por validação clínica local, privacidade/direito em Moçambique, segurança, ameaças, staging, browser smoke, backups/restauro, retenção e incident response.

## 8. Protocolo de colaboração entre agente de código e Product Manager

**Entrada do Product Manager para cada incremento:** problema a resolver, actores e âmbito, jornada e excepções, critérios de aceitação verificáveis, limites de privacidade/segurança, exclusões, prioridade e decisão formal de avançar.

**Saída esperada do agente:** auditoria do estado actual, dúvidas concretas que mudam o contrato, proposta técnica mínima, riscos, branch e PR Draft se autorizado, testes com resultados verificáveis, diff exacto, relatório READY FOR REVIEW/BLOCKED. Não anunciar «concluído» por uma simulação ou CI parcial.

**Pedidos que regressam ao Product Manager:** mudar ordem dos portais, activar novas permissões, alterar significado de um estado clínico, introduzir automatismos, expandir fluxos financeiros/laboratoriais, decidir FHIR/offline-first, interpretar evidência de mercado ou definir o MVP. O agente não resolve estas escolhas acrescentando funcionalidades por iniciativa própria.

## 8A. Local da revisão e da aprovação: critérios distintos

**Revisão de engenharia da CF-J01A:** [GitHub PR #18](https://github.com/rightware-corporations/clinic-flow/pull/18). O agente de código deve analisar o diff no HEAD mais recente, documentar problemas como review/comments nessa PR e apresentar ao proprietário um relatório técnico com testes e riscos. **Nenhuma aprovação técnica está implícita na publicação deste handoff, nem no sucesso da CI.**

**Aprovação do proprietário do produto (RIGHTWARE):** após receber o relatório do agente, o proprietário decide explicitamente se autoriza reparações propostas, a integração da PR #18, ou a devolve para alterações. A autorização de merge não equivale a aprovação de uso clínico, staging ou produção. O agente NÃO fará merge da PR #18 sem essa decisão explícita.

**Aprovação funcional de novos incrementos:** permanece na vertente Product Management, com documento de escopo, jornadas, privacidade, exclusões e critérios de aceitação, aprovado antes de qualquer novo desenvolvimento (CF-J01B, CF-I01, CF-P01, etc.).

**Alterações posteriores:** o SHA `e587435...` é uma referência temporal, não um commit a reverter para lá; reconfirmar sempre `main`, HEAD da PR e CI antes de actuar. Caso outro agente já tenha continuado a PR, rever o novo diff integral.

## 9. Prompt pronto a entregar ao agente

> Estás a assumir **exclusivamente a engenharia do ClinicFlow da RIGHTWARE**. Lê primeiro a versão do presente handoff em `docs/clinicflow/CLINICFLOW_HANDOFF_AGENTE_CODIGO_2026-09-25.md` na `main` e confirma também a secção de aprovação. Lê este handoff, o Master Handoff no repositório e a PR #18. O ChatGPT que preparou os documentos estratégicos deixou de efectuar trabalho no código: a tua responsabilidade técnica começa na auditoria e revisão da PR #18, ainda Draft. Primeiro confirma o HEAD actual de main, PRs abertas, CI e migrações; depois revê a implementação J01A, preserva tudo o que está em main e identifica defeitos reais com evidências e riscos. Não efectues merge nem comeces J01B, I01, P01, W01, laboratórios, IA ou Journey Engine sem autorização explícita da RIGHTWARE. Usa dados totalmente sintéticos, mantém RBAC por tenant/recurso e separa confirmação de recepção de avaliação clínica. Entrega um relatório com diff, estado de testes, dúvidas de produto e estado READY FOR REVIEW ou BLOCKED. O Product Manager enviará especificações aprovadas para os incrementos seguintes.

---

**Próxima entrega desta conversa de Product Management:** decidir, com base na investigação e nos oito portais aprovados, qual problema do ClinicFlow merece o próximo incremento, definir o contrato funcional e os critérios de aceitação e só então transferi-lo para execução técnica.
