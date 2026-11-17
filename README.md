# Painel Bongarbit

Site estático para acompanhar tarefas pendentes e acessar rapidamente pastas e documentos do Google Drive relacionados aos projetos culturais.

## Desenvolvimento local

```bash
python3 -m http.server 4173
```

Abra `http://localhost:4173`.

## Publicação

O site é publicado automaticamente no GitHub Pages por `.github/workflows/pages.yml` após cada push na branch `main`.

## Arquivos

- `index.html` — estrutura da página;
- `styles.css` — interface e responsividade;
- `app.js` — tarefas, links, busca, filtros e estado local da sessão;
- `DESIGN.md` — referência visual e tokens.
