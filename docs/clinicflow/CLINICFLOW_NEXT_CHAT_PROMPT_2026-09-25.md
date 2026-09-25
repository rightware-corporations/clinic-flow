# ClinicFlow — PROMPT DE ARRANQUE PARA NOVO CHAT

Estamos a **continuar** o projecto ClinicFlow da RIGHTWARE porque a conversa anterior chegou ao limite. NÃO comece uma implementação do zero, não refaça o estudo ou os slices já merged, nem assuma que o estado do antigo chat é a versão mais recente de GitHub.

**Repositório GitHub:** https://github.com/rightware-corporations/clinic-flow

**LEITURA OBRIGATÓRIA — HANDOFF MESTRE:**  
https://github.com/rightware-corporations/clinic-flow/blob/main/docs/clinicflow/CLINICFLOW_MASTER_HANDOFF_2026-09-25.md

**Referência raw alternativa:**  
https://raw.githubusercontent.com/rightware-corporations/clinic-flow/main/docs/clinicflow/CLINICFLOW_MASTER_HANDOFF_2026-09-25.md

**Contratos mais recentes (ler depois do handoff):**
- https://github.com/rightware-corporations/clinic-flow/blob/main/docs/clinicflow/CF_N02_NURSING_OBSERVATIONS_CONTRACT.md
- https://github.com/rightware-corporations/clinic-flow/blob/main/docs/clinicflow/CF_N03_NURSING_CONTINUITY_ADDENDA_CONTRACT.md

**Estado confirmado à data do handoff (25/09/2026):** PRs #1–#16 merged. CF-N03 (histórico de observações e correcções aditivas imutáveis) foi integrado no \`main@5cabdc0a5c3ef90fd57ec228f19e887ca879d18b\`. Post-merge main CI \`36168725121\`: **backend PASS e frontend PASS**. O commit de documentação posterior irá alterar o HEAD sem substituir esse baseline.

## A sua missão ao receber este prompt

1. Use o conector GitHub para **ler na íntegra** o handoff mestre no \`main\` actual. Em seguida leia os contratos N02/N03 e os ficheiros do repo necessários.
2. Confirme o HEAD actual de \`main\`, PRs abertas, histórico recente, as 11 migrações, e o CI do HEAD. Qualquer divergência posterior ao handoff deve ser reconciliada; **não faça reset, force-push, recriação de features ou merge destrutivo**.
3. Assimile integralmente a estratégia, as decisões, os oito portais (Admin completo e SuperAdmin por último), o método de investigação independente, os limites de 8GB/sem Docker local, a arquitectura Java21/Spring/React/TypeScript/PostgreSQL e os gates clínicos descritos no documento.
4. Distingua o que já foi implementado e testado de ideias do R04/R05 que são apenas hipóteses. Os relatórios de investigação iniciais não estão necessariamente dentro do repositório; não invente citações ou declare que foram validados.
5. Comece por uma **auditoria curta, efectiva e baseada no código real** do estado CF-N03 integrado; depois seleccione uma pequena entrega coerente do checklist pendente. O **contrato de Interno supervisionado (CF-I01)** é o próximo portal lógico candidato, mas acesso clínico e supervisão precisam de regras explicitamente aprovadas. Não inicie o Admin completo.
6. Execute trabalho real se a tarefa subsequente pedir implementação: branch isolada do \`main\` actual, implementações mínimas, testes, CI frontend e backend com PostgreSQL16, PR Draft, integração apenas em verde, post-merge main CI e novo handoff.
7. **Nunca usar dados clínicos reais**: deployment Railway, browser smoke, privacidade/legal em Moçambique, direcção clínica, threat model, backup/restore e incident response ainda não constituem aprovação de produção.
8. Forneça um relatório factual do estado actual e dos primeiros achados; não faça perguntas cujo conteúdo já esteja no handoff e não repita trabalho concluído.

**Modo de execução:** AUDIT → UNDERSTAND → PLAN → PRESERVE → IMPLEMENT → TEST → REPAIR → VERIFY → REPORT.  
**Resultado de cada slice:** MERGED + MAIN CI PASS, READY FOR REVIEW ou BLOCKED, com HEAD/PR/run IDs e limites claros.

Esta mensagem é uma transferência de contexto autorizada para continuar exactamente o mesmo projecto, não um novo briefing ou protótipo.
