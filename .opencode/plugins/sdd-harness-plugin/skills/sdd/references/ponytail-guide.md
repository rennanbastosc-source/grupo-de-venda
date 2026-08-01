# ✂️ Guia Ponytail de Código Enxuto (Lean Engineering)

O modo **Ponytail** (*Lazy Senior Dev Mode*) baseia-se no princípio de que **o melhor código é aquele que não precisa ser escrito**. O objetivo é maximizar a eficiência, a reutilização e manter o código enxuto, legível e livre de sobre-engenharia.

---

## 🪜 A Escada de Eficiência do Ponytail (*The Ladder*)

Antes de escrever qualquer nova função, classe ou abstração, verifique a escada em ordem:

1. **YAGNI (You Aren't Gonna Need It):** Isso realmente precisa ser construído agora? Se for um recurso especulativo ou "para o futuro", **não construa**.
2. **Reuso do Repositório:** O comportamento desejado já existe neste codebase? Reutilize componentes, helpers, utilitários ou rotas existentes. Não reimplemente.
3. **Standard Library / Nativo da Linguagem:** A biblioteca padrão ou um recurso nativo da linguagem/plataforma já resolve? Use-o diretamente.
4. **Dependência Existente:** Uma biblioteca já instalada no projeto (`package.json`) resolve o problema? Use-a sem adicionar novas dependências.
5. **Menos Código (Shrink):** A lógica pode ser expressa em poucas linhas sem rodeios? Prefira a forma mais simples e direta.
6. **Mínimo Funcional:** Apenas se nenhum dos degraus acima resolver, escreva o código mínimo necessário de ponta a ponta.

---

## 🔍 Tags de Auditoria Anti-Overengineering

Durante o `/sdd-validate`, o diff é inspecionado com base nas seguintes categorias:

- `delete:` Código morto, flexibilidade especulativa, flags de config não utilizadas ou wrappers que apenas delegam. **Substituição: nada (deletar)**.
- `stdlib:` Código feito à mão para algo que a linguagem/plataforma já oferece de forma nativa. **Substituição: usar a API nativa**.
- `yagni:` Abstrações com apenas uma implementação, interfaces desnecessárias ou estruturas preparadas para um "futuro incerto". **Substituição: inlinear e simplificar**.
- `shrink:` Mesma lógica de negócio que pode ser escrita com menos linhas e menor complexidade cognitiva. **Substituição: forma enxuta**.

---

## 🛠️ Regras Principais de Implementação

1. **Causa Raiz em Bugs:** Se estiver corrigindo uma falha, identifique a causa raiz e corrija a função compartilhada uma única vez, em vez de aplicar retalhos (*patches*) em cada ponto chamador.
2. **Sem Abstrações Pré-Maturas:** Não crie interfaces, factories ou classes abstratas sem ter pelo menos duas implementações reais no projeto.
3. **Deleção sobre Adição:** Um diff que diminui mantendo o funcionamento é sempre superior a um diff que cresce.
