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

---

## Planeamento futuro — não executar ainda

> As três secções seguintes requerem investigação, decisão de design ou ambas.
> Nenhuma deve ser implementada sem primeiro clarificar as questões abertas indicadas.

---

### T-10 · Modelo de rotação GitHub Models — validar rate limits e expandir chain
**Prioridade: ALTA — fazer antes da próxima run com muitos repos novos**

#### Contexto (da investigação no curated_stars)

A investigação feita em `curated_stars/.dev/research/` (RLOG-2026-03-27-001 + RLOG-2026-04-03-003)
revelou comportamentos não documentados que se aplicam directamente a este repo:

**Rate limit types — dois regimes distintos:**

| Modelo | Tipo de limite | Valor empírico | Retry-after |
|--------|----------------|----------------|-------------|
| `openai/gpt-4o` | `UserByModelByMinute` | ~10 RPM | 3–60s → **recupera rapidamente** |
| `openai/gpt-4o-mini` | `UserByModelByDay` | ~1000/dia | ~11 000s → **esgota para o dia** |
| `openai/gpt-4.1` | `UserByModelByDay` | ~1000/dia | ~11 000s |
| `openai/gpt-4.1-mini` | `UserByModelByDay` | ~1000/dia | ~11 000s |
| `openai/gpt-4.1-nano` | `UserByModelByDay` | ~1000/dia | ~11 000s |
| `meta/llama-*`, `deepseek/*` | desconhecido (sem headers) | n/a | apenas 429 |

**Implicação crítica:** com 99 repos e `gpt-4o-mini` como primeiro da lista,
o `enrich_stars.py` actual pode esgotar o limite diário nessa única run.
O `curated_stars` colocou `gpt-4o` primeiro exactamente por isto — é per-minute, não per-day.

**Problema adicional na lógica de retry actual (`enrich_stars.py`):**
O código actual trata todos os 429 como "modelo falhado, rodar para o próximo".
Correcto para `UserByModelByDay` (esgotado até amanhã), mas **errado para `UserByModelByMinute`**
(gpt-4o recupera em 3–60s — devia esperar e re-tentar, não saltar).

#### Config actual (incorrecta para um batch de 99+ repos)

```json
"allowlist": ["openai/gpt-4o-mini", "openai/gpt-4o", "meta/llama-3.3-70b-instruct", "mistral-ai/mistral-small"]
```

Problemas:
1. `gpt-4o-mini` primeiro → esgota 1000/dia no próprio run inicial
2. `gpt-4o` segundo → devia ser primeiro (per-minute, não per-day)
3. Só 4 modelos → cadeia de fallback demasiado curta
4. `mistral-ai/mistral-small` — ID incerto (provavelmente `mistral-ai/mistral-small-2503`)

#### O que precisa de ser feito

**Passo 1 — Validar rate limits actuais com a PAT real:**
Antes de alterar qualquer config, correr um script de sondagem (equivalente ao
`validate_models.py` do curated_stars) para confirmar os limites actuais.
Os rate limits do GitHub Models mudam sem aviso. Ver:
`curated_stars/scripts/validate_models.py` como referência.

- [ ] Criar `scripts/validate_models.py` adaptado para starboard
- [ ] Correr localmente: `source .env && python scripts/validate_models.py`
- [ ] Documentar resultados em `.dev/validate_models_<data>.md` (criar pasta `.dev/`)

**Passo 2 — Actualizar `config.json` com ordem correcta e chain mais larga:**
Com base nos resultados do passo 1, reordenar para:
```
gpt-4o (per-minute, não esgota) → gpt-4.1 (1000/day, alta qualidade)
→ gpt-4.1-mini → gpt-4.1-nano → gpt-4o-mini
→ llama-4-scout-17b → llama-3.3-70b → deepseek-v3-0324 → mistral-small
```

- [ ] Actualizar `config.json` com nova ordem após validação

**Passo 3 — Corrigir retry logic em `enrich_stars.py`:**
Distinguir per-minute vs per-day pelo valor de `retry-after` do header:
- `retry-after <= 120s` → `UserByModelByMinute` → esperar e re-tentar o mesmo modelo
- `retry-after > 120s` → `UserByModelByDay` → modelo esgotado, rodar para o próximo

- [ ] Implementar distinção per-minute/per-day no `enrich_repo()` em `enrich_stars.py`
- [ ] Adicionar `Retry-After` ao `RateLimitError` handling (ou substituir SDK OpenAI por `requests.post` directo para ter acesso aos headers, como o `curated_stars`)

**Questão em aberto antes de executar:**
> Usar o SDK OpenAI (como agora) ou migrar para `requests.post` directo (como no curated_stars)?
> O SDK esconde os headers de rate-limit, o que impede a distinção per-minute/per-day.
> Recomendação: migrar para `requests.post` directo — dá controlo total sobre headers e retry.

---

### T-11 · Re-enriquecimento inteligente — detectar mudanças sem LLM
**Prioridade: MÉDIA — implementar antes de o repo crescer significativamente**

#### Contexto

Com a fix do T (fetch preserva LLM data), o enriquecimento já é incremental:
novos repos são enriquecidos, os existentes são saltados. Mas isto cria um problema
diferente: repos enriquecidos há 3 meses podem ter mudado (nova descrição, novos
topics, arquivados, tech pivot) e o LLM summary está desactualizado.

#### Sinais de mudança disponíveis sem LLM

Todos estes campos chegam da API GitHub em cada fetch, sem custo adicional:

| Campo | Sinal de mudança | Acção |
|-------|-----------------|-------|
| `description` | Texto diferente do que estava quando foi enriquecido | Re-enriquecer |
| `topics` | Lista diferente | Re-enriquecer |
| `language` | Mudou (raro mas possível) | Re-enriquecer |
| `archived` | Passou a `true` | Re-enriquecer (watch_note deve ser nullado) |
| `pushed_at` | Delta relevante (repo passou de stale a active, ou vice-versa) | Re-enriquecer |

#### Abordagem recomendada: content hash

Armazenar no `data/stars.json` um campo `llm_content_hash` = hash dos campos
relevantes para enriquecimento (`description` + `topics` + `language` + `archived`).
No próximo fetch, se o hash diferir → limpar `llm_status` → o `enrich_stars.py` recolhe.

```python
import hashlib, json

def content_hash(repo: dict) -> str:
    relevant = {
        "description": repo.get("description") or "",
        "topics": sorted(repo.get("topics") or []),
        "language": repo.get("language") or "",
        "archived": repo.get("archived", False),
    }
    return hashlib.md5(json.dumps(relevant, sort_keys=True).encode()).hexdigest()
```

Em `fetch_stars.py`, ao preservar o LLM data existente, comparar o hash:
```python
if repo["full_name"] in existing_llm:
    stored = existing_llm[repo["full_name"]]
    if content_hash(repo) == stored.get("llm_content_hash"):
        repo.update(stored)   # preserva — sem mudanças relevantes
    # else: não preserva → será re-enriquecido (conteúdo mudou)
```

#### Envelhecimento forçado (fallback)

Independentemente do hash, qualquer repo não re-enriquecido há mais de 90 dias
deve ser marcado para re-enriquecimento. Evita dados muito velhos mesmo sem mudanças
visíveis nos metadados.

#### O que precisa de ser feito

- [ ] Adicionar campo `llm_content_hash` ao schema em `fetch_stars.py` e `normalize_repo()`
- [ ] Implementar `content_hash()` em `fetch_stars.py`
- [ ] Actualizar lógica de preservação em `fetch_stars.py` para comparar hashes
- [ ] Adicionar lógica de envelhecimento (90 dias) em `enrich_stars.py` ou `fetch_stars.py`
- [ ] Actualizar `needs_enrichment()` em `enrich_stars.py` para respeitar o campo

**Questão em aberto antes de executar:**
> 90 dias é o threshold certo para re-enriquecimento por idade?
> Dado que o modelo LLM pode melhorar com novas versões, 30 dias pode ser mais adequado.
> Mas aumenta o custo em rate limits. Decisão depende do tamanho final do repo de stars.

---

### T-12 · Dashboard — redesign completo para UI/UX forte e accionável
**Prioridade: ALTA — o valor do projecto depende disto**

#### Diagnóstico do dashboard actual

O dashboard gerado pelo Copilot tem os seguintes problemas estruturais:

| Problema | Impacto |
|----------|---------|
| Todas as informações têm o mesmo peso visual | Impossível scanear em passagem rápida |
| LLM summary enterrado a meio do card | O campo mais valioso não é o hero element |
| 4 badges por card (Recent, Active, Cleanup, Archived) | Visual noise, não guia à acção |
| Sem "action lanes" — tudo misturado numa grelha | Não responde à pergunta "o que faço agora?" |
| Stats bar puramente numérica sem contexto | Saber "12 cleanup candidates" não diz o que fazer |
| Sem vista compacta para listas longas | 99+ cards em grelha = scroll infinito |
| Filtros planos e sem hierarquia | Interface de base de dados, não de produto |
| Sem indicação de quando os dados foram actualizados | Não sabemos se os dados são frescos |

#### Princípios de design para o novo dashboard

1. **AI-first**: o `llm_summary` é o hero — deve ser a primeira coisa que se lê
2. **Scannability**: num relance de 2-3s por card, deve ser clara a categoria e a acção
3. **Action lanes**: separar visualmente "Watch list", "Cleanup", "Explore" em vez de tudo misturado
4. **Densidade inteligente**: compact list view (uma linha) para overview + card expandido ao clicar/hover
5. **Contexto temporal**: quando foi starred, quando foi enriquecido, quanto tempo desde o último push
6. **Hierarquia de cor**: usar cor para guiar à acção (vermelho = cleanup, verde = watch, azul = neutral)
7. **Zero chrome desnecessário**: badges só quando adicionam informação que não está em mais lado nenhum

#### Estrutura proposta (para discussão — não design final)

```
┌─ Header ─────────────────────────────────────────────────────────────────┐
│  Starboard   99 repos · última actualização: há 2h · 87 enriquecidos     │
└──────────────────────────────────────────────────────────────────────────┘

┌─ Action Bar ─────────────────────────────────────────────────────────────┐
│  [Watch (12)] [Explore (45)] [Cleanup (18)] [Não enriquecido (14)]       │
│  ← estes são modos, não apenas filtros                                    │
└──────────────────────────────────────────────────────────────────────────┘

┌─ Card (compact) ──────────────────────────────────────────────────────────┐
│  owner/repo-name                    [AI/ML]  ★ 4.2k  📅 3d ago           │
│  💡 One-liner LLM summary — o que faz este projecto em 20 palavras        │
│  👁 Watch note se relevante                                                │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Tecnologia — questão a clarificar

O dashboard actual é HTML + CSS + vanilla JS, sem framework, sem build step.
Opções para o redesign:

| Opção | Prós | Contras |
|-------|------|---------|
| **Vanilla JS melhorado** | Zero deps, sem build, Pages-friendly | Mais código para UI complexa |
| **Preact/AlpineJS (CDN)** | Componentes sem build step, CDN-deliverable | Uma dep externa |
| **Astro/Next.js** | Full power | Build step, mais complexo para Pages |

Para GitHub Pages estático com dados em JSON, **Vanilla JS com CSS bem estruturado**
ou **AlpineJS via CDN** são as abordagens mais pragmáticas.

#### O que precisa de ser feito

- [ ] Clarificar: redesign completo do zero ou refactor incremental do existente?
- [ ] Clarificar: vanilla JS mantém-se ou aceitas uma pequena dep (AlpineJS/Preact via CDN)?
- [ ] Clarificar: modo compacto (lista de 1 linha) + expansão on-click/hover é o modelo certo?
- [ ] Clarificar: "action lanes" são tabs/secções fixas ou filtros salvos?
- [ ] Desenhar wireframe / mockup antes de tocar no código
- [ ] Implementar novo `site/` após aprovação do design

**Questão em aberto antes de executar:**
> Qual o dispositivo/contexto principal de uso — desktop web, mobile, ou ambos?
> Impacta directamente o layout e a densidade da informação.

---

## Referência: curated_stars (o que está a funcionar)

| Item | curated_stars |
|------|---------------|
| Secrets | `GH_STARS_PAT` (Classic, read:user+public_repo), `GH_MODELS_PAT` (Fine-Grained, models:read) |
| Endpoint Models | `https://models.github.ai/inference/chat/completions` |
| Nomes de modelos | `openai/gpt-4o`, `openai/gpt-4.1`, `openai/gpt-4o-mini`, `meta/llama-3.3-70b-instruct` |
| Runs Actions | success diárias (último run: 2026-04-11 04:50 UTC) |
| Visibilidade repo | privado (sem Pages — não serve de referência para T-01/T-04) |
