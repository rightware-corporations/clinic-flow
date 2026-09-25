# CF-J01A — Fecho das lacunas da auditoria da PR #18

**Âmbito autorizado:** exclusivamente testes de concorrência PostgreSQL, falhas de fonte/auditoria e isolamento de profissional multi-clínica. Sem alterações de endpoints, RBAC, interface, contratos de domínio ou migrações.

## Evidência de regressão acrescentada

1. `PractitionerHandoffHttpIntegrationTest.concurrentOriginalReceiptAndCorrectionAreInvisibleUntilTheirTransactionCommits`: transacção escritora actualiza o recibo original e acrescenta correcção pendente; `CountDownLatch` mantém ambas as alterações não confirmadas até a leitura HTTP terminar. A leitura anterior ao commit deve mostrar exclusivamente o estado antigo; a posterior deve mostrar o novo estado e as contagens da correcção. `Future.get` e limites de 15 segundos impedem esperas indefinidas. Não testa todos os interleavings nem demonstra serialização de transacções: valida um cenário de visibilidade atómica sob PostgreSQL READ COMMITTED.
2. `PractitionerHandoffProjectionTest.aSourceTimeoutReturnsHttp503WithoutAuditOrFabricatedIndicator` e `anAuditWriteFailureReturnsHttp503AndNeverPublishesASnapshot`: MockMvc standalone, falhas injectadas `QueryTimeoutException` e `DataAccessResourceFailureException`. Confirmam HTTP 503, nenhuma resposta de estado de sucesso e ausência de auditoria no timeout. A falha de escrita da auditoria é injectada depois da leitura SQL. A atomicidade/rollback real de PostgreSQL não é testada nestes testes unitários.
3. `PractitionerHandoffHttpIntegrationTest.onePractitionerInTwoClinicsCannotCrossReadBySwitchingTenantHeader`: o mesmo actor tem membership e perfil activos em duas clínicas, cada uma com consulta própria. Ambas as leituras legítimas funcionam; trocar o cabeçalho de tenant entre as duas consultas devolve 404; auditorias permanecem no tenant correspondente.

## Limites e gates

- Apenas dados sintéticos. Os testes de integração dependem de PostgreSQL 16, Flyway V1–V11 e `mvn -B -f backend/pom.xml verify`.
- CI obrigatória: Maven verify/PostgreSQL 16; frontend lint, TypeScript, Vitest e build. Registar os resultados na PR após execução.
- Nenhuma aprovação para dados reais: governação clínica, privacidade/jurídico moçambicano, threat model, staging, backups e recuperação permanecem gates separados.
- A PR mantém-se Draft. A RIGHTWARE decide qualquer merge.
