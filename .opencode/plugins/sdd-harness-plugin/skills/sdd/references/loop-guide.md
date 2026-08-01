# 🔁 Guia do Loop de Validação Adaptativo

Rotina única de validação com auto-cura e review de código enxuto. **Fonte única da verdade** — `/sdd-implement` e `/sdd-validate` invocam este mesmo loop, mudando apenas o **escopo**. Nenhuma delas redefine a rotina.

---

## 📥 Contrato de Invocação

Quem invoca declara o escopo. Tudo o mais é idêntico nos dois casos.

| Escopo | Invocado por | Quando | Diff analisado | Bateria |
|---|---|---|---|---|
| **Fatia** | `/sdd-implement` | Antes de commitar a fatia | Mudanças não commitadas da fatia da vez | `tsc`/types, lint, testes unitários e de integração afetados. **E2E apenas se a fatia tocou UI.** |
| **Feature** | `/sdd-validate` | Antes do `/sdd-finish` | Branch `feat/<slug>` inteira contra a base | Suíte **completa**: types, lint, todos os testes e **E2E completo** — pega regressão de uma fatia sobre outra |

O escopo Fatia é o portão de commit: **uma fatia nunca é marcada `CONCLUÍDO` nem commitada com o loop vermelho.**
O escopo Feature é o portão de merge: valida a integração das fatias entre si, que o escopo Fatia não enxerga.

---

## 1. Detecção de Stack

Monta a bateria a partir dos arquivos-âncora do repositório:

- `package.json` → Node/TS: `tsc --noEmit`, lint (`eslint`/`biome`), testes (`vitest`/`jest`), e2e (`playwright`).
- `pyproject.toml` / `setup.cfg` → Python: `pytest`, lint/types (`ruff`/`mypy`).

Adapta aos scripts **realmente definidos** no projeto; nunca assume um comando que não existe. Se a stack não expõe um dos passos, registre isso no relatório em vez de inventar o comando.

## 2. Triage de Risco (o "adaptativo")

Classifica o diff do escopo para dimensionar o loop:

- **🟢 Baixa Complexidade:** alterações visuais simples, textos, refatorações isoladas. Bateria enxuta, **1 volta** de auto-cura.
- **🔴 Alta Complexidade / Risco Crítico:** auth, regras de negócio e cálculos, schemas de banco, fluxos de UI multi-etapas. Bateria profunda, **até 3 voltas**, E2E obrigatório e review Ponytail.

Anuncie a classificação e o orçamento de voltas antes de rodar.

## 3. Loop de Auto-Cura (Self-Healing)

Repita até a bateria ficar 100% verde ou esgotar o orçamento de voltas:

1. Executa a bateria do escopo.
2. Verde → segue para o passo 4.
3. Vermelho → **extrai o log bruto**, diagnostica a **causa raiz** (corrige na função compartilhada, não no chamador — ver [ponytail-guide.md](ponytail-guide.md)), aplica a correção e volta ao item 1.

**NUNCA MASCARE ERROS.** Não é auto-cura: afrouxar asserção, marcar teste como `skip`/`xfail`, silenciar regra de lint, adicionar `as any`/`# type: ignore` ou reduzir o escopo do teste para ele passar. Se a correção legítima exige mudar a spec, isso é uma parada (passo 5), não um remendo.

## 4. Review Ponytail do Diff

Com a bateria verde, inspecione o diff do escopo usando as **4 tags canônicas** de [ponytail-guide.md](ponytail-guide.md) — `delete`, `stdlib`, `yagni`, `shrink` — e aplique os cortes.

**Todo corte aplicado obriga uma nova volta do passo 3** (a bateria roda de novo sobre o código simplificado). Simplificação sem revalidação não conta como concluída. Se um corte quebrar a suíte e não houver como simplificar sem quebrar, reverta o corte e registre-o como observação no relatório.

## 5. Saída — Verde ou Parada Explícita

**✅ Verde** (bateria passou e os cortes revalidaram): reporte o que rodou, a classificação de risco, as voltas gastas e os cortes aplicados. Quem invocou prossegue.

**🛑 Vermelho após esgotar as voltas: PARE.** Não há terceiro caminho — nunca prossiga "com ressalvas".

- No escopo **Fatia**: a fatia **permanece `EM ANDAMENTO`**, não é commitada e não avança para a próxima.
- No escopo **Feature**: a PR **não** é marcada como pronta e o `/sdd-finish` não é convidado.

Em ambos, reporte ao usuário e devolva o controle:

```text
🛑 LOOP VERMELHO — <escopo> · <🟢|🔴> · <voltas gastas>/<orçamento>

Falha persistente: <comando que falhou>
Log (trecho decisivo): <erro bruto>
Causa raiz diagnosticada: <diagnóstico>
Tentativas: 1) <o que foi tentado> → <resultado>
            2) ...
Bloqueio: <por que a correção legítima não coube no orçamento>
```

Sugira o caminho — aumentar o orçamento de voltas, corrigir a spec da fatia, ou intervenção manual — e **aguarde a decisão do usuário**.
