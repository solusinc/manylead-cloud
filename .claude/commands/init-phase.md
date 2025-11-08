---
description: Inicia a implementação de uma fase do projeto
args:
  number:
    description: Número da fase (ex: 1, 04, 21)
    required: true
---

# Iniciar Fase {{number}}

Você deve implementar a **FASE-{{number}}** do projeto ManyLead.

## Passos obrigatórios:

1. **Localizar o documento da fase:**
   - Busque em `@docs/planning/` o arquivo que começa com `FASE-{{number}}-` (pode ter zero à esquerda, ex: FASE-01, FASE-04)
   - Liste os arquivos se necessário para encontrar o nome exato

2. **Carregar contexto completo:**
   Leia TODOS os seguintes documentos na ordem (faça em paralelo quando possível):
   - O arquivo da fase encontrado em `@docs/planning/FASE-{{number}}-*.md`
   - `@docs/technical/00-STACK-E-DECISOES.md`
   - `@docs/technical/CODE_PATTERNS.md`
   - `@docs/ARCHITECTURE-REFERENCE.md`

3. **Referência adicional:**
   - Analise patterns similares em `@references/openstatus` quando relevante para a fase

4. **Informações do projeto:**
   - **Stack:** Next.js 16, tRPC, Drizzle ORM, PostgreSQL, Redis
   - **Arquitetura:** Database-per-tenant (multi-tenant com DB isolado)
   - **Monorepo:** Turborepo com apps e packages
   - **Gerenciamento de dependências:** Catálogo centralizado em `pnpm-workspace.yaml`

5. **Gerenciamento de dependências (IMPORTANTE):**
   - **SEMPRE** verifique `pnpm-workspace.yaml` antes de adicionar dependências
   - Use `"catalog:"` para todas as dependências listadas no catálogo principal
   - Use `"catalog:react19"` para dependências do React 19 (react, react-dom, @types/react, @types/react-dom)
   - Se uma dependência NÃO está no catálogo:
     - Pergunte ao usuário se deve adicionar ao catálogo ou usar versão explícita
     - Documente a decisão no commit/PR
   - Exemplos:
     ```json
     "dependencies": {
       "zod": "catalog:",
       "react": "catalog:react19",
       "@trpc/server": "catalog:",
       "nova-lib": "^1.0.0"  // ← Apenas se não estiver no catálogo
     }
     ```

6. **Implementação:**
   - Crie um TODO list detalhado baseado no passo-a-passo do documento da fase
   - Siga rigorosamente os patterns estabelecidos em CODE_PATTERNS.md
   - Implemente cada passo sequencialmente
   - Marque os TODOs como concluídos conforme avança
   - Execute testes quando indicado no documento
   - Faça commits ao finalizar seções importantes

## Regras importantes:

- ✅ Sempre use os patterns estabelecidos (não invente novos)
- ✅ Respeite a arquitetura multi-tenant
- ✅ Siga o passo-a-passo do documento da fase
- ✅ Use TypeScript strict mode
- ✅ Implemente validações com Zod
- ✅ **Ao criar/modificar package.json, use `"catalog:"` para dependências do catálogo**
- ✅ **IMPORTANTE: Nunca referencie "OpenStatus" nos comentários do código - use apenas "Baseado em padrões de projeto open-source" se necessário**
- ❌ Não pule etapas do documento
- ❌ Não crie código fora dos patterns estabelecidos
- ❌ Não faça suposições, consulte os documentos
- ❌ **Não use versões explícitas para deps que já estão no catálogo pnpm**
- ❌ **NUNCA use `any` como tipo - sempre tipagem explícita e segura**
- ❌ **Não mencione "OpenStatus" em comentários de código gerado**

---

**Agora, localize o documento da fase, carregue todo o contexto necessário e comece a implementação!**
