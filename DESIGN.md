# DESIGN.md — Painel Bongarbit

## Referência

A linguagem visual deste painel parte do projeto **mapas-bongarbit**, especialmente do seu `styles.css`: fundo quase preto, controles compactos, painéis translúcidos, bordas discretas, tipografia de sistema e interação sem excesso de ornamento.

A adaptação acrescenta uma hierarquia editorial inspirada no site-joao: título grande, navegação por blocos e uso de uma cor quente para destacar decisões e próximos passos.

## Tokens

```css
--bg: #0c0d10;
--panel: rgba(20, 22, 28, .88);
--line: #2a2f3a;
--text: #e6e6e6;
--muted: #aab1c0;
--blue: #7fd6ff;
--yellow: #f5ca72;
--green: #8ce0b0;
--pink: #e5a8ff;
```

## Princípios

- **Arquivo vivo:** o conteúdo deve ser escaneável em poucos segundos.
- **Ação antes de arquivo:** tarefas aparecem antes dos documentos.
- **Links individuais:** cada documento tem seu próprio link; não usar atalhos para pastas como substituto.
- **Baixo ruído:** poucos elementos decorativos, bordas finas e contraste suficiente.
- **Camadas discretas:** transparência e `backdrop-filter` criam profundidade sem transformar a interface em um cartão excessivo.
- **Responsividade:** em telas pequenas, tarefas e Drive passam para uma única coluna.

## Componentes

- `hero`: contexto e título do painel.
- `summary`: números rápidos de tarefas e documentos.
- `toolbar`: busca e filtros.
- `task`: tarefa com checkbox, descrição, metadado e categoria.
- `drive-link`: link direto para pasta, documento ou planilha.

## Conteúdo

Os dados ficam no início de `app.js`, em dois arrays simples: `tasks` e `links`. Para atualizar o painel, editar esses arrays e publicar novamente pelo GitHub Pages.
