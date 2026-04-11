# Starboard — Tasks & Audit

> Auditoria realizada a 2026-04-11. Estado: scaffolding gerado pelo Copilot online, sem execução real ainda.
> Referência para replicar: `nsalvacao/curated_stars` — pipeline funcional com runs diárias bem-sucedidas.

---

## Diagnóstico

| Item | Estado |
|------|--------|
| Repositório | **PRIVADO** — Pages não funciona em repos privados (free tier) |
| GitHub Pages | **NÃO configurado** — 404 na API de Pages |
| Secrets no repo | ✅ `GH_STARS_PAT` + `GH_MODELS_PAT` configurados (2026-04-11) |
| Workflow (última run) | **FALHOU** — HTTP 403 ao aceder `/user/starred` (corrigido no código) |
| `data/stars.json` | **Vazio (`[]`)** — aguarda primeiro run bem-sucedido |
| `.gitignore` | ✅ Criado |
| `.env` | ✅ Copiado de `curated_stars`, com tokens activos |
| `.env.example` | ✅ Actualizado com `GH_STARS_PAT` / `GH_MODELS_PAT` |
| Endpoint GitHub Models | ✅ Corrigido → `models.github.ai/inference` |
| Nomes dos modelos | ✅ Corrigidos → prefixo de provider (`openai/`, `meta/`) |
| Token GitHub Models | ✅ Separado → `GH_MODELS_PAT` em `enrich_stars.py` |
| Metadados do repo | ✅ Descrição e topics definidos |

### Causa raiz do workflow falhado

O workflow usa `${{ secrets.GITHUB_TOKEN }}` (token built-in do Actions). Este token
**não tem permissão para listar starred repos do utilizador** — o endpoint
`GET /user/starred` requer um PAT com scope `read:user`.

### Diferenças críticas face ao curated_stars (que funciona)

O `curated_stars` tem **dois tokens distintos** e usa o **endpoint correcto** do GitHub Models:

| | starboard (actual) | curated_stars (referência) |
|-|--------------------|-----------------------------|
| Token fetch stars | `GITHUB_TOKEN` (built-in) ❌ | `GH_STARS_PAT` (Classic PAT, `read:user`) ✅ |
| Token GitHub Models | mesmo token ❌ | `GH_MODELS_PAT` (Fine-Grained, `models:read`) ✅ |
| Endpoint Models | `models.inference.ai.azure.com` ❌ | `models.github.ai/inference/...` ✅ |
| Nomes de modelos | `gpt-4o-mini`, `mistral-small` ❌ | `openai/gpt-4o-mini`, `meta/llama-3.3-70b-instruct` ✅ |

---

## Bloqueantes — necessários para funcionar

### T-01 · Tornar o repositório público (após revisão de privacidade)
**Prioridade: CRÍTICA — só executar após T-06**

GitHub Pages gratuito só funciona em repos públicos. O repo só deve tornar-se público quando:
1. `data/stars.json` não contém repos privados/internos — verificar em T-06
2. Não há nada no histórico de commits que não deva ficar exposto (ver nota abaixo)
3. O próprio dashboard não revela informação que prefiras manter privada (e.g. padrões de interesse, projetos internos)

**Nota sobre o histórico git:** o `data/stars.json` actual está vazio (`[]`),
portanto o histórico está limpo neste ponto. Após o primeiro run, confirmar que o
conteúdo gerado é aceitável antes de tornar público.

- [ ] Executar T-06 primeiro (verificar conteúdo do stars.json)
- [ ] Ir a Settings → General → Danger Zone → Change visibility → Public

---

### ~~T-02 · Criar dois PATs e configurar como secrets~~ ✅ FEITO
**Concluído: 2026-04-11**

O `curated_stars` usa dois tokens separados. O `starboard` precisa do mesmo padrão.

**PAT 1 — `GH_STARS_PAT`** (Classic PAT, para fetch de starred repos)
- Ir a https://github.com/settings/tokens → Generate new token (classic)
- Scopes: `read:user` + `public_repo` (ou `repo` para stars de repos privados)
- No repositório: Settings → Secrets → Actions → New secret: `GH_STARS_PAT`

**PAT 2 — `GH_MODELS_PAT`** (Fine-Grained PAT, para GitHub Models API)
- Ir a https://github.com/settings/tokens → Generate new token (**Fine-grained**)
- Resource owner: o teu username
- Repository access: Public repositories (ou All repositories)
- Permissions → **Models: Read** (única permission necessária)
- No repositório: Settings → Secrets → Actions → New secret: `GH_MODELS_PAT`

> No `curated_stars` estes dois secrets existem desde 2026-03-26 e funcionam. Os valores
> do `.env` local em `D:\GitHub\curated_stars\.env` têm os tokens nas variáveis
> `GH_STARS_PAT` e `GH_MODELS_PAT` — podes reutilizá-los se ainda forem válidos.

---

### ~~T-03 · Corrigir o workflow: tokens, endpoint e nomes de modelos~~ ✅ FEITO
**Concluído: 2026-04-11**

Três correcções independentes no mesmo ficheiro `.github/workflows/refresh.yml` e nos scripts:

#### 3a — Workflow: separar os dois tokens por step

No step `Fetch starred repositories`:
```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GH_STARS_PAT }}
```

No step `Enrich with GitHub Models`:
```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GH_STARS_PAT }}   # para chamadas à API GitHub se necessário
  GH_MODELS_PAT: ${{ secrets.GH_MODELS_PAT }}  # para GitHub Models
```

O step `Commit updated data` e os steps de Pages mantêm `${{ secrets.GITHUB_TOKEN }}` (built-in).

- [ ] Actualizar step `Fetch starred repositories` em `refresh.yml`
- [ ] Actualizar step `Enrich with GitHub Models` em `refresh.yml`

#### 3b — Script: corrigir endpoint do GitHub Models

Em `scripts/enrich_stars.py`, linha 21:
```python
# ERRADO (legado Azure):
GITHUB_MODELS_BASE_URL = "https://models.inference.ai.azure.com"

# CORRECTO (novo endpoint):
GITHUB_MODELS_BASE_URL = "https://models.github.ai/inference"
```

Adicionalmente, o script deve ler `GH_MODELS_PAT` do ambiente em vez de `GITHUB_TOKEN`:
```python
token = os.environ.get("GH_MODELS_PAT") or os.environ.get("GITHUB_TOKEN", "")
```

- [ ] Corrigir `GITHUB_MODELS_BASE_URL` em `scripts/enrich_stars.py`
- [ ] Corrigir leitura do token de Models para usar `GH_MODELS_PAT`

#### 3c — Config: corrigir nomes dos modelos

Em `config.json`, os modelos precisam do prefixo de provider. O novo endpoint do GitHub Models exige este formato:

```json
"models": {
  "allowlist": [
    "openai/gpt-4o-mini",
    "openai/gpt-4o",
    "meta/llama-3.3-70b-instruct",
    "mistral-ai/mistral-small"
  ],
  "max_retries_per_item": 3
}
```

- [ ] Actualizar `config.json` com nomes prefixados

---

### T-04 · Activar GitHub Pages
**Prioridade: CRÍTICA** (após T-01)

- [ ] Ir a Settings → Pages
- [ ] Source: **GitHub Actions**
- [ ] Guardar (não é necessário escolher branch/folder — o workflow trata do deploy)

---

## Necessário mas não bloqueante

### ~~T-05 · Adicionar `.gitignore`~~ ✅ FEITO
**Concluído: 2026-04-11**

---

### T-06 · Verificar e limpar `data/stars.json` antes do primeiro deploy
**Prioridade: MÉDIA**

Após o primeiro run bem-sucedido, o ficheiro será populado com os stars reais.
Se o token tiver scope `repo` (acesso a repos privados), rever o conteúdo antes
de o repositório se tornar público e o site ser publicado.

- [ ] Após primeiro run: `cat data/stars.json | python -m json.tool | grep '"html_url"'`
- [ ] Confirmar que não há repos privados/internos que não devam ser publicados

---

## Melhorias / polish (pós-operacional)

### T-07 · Adicionar filtro por categoria LLM no dashboard
**Prioridade: BAIXA**

O campo `llm_category` existe nos dados mas não há filtro na UI. O ficheiro
`site/index.html` tem filtros por language, status, activity e highlight, mas
não por categoria. Adicionar um `<select id="filter-category">` em `site/app.js`
e `site/index.html`.

- [ ] Adicionar filtro de categoria ao `controls` em `site/index.html`
- [ ] Actualizar `getFiltered()` em `site/app.js` para incluir filtro de categoria

---

### ~~T-08 · Configurar metadados do repositório~~ ✅ PARCIALMENTE FEITO
**Concluído: 2026-04-11** — Descrição e topics definidos. Homepage URL a definir após deploy (T-04).

---

### T-09 · Adicionar `python-dotenv` ao workflow local (opcional)
**Prioridade: BAIXA**

O README instrui `export $(cat .env | xargs)` que é frágil (falha com valores com
espaços ou aspas). Alternativa mais robusta: adicionar `python-dotenv` ao
`requirements.txt` e carregar automaticamente no início de cada script.

- [ ] Avaliar se vale a pena vs. simplicidade actual

---

## Ordem de execução

```
✅ T-05  .gitignore criado
✅ T-02  GH_STARS_PAT + GH_MODELS_PAT configurados no repo remoto
✅ T-03  workflow, endpoint e modelos corrigidos
✅ T-08  metadados do repo definidos (descrição + topics)

→ PRÓXIMO: commit + push das alterações locais
→ T-04   activar GitHub Pages (Settings → Pages → GitHub Actions)
→        run manual em Actions para validar o pipeline
→ T-06   verificar conteúdo do stars.json gerado
→ T-01   tornar o repo público (só após T-06 confirmar que está limpo)
→ T-07   adicionar filtro por categoria no dashboard (pós-operacional)
```

---

## Referência: curated_stars (o que está a funcionar)

| Item | curated_stars |
|------|---------------|
| Secrets | `GH_STARS_PAT` (Classic, read:user+public_repo), `GH_MODELS_PAT` (Fine-Grained, models:read) |
| Endpoint Models | `https://models.github.ai/inference/chat/completions` |
| Nomes de modelos | `openai/gpt-4o`, `openai/gpt-4.1`, `openai/gpt-4o-mini`, `meta/llama-3.3-70b-instruct` |
| Runs Actions | success diárias (último run: 2026-04-11 04:50 UTC) |
| Visibilidade repo | privado (sem Pages — não serve de referência para T-01/T-04) |
