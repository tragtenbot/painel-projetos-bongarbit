# Bridge local do Codex

O site publicado no GitHub Pages não executa comandos locais e não deve receber uma chave de API no navegador.

Para usar o plano do Codex sem cobrança de API, o bridge precisa rodar na mesma máquina do usuário e expor somente uma interface local:

- `GET http://127.0.0.1:8787/health` → `200` quando conectado;
- `POST http://127.0.0.1:8787/generate` com `{ "prompt": "..." }` → `{ "text": "..." }`.

O frontend já detecta essa interface. Quando ela não está disponível, não chama nenhuma API: cria apenas um rascunho local do resumo e deixa os campos para edição manual.

O bridge ainda não está ativo neste VPS porque o comando `codex` não está instalado aqui. Não foi adicionada nenhuma chave de API ao repositório ou ao site.
