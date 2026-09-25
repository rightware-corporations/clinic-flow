# ClinicFlow — CF-R01 Recepção: chegada e fila

Estado: implementação em branch `feat/cf-r01-reception-checkin-queue`; integrar apenas após CI frontend e backend PASS. Dados sintéticos apenas.

## Contrato entregue
- `POST /api/v1/reception/check-ins` regista uma chegada à marcação CONFIRMED de hoje, segundo `organizations.time_zone` (valor inicial `Africa/Maputo`).
- `GET /api/v1/reception/queue?date=YYYY-MM-DD&unitId=...` lista a fila administrativa da organização; filtro opcional de unidade. Nenhum conteúdo de relatórios clínicos.
- `POST /api/v1/reception/queue/{id}/call` passa `WAITING -> CALLED` com versão optimista, responsável e timestamp.
- A chegada é idempotente por `(tenant_id, appointment_id)`; check-in existente volta a devolver o mesmo registo.
- A transição `/appointments/{id}/cancel`, `/no-show` ou `/reschedule` fica bloqueada após check-in.
- O registo de chegada e a chamada geram eventos operacionais e eventos de auditoria no mesmo contexto transaccional.

## Autorizações e separação de responsabilidades
- `CLINIC_ADMIN` e `RECEPTION` podem consultar a fila, registar chegadas e chamar pacientes.
- `PRACTITIONER`, `INTERN` e `PATIENT` não herdam acesso ao módulo administrativo da recepção.
- O backend valida sessão, pertença activa e isolamento da organização em cada operação; CSRF obrigatório nas mutações.
- Check-in e chamada são operações administrativas. Não iniciam a consulta, não substituem triagem e não permitem ver relatórios.
- O profissional continua a iniciar e concluir a consulta pelo fluxo de marcações já existente.

## Interface
- Acesso autenticado `/recepcao/fila` a partir do portal da Recepção.
- Lista de marcações confirmadas ainda não chegadas; pesquisa; filtro de unidade; registo de chegada; fila real WAITING/CALLED; chamada.
- Métricas apenas derivadas da API; estados de carregamento, erro e vazio; não introduzir números simulados.
- O browser mostra a data no dispositivo; o servidor valida a data no fuso da organização.

## QA e limitações
- Testes backend: papéis indevidos, CSRF, tenant isolado, versão desactualizada, check-in duplicado, dia de atendimento, fila, bloqueio de cancelamento/no-show, chamada e auditoria.
- Testes frontend: API com cabeçalho de tenant/CSRF, página da fila, estados vazios e indisponibilidade.
- CI GitHub Actions: executar `npm ci`, lint, TypeScript, Vitest, build, PostgreSQL 16 + Flyway V1–V8 + `mvn verify`. Registar o resultado da execução no PR; não declarar PASS sem o confirmar.
- Smoke test real em browser, Railway staging, definição operacional do timezone de todas as organizações e revisão de privacidade/retention: NÃO EXECUTADOS.
- Não utilizar dados clínicos reais até conclusão de segurança, privacidade, backup/restore e homologação.

## Ordem futura aprovada
Continuar pelos portais operacionais e seus contratos. Consolidar a interface do Admin da clínica e do SuperAdmin no final, preservando as fundações de autenticação, autorização e auditoria desde agora.
