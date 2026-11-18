const BRIDGE_URL = 'https://agenda.rec.br/codex-bridge';
const BRIDGE_TOKEN_KEY = 'bongarbit_codex_bridge_token';
const bridgeToken$ = () => proposal$('#bridge-token').value.trim();
const formFields = [
  { id: 'justificativa', name: 'Justificativa', instruction: 'Explique por que a proposta é necessária, qual problema enfrenta e por que este território e público são importantes.' },
  { id: 'objetivo-geral', name: 'Objetivo geral', instruction: 'Formule o objetivo geral da proposta em uma frase clara, começando por um verbo de ação.' },
  { id: 'objetivos-especificos', name: 'Objetivos específicos', instruction: 'Liste objetivos específicos verificáveis, derivados do objetivo geral.' },
  { id: 'metodologia', name: 'Metodologia', instruction: 'Descreva como as atividades serão realizadas, em que sequência e com quais métodos.' },
  { id: 'publico', name: 'Público-alvo', instruction: 'Descreva quem participa, faixa etária, território, quantidade estimada e critérios de acesso.' },
  { id: 'cronograma', name: 'Cronograma de execução', instruction: 'Organize as principais etapas da proposta em uma sequência temporal.' },
  { id: 'acessibilidade', name: 'Acessibilidade e democratização', instruction: 'Indique medidas de acessibilidade, inclusão, gratuidade e ampliação do acesso.' },
  { id: 'resultados', name: 'Resultados esperados', instruction: 'Descreva entregas, efeitos e mudanças esperadas, evitando promessas impossíveis de verificar.' },
  { id: 'contrapartida', name: 'Contrapartida social', instruction: 'Descreva a ação de retorno público, formativo ou comunitário da proposta.' },
  { id: 'equipe', name: 'Equipe e responsabilidades', instruction: 'Apresente as funções da equipe e como cada pessoa contribui para a execução.' }
];
const proposalState = { stage: 'description', fieldIndex: 0, values: {}, bridge: false, projectId: '' };
const projectState = { id: '', name: '' };
const proposal$ = (selector) => document.querySelector(selector);
const setProposalMessage = (message, tone = '') => { const el = proposal$('#proposal-message'); el.textContent = message; el.dataset.tone = tone; };
const showStage = (stage) => {
  proposalState.stage = stage;
  ['description', 'summary', 'fields'].forEach(name => proposal$(`#proposal-${name}`).classList.toggle('hidden', name !== stage));
  document.querySelectorAll('.step').forEach(step => step.classList.toggle('active', step.dataset.step === stage));
};
const currentField = () => formFields[proposalState.fieldIndex];
const renderField = () => {
  const field = currentField();
  proposal$('#field-position').textContent = `Campo ${proposalState.fieldIndex + 1} de ${formFields.length}`;
  proposal$('#field-name').textContent = field.name;
  proposal$('#field-input').value = proposalState.values[field.id] || '';
  proposal$('#next-field').textContent = proposalState.fieldIndex === formFields.length - 1 ? 'Salvar proposta' : 'Salvar e próximo';
};
const localDraft = (description) => {
  const clean = description.trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return `Esta proposta parte de ${clean.charAt(0).toLowerCase() + clean.slice(1)}. A iniciativa articula criação, formação e participação coletiva, valorizando o território, os saberes envolvidos e a produção de resultados culturais acessíveis ao público.`;
};
function draftContext() {
  const fields = { ...proposalState.values };
  if (proposalState.stage === 'fields') fields[currentField().id] = proposal$('#field-input').value;
  const parts = [`DESCRIÇÃO INICIAL:\n${proposal$('#proposal-input').value || ''}`, `RESUMO ATUAL:\n${proposal$('#summary-input').value || ''}`];
  for (const field of formFields) if (fields[field.id]) parts.push(`CAMPO ${field.name}:\n${fields[field.id]}`);
  return parts.join('\n\n').slice(0, 60000);
}
async function generateWithCodex(prompt) {
  const token = bridgeToken$();
  if (!token) return null;
  const response = await fetch(`${BRIDGE_URL}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ prompt, draft_context: draftContext(), project_id: projectState.id || undefined }) });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || `bridge HTTP ${response.status}`); }
  const data = await response.json();
  return data.text || data.output || '';
}
async function refreshBridgeStatus() {
  try { const response = await fetch(`${BRIDGE_URL}/health`, { signal: AbortSignal.timeout(3000) }); proposalState.bridge = response.ok; } catch (_) { proposalState.bridge = false; }
  const status = proposal$('#bridge-status'); status.textContent = proposalState.bridge ? 'Codex bridge online' : 'Codex bridge indisponível'; status.classList.toggle('connected', proposalState.bridge);
}
const savedBridgeToken = localStorage.getItem(BRIDGE_TOKEN_KEY);
if (savedBridgeToken) proposal$('#bridge-token').value = savedBridgeToken;
proposal$('#bridge-token').addEventListener('change', () => { localStorage.setItem(BRIDGE_TOKEN_KEY, bridgeToken$()); setProposalMessage('Token salvo somente neste navegador.'); loadProjects(); });
function projectText() {
  if (proposalState.stage === 'fields') proposalState.values[currentField().id] = proposal$('#field-input').value;
  return JSON.stringify({ description: proposal$('#proposal-input').value, summary: proposal$('#summary-input').value, fields: proposalState.values, savedAt: new Date().toISOString() }, null, 2);
}
function clearProject() {
  projectState.id = ''; projectState.name = ''; proposalState.projectId = ''; proposalState.values = {}; proposalState.fieldIndex = 0;
  chatState.messages = []; chatState.qaUrl = ''; $('#qa-drive-status').textContent = 'Perguntas não salvas'; $('#qa-drive-status').classList.remove('connected'); renderChat();  proposal$('#project-title').value = ''; proposal$('#project-select').value = ''; proposal$('#proposal-input').value = ''; proposal$('#summary-input').value = ''; proposal$('#field-input').value = ''; showStage('description'); setProposalMessage('Novo projeto iniciado.');
}
async function loadProjects() {
  const token = bridgeToken$(); if (!token) return;
  try {
    const r = await fetch(`${BRIDGE_URL}/projects`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return;
    const data = await r.json(); const select = proposal$('#project-select');
    select.innerHTML = '<option value="">Novo projeto</option>' + data.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  } catch (_) {}
}
function parseQaText(text) {
  const messages = [];
  const chunks = text.split(/\n## Pergunta — /).slice(1);
  for (const chunk of chunks) {
    const parts = chunk.split(/\n### Resposta\n/);
    if (parts.length === 2) messages.push({ question: parts[0].replace(/^.*\n/, '').trim(), answer: parts[1].trim() });
  }
  return messages;
}
function renderChat() {
  const box = $('#chat-messages');
  if (!chatState.messages.length) { box.innerHTML = '<p class="empty">Nenhuma pergunta registrada para este projeto.</p>'; return; }
  box.innerHTML = chatState.messages.map(item => `<div class="chat-message user"><strong>Pergunta</strong><p>${item.question}</p></div><div class="chat-message"><strong>Resposta baseada no contexto</strong><p>${item.answer}</p></div>`).join('');
  box.scrollTop = box.scrollHeight;
}
async function loadProjectArtifacts(projectId) {
  chatState.messages = []; chatState.qaUrl = '';
  if (!projectId || !bridgeToken$()) { renderChat(); return; }
  try {
    const [qaResponse, taskResponse] = await Promise.all([
      fetch(`${BRIDGE_URL}/projects/${encodeURIComponent(projectId)}/qa`, { headers: { Authorization: `Bearer ${bridgeToken$()}` } }),
      fetch(`${BRIDGE_URL}/projects/${encodeURIComponent(projectId)}/tasks`, { headers: { Authorization: `Bearer ${bridgeToken$()}` } })
    ]);
    if (qaResponse.ok) { const qa = await qaResponse.json(); chatState.messages = parseQaText(qa.text || ''); chatState.qaUrl = qa.webViewLink || ''; $('#qa-drive-status').textContent = 'Perguntas salvas no Drive'; $('#qa-drive-status').classList.add('connected'); }
    if (taskResponse.ok) { const saved = await taskResponse.json(); const byId = new Map((saved.tasks || []).map(task => [task.id, task])); tasks.forEach(task => { if (byId.has(task.id)) task.status = byId.get(task.id).status || task.status; }); render(); }
  } catch (_) {}
  renderChat();
}
async function saveTasksToDrive() {
  if (!projectState.id || !bridgeToken$()) return;
  try {
    const response = await fetch(`${BRIDGE_URL}/projects/${encodeURIComponent(projectState.id)}/tasks`, { method: 'POST', headers: { Authorization: `Bearer ${bridgeToken$()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ tasks }) });
    if (!response.ok) throw new Error('não foi possível salvar a checklist');
  } catch (error) { setProposalMessage(`Checklist não salva no Drive: ${error.message}`, 'error'); }
}

async function loadProject(id) {
  if (!id) return clearProject();
  try {
    const r = await fetch(`${BRIDGE_URL}/projects/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${bridgeToken$()}` } });
    if (!r.ok) throw new Error('não foi possível abrir o projeto');
    const p = await r.json(); let data;
    try { data = JSON.parse(p.text); } catch (_) { data = { description: p.text, summary: '', fields: {} }; }
    projectState.id = p.id; projectState.name = p.name; proposalState.projectId = p.id; proposalState.values = data.fields || {};
    proposal$('#project-title').value = p.name; proposal$('#proposal-input').value = data.description || ''; proposal$('#summary-input').value = data.summary || '';
    proposalState.fieldIndex = 0; renderField(); showStage(data.summary ? 'summary' : 'description'); await loadProjectArtifacts(p.id); setProposalMessage('Projeto carregado do Google Drive.');
  } catch (error) { setProposalMessage(error.message, 'error'); }
}
async function saveProject(options = {}) {
  const { silent = false } = options;
  const token = bridgeToken$(); if (!token) { if (!silent) setProposalMessage('Informe o token do bridge antes de salvar.', 'error'); return false; }
  const name = proposal$('#project-title').value.trim() || 'Projeto Bongarbit';
  const method = projectState.id ? 'PUT' : 'POST'; const url = projectState.id ? `${BRIDGE_URL}/projects/${encodeURIComponent(projectState.id)}` : `${BRIDGE_URL}/projects`;
  const button = proposal$('#save-project'); if (!silent) { button.disabled = true; button.textContent = 'Salvando…'; }
  try {
    const r = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name, text: projectText() }) });
    const data = await r.json(); if (!r.ok) throw new Error(data.error || `Drive HTTP ${r.status}`);
    projectState.id = data.id; projectState.name = data.name; proposalState.projectId = data.id; proposal$('#project-title').value = data.name;
    await loadProjects(); proposal$('#project-select').value = data.id;
    if (!silent) setProposalMessage('Projeto salvo no Google Drive.', 'success');
    return true;
  } catch (error) { if (!silent) setProposalMessage(`Não foi possível salvar no Drive: ${error.message}`, 'error'); return false; }
  finally { if (!silent) { button.disabled = false; button.textContent = 'Salvar no Drive'; } }
}
let autosaveTimer = null;
function scheduleAutosave() {
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(async () => {
    if (!bridgeToken$()) return;
    const hasContent = proposal$('#proposal-input').value.trim() || proposal$('#summary-input').value.trim() || Object.values(proposalState.values).some(Boolean);
    if (!hasContent) return;
    const saved = await saveProject({ silent: true });
    if (saved) setProposalMessage('Alterações salvas automaticamente no Google Drive.', 'success');
  }, 1200);
}
proposal$('#project-select').addEventListener('change', event => loadProject(event.target.value));
proposal$('#new-project').addEventListener('click', clearProject);
proposal$('#save-project').addEventListener('click', saveProject);
['project-title', 'proposal-input', 'summary-input', 'field-input'].forEach(id => proposal$(`#${id}`).addEventListener('input', scheduleAutosave));
proposal$('#generate-summary').addEventListener('click', async () => {
  const description = proposal$('#proposal-input').value.trim();
  if (!description) return setProposalMessage('Escreva uma descrição antes de gerar o resumo.', 'error');
  const button = proposal$('#generate-summary'); button.disabled = true; button.textContent = 'Gerando…';
  try {
    const prompt = `Você está ajudando a formular uma proposta cultural para um edital. Gere apenas um resumo claro, fiel e editável a partir desta descrição:\n\n${description}`;
    const generated = await generateWithCodex(prompt);
    proposal$('#summary-input').value = generated || localDraft(description);
    showStage('summary');
    setProposalMessage(generated ? 'Resumo gerado pelo Codex. Revise antes de continuar.' : 'Bridge do Codex não conectado: foi criado um rascunho local para você editar. Nenhuma API foi chamada.', generated ? 'success' : 'warning');
  } catch (error) { setProposalMessage(`Não foi possível consultar o bridge do Codex: ${error.message}`, 'error'); }
  finally { button.disabled = false; button.textContent = 'Gerar resumo'; }
});
proposal$('#back-description').addEventListener('click', () => showStage('description'));
proposal$('#generate-first-field').addEventListener('click', () => { proposalState.fieldIndex = 0; proposalState.values.summary = proposal$('#summary-input').value.trim(); renderField(); showStage('fields'); setProposalMessage('Resumo salvo. Agora você pode gerar ou editar cada campo antes de avançar.'); });
proposal$('#back-summary').addEventListener('click', () => { proposalState.values[currentField().id] = proposal$('#field-input').value; proposal$('#summary-input').value = proposalState.values.summary || proposal$('#summary-input').value; showStage('summary'); });
proposal$('#generate-field').addEventListener('click', async () => {
  const field = currentField(); const summary = proposalState.values.summary || proposal$('#summary-input').value.trim();
  if (!summary) return setProposalMessage('Volte ao resumo e escreva a base da proposta.', 'error');
  const button = proposal$('#generate-field'); button.disabled = true; button.textContent = 'Gerando…';
  try {
    const prompt = `Preencha somente o campo “${field.name}” de uma proposta cultural. Instrução: ${field.instruction}\n\nResumo aprovado pelo usuário:\n${summary}`;
    const generated = await generateWithCodex(prompt);
    if (generated) { proposal$('#field-input').value = generated; setProposalMessage('Campo gerado pelo Codex. Revise e altere livremente.'); }
    else setProposalMessage('O bridge do Codex não está conectado. Escreva ou cole a resposta deste campo; ela será preservada.', 'warning');
  } catch (error) { setProposalMessage(`Não foi possível consultar o bridge do Codex: ${error.message}`, 'error'); }
  finally { button.disabled = false; button.textContent = 'Gerar / refazer'; }
});
proposal$('#next-field').addEventListener('click', () => {
  proposalState.values[currentField().id] = proposal$('#field-input').value.trim();
  if (proposalState.fieldIndex === formFields.length - 1) { setProposalMessage('Todos os campos foram salvos nesta sessão. Você pode voltar e revisar qualquer um deles.', 'success'); return; }
  proposalState.fieldIndex += 1; renderField(); setProposalMessage('Campo salvo. Revise este próximo campo antes de avançar.');
});
$('#send-chat').addEventListener('click', async () => {
  const question = $('#chat-input').value.trim();
  if (!question) return setProposalMessage('Escreva uma pergunta para o edital.', 'error');
  if (!bridgeToken$()) return setProposalMessage('Informe o token do bridge antes de perguntar.', 'error');
  if (!projectState.id) { await saveProject(); if (!projectState.id) return; }
  const button = $('#send-chat'); button.disabled = true; button.textContent = 'Consultando…';
  try {
    const prompt = `Responda à dúvida abaixo sobre o edital da Transpetro. Use o edital, regulamento, FAQ, formulário, legislação e documentos de contexto recuperados. Considere o projeto atual. Não invente exigências: diferencie regra explícita, interpretação e ponto que precisa ser confirmado. Cite o nome da fonte quando possível e termine com uma orientação prática.\n\nDÚVIDA:\n${question}`;
    const answer = await generateWithCodex(prompt);
    if (!answer) throw new Error('o bridge não retornou resposta');
    const response = await fetch(`${BRIDGE_URL}/projects/${encodeURIComponent(projectState.id)}/qa`, { method: 'POST', headers: { Authorization: `Bearer ${bridgeToken$()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ question, answer }) });
    const saved = await response.json(); if (!response.ok) throw new Error(saved.error || 'não foi possível salvar no Drive');
    chatState.messages.push({ question, answer }); chatState.qaUrl = saved.webViewLink || chatState.qaUrl; $('#chat-input').value = ''; $('#qa-drive-status').textContent = 'Perguntas salvas no Drive'; $('#qa-drive-status').classList.add('connected'); renderChat(); setProposalMessage('Resposta registrada no documento separado do Drive.', 'success');
  } catch (error) { setProposalMessage(`Não foi possível responder: ${error.message}`, 'error'); }
  finally { button.disabled = false; button.textContent = 'Perguntar'; }
});
refreshBridgeStatus();

const tasks = [
  { id: 'edital-leitura', title: 'Ler edital, regulamento e FAQ da Transpetro', meta: 'Registrar prazo, linha temática, critérios, limites e documentos exigidos', tag: 'edital', source: 'Edital / Regulamento / FAQ', status: 'pending' },
  { id: 'formulario-mapa', title: 'Conferir todos os campos do formulário', meta: 'Cruzar formulário, ficha do projeto e plano de preenchimento; marcar lacunas', tag: 'formulário', source: 'Formulário / Ficha / Plano de preenchimento', status: 'pending' },
  { id: 'proponente', title: 'Validar documentação do proponente', meta: 'Conferir CNPJ, representação, regularidade e documentos institucionais aplicáveis', tag: 'documentos', source: 'SALIC / Proponente / Compliance', status: 'pending' },
  { id: 'equipe-curriculos', title: 'Reunir currículos e comprovações da equipe', meta: 'Vincular cada função à experiência e guardar os comprovantes correspondentes', tag: 'equipe', source: 'Ficha do projeto / Portfólio / Currículos', status: 'pending' },
  { id: 'territorio-parcerias', title: 'Confirmar território, locais e parcerias', meta: 'Obter autorizações, cartas ou comprovações necessárias para os espaços e parceiros', tag: 'execução', source: 'Briefing / Ficha / Projeto', status: 'pending' },
  { id: 'metodologia', title: 'Fechar metodologia e plano de atividades', meta: 'Descrever etapas, oficinas, responsáveis, duração, materiais e resultados de cada ação', tag: 'metodologia', source: 'Planos de aula / Briefing / Formulário', status: 'pending' },
  { id: 'cronograma', title: 'Fechar cronograma físico de execução', meta: 'Compatibilizar preparação, atividades, circulação, comunicação, acessibilidade e prestação de contas', tag: 'cronograma', source: 'Formulário / Projeto / SALIC', status: 'pending' },
  { id: 'publico-acesso', title: 'Definir público, gratuidade e ampliação de acesso', meta: 'Informar quantidade, perfil, critérios de participação e medidas de democratização', tag: 'acesso', source: 'IN MinC 29/2026 / Ficha / Regulamento', status: 'pending' },
  { id: 'acessibilidade', title: 'Escolher e detalhar medidas de acessibilidade', meta: 'Verificar medidas obrigatórias e ações efetivas para pessoas com deficiência', tag: 'acessibilidade', source: 'IN MinC 29/2026 / Súmula CNIC 33', status: 'pending' },
  { id: 'comunicacao-marcas', title: 'Conferir comunicação e aplicação de marcas', meta: 'Planejar divulgação e obedecer ao manual de marcas e contrapartidas da chamada', tag: 'comunicação', source: 'Manual da Lei Rouanet / Regulamento', status: 'pending' },
  { id: 'orcamento-rubricas', title: 'Conferir orçamento, rubricas e quantitativos', meta: 'Revisar planilha, custos unitários, encargos, itens permitidos e coerência com o cronograma', tag: 'orçamento', source: 'Planilha SALIC / IN MinC 29/2026', status: 'pending' },
  { id: 'custos-vinculados', title: 'Validar custos vinculados e despesas administrativas', meta: 'Conferir limites, justificativas, remanejamento e compatibilidade com a legislação vigente', tag: 'orçamento', source: 'IN MinC 29/2026 / Planilha / Manual', status: 'pending' },
  { id: 'contrapartida', title: 'Fechar contrapartidas sociais e ações de difusão', meta: 'Descrever ações abertas, circulação, formação, gratuidade e retorno público', tag: 'contrapartida', source: 'Regulamento / Ficha / Projetos anteriores', status: 'pending' },
  { id: 'resultados', title: 'Definir produtos, metas e indicadores verificáveis', meta: 'Relacionar entregas, público alcançado, registros e meios de comprovação', tag: 'resultados', source: 'Formulário / Relatórios / Avaliação de resultados', status: 'pending' },
  { id: 'salic-compliance', title: 'Conferir exigências de SALIC e prestação de contas', meta: 'Mapear execução, monitoramento, comprovação, arquivos e responsáveis pelo registro', tag: 'SALIC', source: 'Índice SALIC / IN MinC 29/2026 / Compliance', status: 'pending' },
  { id: 'revisao-final', title: 'Fazer revisão final cruzada antes do envio', meta: 'Verificar se texto, orçamento, cronograma, documentos e anexos dizem a mesma coisa', tag: 'revisão', source: 'Todos os documentos do edital', status: 'pending' },
  { id: 'legislacao', title: 'Conferir a legislação central da Lei Rouanet', meta: 'Lei 8.313/1991, Decreto 11.453/2023 e IN MinC 29/2026', tag: 'legislação', source: 'Lista anterior de tarefas', status: 'pending' },
  { id: 'projetos', title: 'Ler os projetos anteriores reunidos na pasta Vale', meta: 'Selecionar ideias, textos e estruturas que podem ser reaproveitados', tag: 'projetos', source: 'Lista anterior de tarefas', status: 'pending' },
  { id: 'base', title: 'Definir o projeto-base para a próxima proposta', meta: 'Cruzar Ficha Vale, contexto Rouanet e experiências do Bongarbit', tag: 'decisão', source: 'Lista anterior de tarefas', status: 'pending' },
  { id: 'formulario', title: 'Revisar o formulário e o plano de preenchimento', meta: 'Identificar campos prontos, lacunas e informações que dependem de confirmação', tag: 'formulário', source: 'Lista anterior de tarefas', status: 'pending' },
  { id: 'orcamento', title: 'Conferir orçamento e rubricas', meta: 'Usar a planilha de produção do SALIC como referência, sem duplicar versões', tag: 'orçamento', source: 'Lista anterior de tarefas', status: 'pending' },
  { id: 'anexos', title: 'Validar documentos e anexos do proponente', meta: 'CNPJ, estatuto, portfólio, currículos e comprovações', tag: 'anexos', source: 'Lista anterior de tarefas', status: 'pending' },
  { id: 'indice', title: 'Manter o índice de projetos e legislação atualizado', meta: 'Adicionar novos documentos sem criar atalhos de pastas', tag: 'organização', source: 'Lista anterior de tarefas', status: 'pending' }
];


const links = [
  { type: 'documento', title: 'Mapa do contexto para preenchimento do formulário', note: 'Como cada fonte orienta a escrita dos campos', url: 'https://drive.google.com/file/d/1_-8joyRXruGXlAOeO4bhBlS0XWnLkJDy/view?usp=drivesdk' },
  { type: 'documento', title: 'Índice de projetos e legislação', note: 'Referências individuais organizadas no Drive', url: 'https://drive.google.com/file/d/1XT26JtoRzWTHf9Zkg7LiHQNtAb_7ee5j/view?usp=drivesdk' },
  { type: 'documento', title: 'Ficha do projeto Bongarbit', note: 'Texto-base do projeto', url: 'https://drive.google.com/file/d/1Tlyo1oBxoCOCKY84xBxcGexB_26De2rX/view?usp=drivesdk' },
  { type: 'documento', title: 'Ficha do projeto Bongarbit — revisada', note: 'Versão editável da ficha', url: 'https://docs.google.com/document/d/1dkfKBODwm1DJuhbZUP7-Ttnm7Ti0tOo1/edit?usp=drivesdk' },
  { type: 'documento', title: 'Formulário do projeto', note: 'Campos extraídos e organizados', url: 'https://drive.google.com/file/d/1bYTv4ttRoF8Exae_vlwXZLsqmOw-hvLk/view?usp=drivesdk' },
  { type: 'documento', title: 'Plano de preenchimento do formulário', note: 'Roteiro para transformar pesquisa em proposta', url: 'https://drive.google.com/file/d/1MRIiLoMoYX63_ZZXbT2uS6DDsGe9QYqL/view?usp=drivesdk' },
  { type: 'documento', title: 'Regulamento da chamada 2026', note: 'Regras, critérios e requisitos do edital', url: 'https://drive.google.com/file/d/1Gzvdlb3RLxWPOXsyb3cOYAYsBCAd0N4D/view?usp=drivesdk' },
  { type: 'documento', title: 'Orçamento Plataforma SALIC / Lei Rouanet', note: 'Planilha de produção e orçamento', url: 'https://drive.google.com/file/d/1C0ss9shjVZqADz-8Ph5HLnagp_AmXhA_/view?usp=drivesdk' },
  { type: 'documento', title: 'Projeto Escola Bongarbit — dados SALIC', note: 'Referência de tramitação, execução e resultados', url: 'https://drive.google.com/file/d/1yTirbV1NhXQ1quqCzx1xW4AL-9ZPnYiF/view?usp=drivesdk' },
  { type: 'documento', title: 'Plano de aula — Engome 1', note: 'Metodologia e sequência pedagógica', url: 'https://drive.google.com/file/d/12-WKf4h4XICLKQsuRmVhJf49TS55HEzu/view?usp=drivesdk' },
  { type: 'documento', title: 'Plano de aula — Agbe 1', note: 'Metodologia e sequência pedagógica', url: 'https://drive.google.com/file/d/12nRHBFOwR5C3nvaf6_QH9ySVpC9qnSfz/view?usp=drivesdk' },
  { type: 'documento', title: 'Plano de aula — Tambor Falante 1', note: 'Metodologia e sequência pedagógica', url: 'https://drive.google.com/file/d/1nCROT6rgngkgAvFCYlyzuyUvG2o-9tVB/view?usp=drivesdk' },
  { type: 'documento', title: 'Plano de aula — Berimbau 1', note: 'Metodologia e sequência pedagógica', url: 'https://drive.google.com/file/d/1IOz6f-l2yPbB-Mar4oAp0uLd4aze98Zo/view?usp=drivesdk' },
  { type: 'documento', title: 'Relatório parcial — Bongarbit / Instituto Fab Lab Recife', note: 'Experiência e resultados anteriores', url: 'https://drive.google.com/file/d/1RX5oZwYFHEx3tU_pLvjNPfkrDwJDrLYe/view?usp=drivesdk' },
  { type: 'documento', title: 'Relatório final — Instrumentos para o Carnaval de Rua', note: 'Experiência e resultados anteriores', url: 'https://drive.google.com/file/d/1nlGNPaFnlivbGA_wx47WefPVb3Gvfy-D/view?usp=drivesdk' },
  { type: 'documento', title: 'Projeto Erê Sankofa', note: 'Projeto anterior usado como referência', url: 'https://drive.google.com/file/d/1e3GAPZWaxSiJnSAOXAKonj427SF7fIDN/view?usp=drivesdk' },
  { type: 'documento', title: 'Contexto do projeto Rumos', note: 'Experiência anterior do Bongarbit', url: 'https://drive.google.com/file/d/1tAE6PSYoge6x3kWHb4QUQEc9C8Ks1k-q/view?usp=drivesdk' },
  { type: 'documento', title: 'Contexto do Funcultura Carnaval', note: 'Outra proposta anterior para comparação', url: 'https://drive.google.com/file/d/1_9z5X6keAOfcyF53jXTJ-9bIk1dAsEk9/view?usp=drivesdk' }
];

const state = { filter: 'all', query: '' };
const chatState = { messages: [], qaUrl: '' };
const $ = (selector) => document.querySelector(selector);

function matches(item) {
  const haystack = Object.values(item).join(' ').toLowerCase();
  const queryMatch = haystack.includes(state.query.toLowerCase());
  const type = item.status ? 'task' : item.type === 'pasta' ? 'folder' : 'document';
  const statusMatch = state.filter === 'pending' ? item.status === 'pending' : state.filter === 'done' ? item.status === 'done' : true;
  const typeMatch = ['pending', 'done'].includes(state.filter) ? type === 'task' : state.filter === 'all' || state.filter === type;
  return queryMatch && statusMatch && typeMatch;
}

function render() {
  const visibleTasks = tasks.filter(matches);
  const visibleLinks = links.filter(matches);
  $('#tasks').innerHTML = visibleTasks.length ? visibleTasks.map(task => `
    <label class="task ${task.status === 'done' ? 'done' : ''}">
      <input class="check" type="checkbox" data-id="${task.id}" ${task.status === 'done' ? 'checked' : ''} aria-label="Concluir: ${task.title}" />
      <span><span class="task-title">${task.title}</span><span class="task-meta">${task.meta}</span><small class="task-source">Fonte: ${task.source || 'contexto do projeto'}</small></span>
      <span class="tag">${task.tag}</span>
    </label>`).join('') : '<p class="empty">Nenhum item corresponde à busca.</p>';
  $('#links').innerHTML = visibleLinks.length ? visibleLinks.map(link => `
    <a class="drive-link" href="${link.url}" target="_blank" rel="noreferrer">
      <span class="link-type">${link.type}</span><strong>${link.title}</strong><small>${link.note}</small>
    </a>`).join('') : '<p class="empty">Nenhum documento corresponde à busca.</p>';
  $('#pending-count').textContent = tasks.filter(t => t.status !== 'done').length;
  $('#done-count').textContent = tasks.filter(t => t.status === 'done').length;
  $('#document-count').textContent = links.length;
  document.querySelectorAll('.check').forEach(input => input.addEventListener('change', () => {
    const task = tasks.find(t => t.id === input.dataset.id);
    task.status = input.checked ? 'done' : 'pending';
    render();
    saveTasksToDrive();
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
