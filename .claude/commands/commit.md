---
description: Cria um commit seguindo o padrão Conventional Commits do projeto
---

# Git Commit

Você deve criar um commit seguindo rigorosamente as regras definidas em `@COMMIT_PROMPT.md` (arquivo na raiz do projeto).

## Passos obrigatórios:

1. **Verificar mudanças:**
   - Execute `git status` para ver arquivos modificados
   - Execute `git diff` para ver as mudanças em detalhe

2. **Ler as regras de commit:**
   - Leia `@COMMIT_PROMPT.md` (arquivo na raiz) para entender as regras do projeto

3. **Analisar as mudanças:**
   - Identifique o tipo correto de commit (feat, fix, chore, refactor, etc.)
   - Identifique o escopo (crm, chat, scheduler, ui, etc.)
   - Crie uma mensagem concisa e específica

4. **Gerar a mensagem:**
   - Formato: `<type>(<scope>): <subject>`
   - Use INGLÊS
   - Use modo imperativo
   - Seja específico e conciso

5. **Executar o commit:**
   - Para commits normais, instrua o usuário a rodar:
     ```bash
     git add -A && git commit -m "<mensagem gerada>" && git push
     ```

   - Para releases (chore(release):), instrua o usuário a rodar:
     ```bash
     pnpm auto-release
     ```
     (ou `pnpm auto-release:alpha/beta/rc` para pre-releases)

## Exemplo de saída:

```
Mudanças detectadas:
- Criado comando /init-phase
- Deletado PROMPT-INICIAR-FASE.md

Mensagem de commit gerada:
feat(cli): add init-phase command for automated phase initialization

Execute:
git add -A && git commit -m "feat(cli): add init-phase command for automated phase initialization" && git push
```

---

**Agora, verifique as mudanças, leia as regras e gere o commit!**
