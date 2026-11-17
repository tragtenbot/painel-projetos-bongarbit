# Bridge do Codex via Hermes

Este diretório contém o bridge privado usado pelo site do Painel Bongarbit.

## Fluxo

1. O navegador envia um prompt autenticado.
2. O bridge monta o contexto a partir da pasta de referência do Google Drive.
3. O contexto inclui projetos, formulário, edital, FAQ, regulamento, legislação e referências relevantes.
4. O bridge chama `hermes chat --provider openai-codex`, usando a autenticação OAuth do Hermes e o plano do Codex.
5. Projetos criados pelo site são Google Docs na pasta `Projetos criados pelo Painel Bongarbit` dentro da pasta de referência.

## Rotas

- `GET /health` — público, somente diagnóstico.
- `POST /generate` — gera texto com contexto do Drive; exige `Authorization: Bearer <TOKEN>`.
- `GET /projects` — lista projetos salvos; exige token.
- `GET /projects/:id` — lê um projeto; exige token.
- `POST /projects` — cria um Google Doc; exige token.
- `PUT /projects/:id` — atualiza um Google Doc; exige token.

O token não fica no repositório. No VPS, ele fica em `/etc/codex-bridge.env` com permissão restrita. O cache de contexto fica em `~/.hermes/codex-bridge-context.json` e é atualizado no máximo a cada seis horas, preservando o cache antigo se o Drive estiver temporariamente indisponível.
