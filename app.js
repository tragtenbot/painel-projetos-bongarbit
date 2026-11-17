const tasks = [
  { id: 'legislacao', title: 'Conferir a legislação central da Lei Rouanet', meta: 'Lei 8.313/1991, Decreto 11.453/2023 e IN MinC 29/2026', tag: 'legislação', status: 'pending' },
  { id: 'projetos', title: 'Ler os projetos anteriores reunidos na pasta Vale', meta: 'Selecionar ideias, textos e estruturas que podem ser reaproveitados', tag: 'projetos', status: 'pending' },
  { id: 'base', title: 'Definir o projeto-base para a próxima proposta', meta: 'Cruzar Ficha Vale, contexto Rouanet e experiências do Bongarbit', tag: 'decisão', status: 'pending' },
  { id: 'formulario', title: 'Revisar o formulário e o plano de preenchimento', meta: 'Identificar campos prontos, lacunas e informações que dependem de confirmação', tag: 'formulário', status: 'pending' },
  { id: 'orcamento', title: 'Conferir orçamento e rubricas', meta: 'Usar a planilha de produção do SALIC como referência, sem duplicar versões', tag: 'orçamento', status: 'pending' },
  { id: 'anexos', title: 'Validar documentos e anexos do proponente', meta: 'CNPJ, estatuto, portfólio, currículos e comprovações', tag: 'anexos', status: 'pending' },
  { id: 'indice', title: 'Manter o índice de projetos e legislação atualizado', meta: 'Adicionar novos documentos sem criar atalhos de pastas', tag: 'organização', status: 'pending' }
];

const links = [
  { type: 'pasta', title: 'Referencia Vale Bongarbit', note: 'Edital, formulário, contexto e materiais de projeto', url: 'https://drive.google.com/drive/folders/1OS4zRBdG2nG7R8Ax-Qt2mIlnp23acK47' },
  { type: 'pasta', title: 'Legislação Lei Rouanet', note: 'Textos e PDFs organizados para consulta', url: 'https://drive.google.com/drive/folders/1ttYbCOsZpbiWNmVaYQ2jgbuRgLyOLPH7' },
  { type: 'documento', title: 'Índice de projetos e legislação', note: 'Links individuais para os documentos encontrados', url: 'https://drive.google.com/file/d/1XT26JtoRzWTHf9Zkg7LiHQNtAb_7ee5j/view?usp=drivesdk' },
  { type: 'documento', title: 'Ficha do Projeto — Vale Bongarbit', note: 'Texto-base do projeto localizado no Drive', url: 'https://drive.google.com/file/d/1Tlyo1oBxoCOCKY84xBxcGexB_26De2rX/view?usp=drivesdk' },
  { type: 'documento', title: 'Ficha Bongarbit revisada', note: 'Versão editável da ficha', url: 'https://docs.google.com/document/d/1dkfKBODwm1DJuhbZUP7-Ttnm7Ti0tOo1/edit?usp=drivesdk' },
  { type: 'documento', title: 'Contexto do projeto Rouanet', note: 'Contexto e formulação já produzidos', url: 'https://drive.google.com/file/d/1GAeIPPlgTZ4u5yINuFUuQ-cGx1gnvHFV/view?usp=drivesdk' },
  { type: 'planilha', title: 'Orçamento Plataforma SALIC / Lei Rouanet', note: 'Planilha de produção e orçamento', url: 'https://docs.google.com/spreadsheets/d/1idsaPIVkr5urXBxT5VuF4ldo0o3u2WeZjVRd3z0Yqpk/edit?usp=drivesdk' },
  { type: 'documento', title: 'Possibilidades para o projeto', note: 'Ideias e caminhos levantados anteriormente', url: 'https://drive.google.com/file/d/1Z02mhsISxwn7qTG3unQEMnmVbVdHY4rm/view?usp=drivesdk' },
  { type: 'documento', title: 'Plano de preenchimento do formulário', note: 'Roteiro para transformar a pesquisa em proposta', url: 'https://drive.google.com/file/d/1MRIiLoMoYX63_ZZXbT2uS6DDsGe9QYqL/view?usp=drivesdk' },
  { type: 'documento', title: 'Formulário do projeto', note: 'Campos extraídos e organizados', url: 'https://drive.google.com/file/d/1bYTv4ttRoF8Exae_vlwXZLsqmOw-hvLk/view?usp=drivesdk' },
  { type: 'documento', title: 'Projeto ERE Sankofa', note: 'Projeto anterior usado como referência', url: 'https://drive.google.com/file/d/1e3GAPZWaxSiJnSAOXAKonj427SF7fIDN/view?usp=drivesdk' },
  { type: 'documento', title: 'Contexto do projeto Rumos', note: 'Experiência anterior do Bongarbit', url: 'https://drive.google.com/file/d/1tAE6PSYoge6x3kWHb4QUQEc9C8Ks1k-q/view?usp=drivesdk' },
  { type: 'documento', title: 'Contexto do Funcultura Carnaval', note: 'Outra proposta anterior para comparação', url: 'https://drive.google.com/file/d/1_9z5X6keAOfcyF53jXTJ-9bIk1dAsEk9/view?usp=drivesdk' }
];

const state = { filter: 'all', query: '' };
const $ = (selector) => document.querySelector(selector);

function matches(item) {
  const haystack = Object.values(item).join(' ').toLowerCase();
  const queryMatch = haystack.includes(state.query.toLowerCase());
  const type = item.status ? 'task' : item.type === 'pasta' ? 'folder' : 'document';
  return queryMatch && (state.filter === 'all' || state.filter === type);
}

function render() {
  const visibleTasks = tasks.filter(matches);
  const visibleLinks = links.filter(matches);
  $('#tasks').innerHTML = visibleTasks.length ? visibleTasks.map(task => `
    <label class="task ${task.status === 'done' ? 'done' : ''}">
      <input class="check" type="checkbox" data-id="${task.id}" ${task.status === 'done' ? 'checked' : ''} aria-label="Concluir: ${task.title}" />
      <span><span class="task-title">${task.title}</span><span class="task-meta">${task.meta}</span></span>
      <span class="tag">${task.tag}</span>
    </label>`).join('') : '<p class="empty">Nenhum item corresponde à busca.</p>';
  $('#links').innerHTML = visibleLinks.length ? visibleLinks.map(link => `
    <a class="drive-link" href="${link.url}" target="_blank" rel="noreferrer">
      <span class="link-type">${link.type}</span><strong>${link.title} ↗</strong><small>${link.note}</small>
    </a>`).join('') : '<p class="empty">Nenhum documento corresponde à busca.</p>';
  $('#pending-count').textContent = tasks.filter(t => t.status !== 'done').length;
  $('#done-count').textContent = tasks.filter(t => t.status === 'done').length;
  $('#document-count').textContent = links.length;
  document.querySelectorAll('.check').forEach(input => input.addEventListener('change', () => {
    const task = tasks.find(t => t.id === input.dataset.id);
    task.status = input.checked ? 'done' : 'pending';
    render();
  }));
}

document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
  button.classList.add('active');
  state.filter = button.dataset.filter;
  render();
}));
$('#search').addEventListener('input', event => { state.query = event.target.value; render(); });
render();
