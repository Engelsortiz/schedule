// Estado principal
const state = {
  turno: 'diurno',
  blockMinutes: 45,
  clases: [],
  docentes: [],
  areas: [],
  coordinaciones: [],
  carreras: [],
  conflictos: [],
  // Configuración por turno
  turnoConfig: {},
  // Periodos separados por turno
  periodosPorTurno: {},
  // Filtros activos de generación y vista (desacoplados)
  activeSelection: { coordinacion: '', carrera: '', turno: 'diurno', periodo: '' },
  viewSelection: { coordinacion: '', carrera: '', turno: 'diurno' },
  // Horarios generados por combinación coordinación/carrera/turno/año
  schedulesByCombo: {}
};

const DEFAULT_YEARS = [1, 2, 3, 4, 5];
const DEFAULT_PRIORITY = { Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5 };

const el = {
  sidebar: document.getElementById('sidebar'),
  btnMenu: document.getElementById('btn-menu'),
  tabs: document.querySelectorAll('.tab'),
  principalView: document.getElementById('principal-view'),
  configView: document.getElementById('config-view'),
  turnoSelect: document.getElementById('turno-select'),
  csvFile: document.getElementById('csv-file'),
  btnImportCsv: document.getElementById('btn-import-csv'),
  csvFeedback: document.getElementById('csv-feedback'),
  clasesTbody: document.getElementById('clases-tbody'),
  btnAddClase: document.getElementById('btn-add-clase'),
  btnGenerar: document.getElementById('btn-generar'),
  btnLimpiar: document.getElementById('btn-limpiar'),
  vistaTable: document.getElementById('vista-table'),
  vistaThead: document.getElementById('vista-thead'),
  vistaTbody: document.getElementById('vista-tbody'),
  console: document.getElementById('console'),
  breakStart: document.getElementById('break-start'),
  lunchStart: document.getElementById('lunch-start'),
  cfgTurnoDefault: document.getElementById('cfg-turno-default'),
  cfgBlockMin: document.getElementById('cfg-block-min'),
  btnSaveConfig: document.getElementById('btn-save-config'),
  docenteNombre: document.getElementById('docente-nombre'),
  docenteArea: document.getElementById('docente-area'),
  btnAddDocente: document.getElementById('btn-add-docente'),
  docentesList: document.getElementById('docentes-list'),
  coordNombre: document.getElementById('coord-nombre'),
  carreraNombre: document.getElementById('carrera-nombre'),
  btnAddCarrera: document.getElementById('btn-add-carrera'),
  carrerasList: document.getElementById('carreras-list')
};

// ---------- Utilidades ----------
function safeText(value) { return String(value ?? '').trim(); }
function normalize(value) { return safeText(value).toLowerCase(); }
function toMinutes(hhmm) { const [h, m] = (hhmm || '08:00').split(':').map(Number); return (h * 60) + m; }
function toHHMM(minutes) { return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }
function comboKey(coordinacion, carrera, turno) { return `${normalize(coordinacion)}|${normalize(carrera)}|${normalize(turno)}`; }

function logMessage(message, type = 'ok') {
  if (!el.console) return;
  const line = document.createElement('div');
  line.className = type;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  el.console.appendChild(line);
  el.console.scrollTop = el.console.scrollHeight;
}

// ---------- Configuración por turno ----------
function ensureTurnoConfig(turno) {
  if (!state.turnoConfig[turno]) {
    state.turnoConfig[turno] = {
      diasHabilitados: 'Lunes,Martes,Miércoles,Jueves,Viernes',
      prioridadDias: 'Lunes:1,Martes:2,Miércoles:3,Jueves:4,Viernes:5',
      horaInicio: '08:00'
    };
  }
  if (!state.periodosPorTurno[turno]) state.periodosPorTurno[turno] = [];
}

function parseDaysConfig(turno) {
  ensureTurnoConfig(turno);
  const dias = state.turnoConfig[turno].diasHabilitados.split(',').map((d) => safeText(d)).filter(Boolean);
  return dias.length ? dias : Object.keys(DEFAULT_PRIORITY);
}

function parsePriorityConfig(turno) {
  ensureTurnoConfig(turno);
  const raw = safeText(state.turnoConfig[turno].prioridadDias);
  if (!raw) return { ...DEFAULT_PRIORITY };
  const out = {};
  raw.split(',').forEach((item) => {
    const [dia, p] = item.split(':').map(safeText);
    const n = Number(p);
    if (dia && Number.isFinite(n)) out[dia] = n;
  });
  return Object.keys(out).length ? out : { ...DEFAULT_PRIORITY };
}

function getBlocks(turno) {
  ensureTurnoConfig(turno);
  const start = toMinutes(state.turnoConfig[turno].horaInicio || '08:00');
  const end = (turno === 'sabatino' || turno === 'dominical') ? toMinutes('17:00') : toMinutes('16:00');
  const blocks = [];
  for (let t = start; t < end; t += state.blockMinutes) {
    const label = `${toHHMM(t)}-${toHHMM(t + state.blockMinutes)}`;
    blocks.push({ label, start: t, end: t + state.blockMinutes, type: 'class' });
  }
  const recesoMin = toMinutes(el.breakStart?.value || '10:15');
  const almuerzoMin = toMinutes(el.lunchStart?.value || '12:00');
  return blocks.map((b) => {
    if (b.start === recesoMin) return { ...b, type: 'receso' };
    if (b.start === almuerzoMin) return { ...b, type: 'almuerzo' };
    return b;
  });
}

// ---------- Persistencia ----------
function loadStorage() {
  const raw = localStorage.getItem('schedule-state-v3');
  if (!raw) return;
  try { Object.assign(state, JSON.parse(raw)); } catch { logMessage('No se pudo restaurar localStorage.', 'warn'); }
}

function saveStorage() {
  localStorage.setItem('schedule-state-v3', JSON.stringify({
    turno: state.turno,
    blockMinutes: state.blockMinutes,
    clases: state.clases,
    docentes: state.docentes,
    areas: state.areas,
    coordinaciones: state.coordinaciones,
    carreras: state.carreras,
    turnoConfig: state.turnoConfig,
    periodosPorTurno: state.periodosPorTurno,
    activeSelection: state.activeSelection,
    viewSelection: state.viewSelection,
    schedulesByCombo: state.schedulesByCombo
  }));
}

// ---------- UI dinámica sin tocar HTML base ----------
function setupDynamicSelectors() {
  const cargaBody = document.querySelector('#carga .panel-body.form-grid');
  if (!cargaBody || document.getElementById('coord-select-top')) return;

  const mkSelect = (id, text) => {
    const label = document.createElement('label');
    label.textContent = text;
    const s = document.createElement('select');
    s.id = id;
    label.appendChild(s);
    return { label, select: s };
  };

  const coord = mkSelect('coord-select-top', 'Coordinación');
  const carrera = mkSelect('carrera-select-top', 'Carrera');
  cargaBody.insertBefore(coord.label, el.btnImportCsv);
  cargaBody.insertBefore(carrera.label, el.btnImportCsv);

  const vistaPanel = document.querySelector('#vista .panel-body');
  const filterWrap = document.createElement('div');
  filterWrap.className = 'form-grid row-3';
  filterWrap.innerHTML = `
    <label>Vista coordinación<select id="vista-coord-select"></select></label>
    <label>Vista carrera<select id="vista-carrera-select"></select></label>
    <label>Vista turno<select id="vista-turno-select"><option value="diurno">Diurno</option><option value="sabatino">Sabatino</option><option value="dominical">Dominical</option></select></label>`;
  vistaPanel.insertBefore(filterWrap, vistaPanel.firstChild);

  const genBody = document.querySelector('#generacion .panel-body.form-grid');
  const periodoLabel = document.createElement('label');
  periodoLabel.textContent = 'Periodo';
  const periodoSelect = document.createElement('select');
  periodoSelect.id = 'periodo-select';
  periodoLabel.appendChild(periodoSelect);
  genBody.appendChild(periodoLabel);

  // Campos para bloque manual
  const asignacionGrid = document.querySelector('#asignacion .panel-body.form-grid');
  const dayLabel = document.createElement('label');
  dayLabel.textContent = 'Día';
  dayLabel.innerHTML += '<select id="manual-dia"></select>';
  const blockLabel = document.createElement('label');
  blockLabel.textContent = 'Bloque';
  blockLabel.innerHTML += '<select id="manual-bloque"></select>';
  const anioInput = document.getElementById('manual-anio');
  if (anioInput) {
    const select = document.createElement('select');
    select.id = 'manual-anio';
    DEFAULT_YEARS.forEach((y) => { const o = document.createElement('option'); o.value = y; o.textContent = y; select.appendChild(o); });
    anioInput.replaceWith(select);
  }
  asignacionGrid.appendChild(dayLabel);
  asignacionGrid.appendChild(blockLabel);

  // Configuración simplificada de turnos
  const turnoGrid = document.querySelector('#turnos-config .panel-body.form-grid');
  const labels = Array.from(turnoGrid.querySelectorAll('label'));
  labels.forEach((l) => { l.style.display = 'none'; });
  const keep = document.createElement('div');
  keep.className = 'form-grid row-4';
  keep.innerHTML = `
    <label>Días habilitados (separados por coma)<input id="cfg-dias-habilitados" type="text" /></label>
    <label>Prioridad de días (formato: Lunes:1,Martes:2,...)<input id="cfg-prioridad-dias" type="text" /></label>
    <label>Hora de inicio de clases<input id="cfg-hora-inicio" type="time" value="08:00" /></label>`;
  turnoGrid.insertBefore(keep, el.btnSaveConfig);

  // Config de periodos: asignar IDs y lista dinámica
  const pSection = document.getElementById('periodos-config');
  const pInputs = pSection.querySelectorAll('input');
  if (pInputs[0]) pInputs[0].id = 'periodo-input';
  const pBtn = pSection.querySelector('button.btn-dark');
  if (pBtn) pBtn.id = 'btn-add-periodo';
  const pList = pSection.querySelector('ul.list');
  if (pList) pList.id = 'periodos-list';
}

function refreshSelectors() {
  const coordSelect = document.getElementById('coord-select-top');
  const carreraSelect = document.getElementById('carrera-select-top');
  const vistaCoord = document.getElementById('vista-coord-select');
  const vistaCarrera = document.getElementById('vista-carrera-select');
  const periodoSelect = document.getElementById('periodo-select');
  const manualDia = document.getElementById('manual-dia');
  const manualBloque = document.getElementById('manual-bloque');

  const coords = [...new Set(state.carreras.map((c) => c.coordinacion))];
  const setOptions = (select, values, current, allowEmpty = false) => {
    if (!select) return current;
    const old = current || select.value;
    const opts = [];
    if (allowEmpty) opts.push('<option value="">(Sin selección)</option>');
    opts.push(...values.map((v) => `<option value="${v}">${v}</option>`));
    select.innerHTML = opts.join('');
    if (values.includes(old)) select.value = old;
    else if (allowEmpty) select.value = '';
    else if (values[0]) select.value = values[0];
    return select.value;
  };

  state.activeSelection.coordinacion = setOptions(coordSelect, coords, state.activeSelection.coordinacion, true);
  state.viewSelection.coordinacion = setOptions(vistaCoord, coords, state.viewSelection.coordinacion, true);

  const carrerasActivas = state.carreras
    .filter((c) => !state.activeSelection.coordinacion || c.coordinacion === state.activeSelection.coordinacion)
    .map((c) => c.carrera);
  const carrerasVista = state.carreras
    .filter((c) => !state.viewSelection.coordinacion || c.coordinacion === state.viewSelection.coordinacion)
    .map((c) => c.carrera);

  state.activeSelection.carrera = setOptions(carreraSelect, [...new Set(carrerasActivas)], state.activeSelection.carrera, true);
  state.viewSelection.carrera = setOptions(vistaCarrera, [...new Set(carrerasVista)], state.viewSelection.carrera, true);

  state.activeSelection.turno = el.turnoSelect?.value || state.activeSelection.turno;
  if (periodoSelect) {
    ensureTurnoConfig(state.activeSelection.turno);
    const periodos = state.periodosPorTurno[state.activeSelection.turno] || [];
    state.activeSelection.periodo = setOptions(periodoSelect, periodos, state.activeSelection.periodo, true);
  }

  const days = parseDaysConfig(state.activeSelection.turno);
  setOptions(manualDia, days, manualDia?.value || days[0]);
  const classBlocks = getBlocks(state.activeSelection.turno).filter((b) => b.type === 'class').map((b) => b.label);
  setOptions(manualBloque, classBlocks, manualBloque?.value || classBlocks[0]);

  saveStorage();
}

// ---------- CSV ----------
function parseCSVLine(line) {
  const cols = []; let token = ''; let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) { cols.push(token.trim()); token = ''; }
    else token += ch;
  }
  cols.push(token.trim());
  return cols;
}

async function importCSV() {
  const file = el.csvFile.files?.[0];
  if (!file) return logMessage('Selecciona un archivo CSV primero.', 'error');
  const text = await file.text();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return logMessage('CSV vacío.', 'error');

  const headers = parseCSVLine(lines[0]).map(normalize);
  const required = ['clase', 'creditos', 'compartida', 'anio', 'categoria', 'tipo', 'aula', 'docente'];
  const missing = required.filter((h) => !headers.includes(h));
  if (missing.length) {
    el.csvFeedback.textContent = `Error: faltan columnas ${missing.join(', ')}`;
    return logMessage(`Faltan columnas obligatorias: ${missing.join(', ')}`, 'error');
  }

  const idx = Object.fromEntries(required.map((name) => [name, headers.indexOf(name)]));
  const currentCoord = safeText(state.activeSelection.coordinacion);
  const currentCarrera = safeText(state.activeSelection.carrera);
  const currentTurno = safeText(state.activeSelection.turno);

  const imported = lines.slice(1).map(parseCSVLine).map((r) => ({
    clase: safeText(r[idx.clase]),
    creditos: Math.max(1, Number(r[idx.creditos]) || 1),
    compartida: safeText(r[idx.compartida]),
    anio: Number(r[idx.anio]) || 1,
    categoria: safeText(r[idx.categoria]) || 'General',
    tipo: safeText(r[idx.tipo]) || 'Teoría',
    aula: safeText(r[idx.aula]) || 'SIN-AULA',
    docente: safeText(r[idx.docente]) || 'SIN-DOCENTE',
    coordinacion: currentCoord,
    carrera: currentCarrera,
    turno: currentTurno,
    origen: 'csv'
  })).filter((c) => c.clase);

  state.clases.push(...imported);
  renderClases();
  refreshSelectors();
  saveStorage();
  el.csvFeedback.textContent = `Importadas ${imported.length} clases.`;
  logMessage(`CSV importado correctamente. Años detectados: ${[...new Set(imported.map((c) => c.anio))].join(', ') || 'ninguno'}.`, 'ok');
}

// ---------- Gestión manual ----------
function getCurrentComboOrWarn() {
  const coordinacion = safeText(state.activeSelection.coordinacion);
  const carrera = safeText(state.activeSelection.carrera);
  if (!carrera) {
    logMessage('Selecciona una carrera primero', 'warn');
    return null;
  }
  return { coordinacion, carrera, turno: safeText(state.activeSelection.turno) };
}

function addManualClase() {
  const combo = getCurrentComboOrWarn();
  if (!combo) return;

  const clase = safeText(document.getElementById('manual-clase')?.value);
  const anio = Number(document.getElementById('manual-anio')?.value || 1);
  const day = safeText(document.getElementById('manual-dia')?.value);
  const block = safeText(document.getElementById('manual-bloque')?.value);

  if (!clase) return logMessage('La clase es obligatoria.', 'error');
  if (!day || !block) return logMessage('Debes seleccionar día y bloque.', 'error');

  const item = {
    clase,
    creditos: Math.max(1, Number(document.getElementById('manual-creditos')?.value) || 1),
    compartida: 'No',
    anio,
    categoria: safeText(document.getElementById('manual-categoria')?.value) || 'General',
    tipo: safeText(document.getElementById('manual-tipo')?.value) || 'Teoría',
    aula: safeText(document.getElementById('manual-aula')?.value) || 'SIN-AULA',
    docente: safeText(document.getElementById('manual-docente')?.value) || 'SIN-DOCENTE',
    ...combo,
    origen: 'manual',
    fixedSlot: { day, block }
  };

  // Reemplazo en bloque/hora para el mismo año/carrera/turno/coordinación
  const key = comboKey(combo.coordinacion, combo.carrera, combo.turno);
  const yearSchedule = state.schedulesByCombo[key]?.[anio];
  const currentCell = yearSchedule?.[day]?.[block];
  if (currentCell && !currentCell.type) {
    const ok = window.confirm(`Se reemplazará la clase actual para el año ${anio} de la carrera ${combo.carrera} en este bloque. ¿Deseas continuar?`);
    if (!ok) return;
  }

  state.clases.push(item);
  if (!state.schedulesByCombo[key]) state.schedulesByCombo[key] = {};
  if (!state.schedulesByCombo[key][anio]) {
    state.schedulesByCombo[key][anio] = buildEmptySchedule(parseDaysConfig(combo.turno), getBlocks(combo.turno));
  }
  state.schedulesByCombo[key][anio][day][block] = { clase: item.clase, docente: item.docente, aula: item.aula, tipo: item.tipo };

  renderClases();
  renderSchedulesByView();
  saveStorage();
  logMessage(`Clase manual agregada en ${day} ${block} (Año ${anio}).`, 'ok');
}

function addDocenteArea() {
  const docente = safeText(el.docenteNombre?.value);
  const area = safeText(el.docenteArea?.value);
  if (!docente || !area) return logMessage('Docente y área son obligatorios.', 'error');
  state.docentes.push({ docente, area });
  if (!state.areas.includes(area)) state.areas.push(area);
  renderDocentes(); saveStorage();
}

function addCarreraCoord() {
  const coordinacion = safeText(el.coordNombre?.value);
  const carrera = safeText(el.carreraNombre?.value);
  if (!coordinacion || !carrera) return logMessage('Coordinación y carrera son obligatorios.', 'error');
  state.carreras.push({ coordinacion, carrera });
  if (!state.coordinaciones.includes(coordinacion)) state.coordinaciones.push(coordinacion);
  refreshSelectors(); renderCarreras(); saveStorage();
}

// ---------- Generación ----------
function buildEmptySchedule(days, blocks) {
  const out = {};
  days.forEach((d) => {
    out[d] = {};
    blocks.forEach((b) => { out[d][b.label] = b.type === 'class' ? null : { type: b.type }; });
  });
  return out;
}

function hasConflict(schedule, day, slot, clase) {
  const current = schedule[day][slot];
  if (current) return true;
  const allCells = Object.values(schedule[day]).filter((c) => c && !c.type);
  return allCells.some((c) => c.docente === clase.docente || c.aula === clase.aula);
}

function findContiguousSlots(schedule, day, needed, blocks, clase) {
  for (let i = 0; i <= blocks.length - needed; i += 1) {
    const w = blocks.slice(i, i + needed);
    if (w.every((b) => b.type === 'class' && !hasConflict(schedule, day, b.label, clase))) return w.map((b) => b.label);
  }
  return null;
}

function generateSchedule() {
  const combo = getCurrentComboOrWarn();
  if (!combo) return;

  const periodo = safeText(document.getElementById('periodo-select')?.value);
  if (!periodo) return logMessage('Selecciona un periodo para generar.', 'warn');

  const filtered = state.clases.filter((c) =>
    normalize(c.coordinacion) === normalize(combo.coordinacion)
    && normalize(c.carrera) === normalize(combo.carrera)
    && normalize(c.turno) === normalize(combo.turno));

  if (!filtered.length) return logMessage('No hay clases para esa combinación (coordinación/carrera/turno).', 'warn');

  const key = comboKey(combo.coordinacion, combo.carrera, combo.turno);
  const yearsDetected = [...new Set(filtered.map((c) => Number(c.anio) || 1))];
  const yearsToRender = [...new Set([...DEFAULT_YEARS, ...yearsDetected])].sort((a, b) => a - b);
  const days = parseDaysConfig(combo.turno).sort((a, b) => (parsePriorityConfig(combo.turno)[a] || 999) - (parsePriorityConfig(combo.turno)[b] || 999));
  const blocks = getBlocks(combo.turno);

  if (!state.schedulesByCombo[key]) state.schedulesByCombo[key] = {};

  yearsToRender.forEach((anio) => {
    const byYear = filtered.filter((c) => Number(c.anio) === anio);
    const schedule = buildEmptySchedule(days, blocks);

    // fijar primero clases manuales con slot fijo
    byYear.filter((c) => c.fixedSlot).forEach((c) => {
      const { day, block } = c.fixedSlot;
      if (schedule[day]?.[block] === null) schedule[day][block] = { clase: c.clase, docente: c.docente, aula: c.aula, tipo: c.tipo };
    });

    byYear.sort((a, b) => b.creditos - a.creditos).forEach((clase) => {
      if (clase.fixedSlot) return;
      const needed = Math.max(1, Number(clase.creditos) || 1);
      for (const day of days) {
        const slots = findContiguousSlots(schedule, day, needed, blocks, clase);
        if (slots) { slots.forEach((s) => { schedule[day][s] = { clase: clase.clase, docente: clase.docente, aula: clase.aula, tipo: clase.tipo }; }); break; }
      }
    });

    state.schedulesByCombo[key][anio] = schedule;
  });

  saveStorage();
  renderSchedulesByView();
  logMessage(`Generación finalizada para ${combo.carrera} (${combo.turno}) en periodo ${periodo}.`, 'ok');
}

function clearSchedule() {
  // Limpiar solo celdas generadas; no tocar configuración ni clases importadas
  state.schedulesByCombo = {};
  state.conflictos = [];
  renderSchedulesByView();
  saveStorage();
  logMessage('Se limpiaron únicamente los horarios generados.', 'ok');
}

// ---------- Render ----------
function renderClases() {
  if (!el.clasesTbody) return;
  el.clasesTbody.innerHTML = state.clases.map((c) => `
    <tr>
      <td>${c.clase}</td><td>${c.creditos}</td><td>${c.aula}</td><td>${c.docente}</td><td>${c.tipo}</td>
    </tr>`).join('');
}

function renderDocentes() { if (el.docentesList) el.docentesList.innerHTML = state.docentes.map((d) => `<li><strong>${d.docente}</strong> · ${d.area}</li>`).join(''); }
function renderCarreras() { if (el.carrerasList) el.carrerasList.innerHTML = state.carreras.map((c) => `<li><strong>${c.coordinacion}</strong> → ${c.carrera}</li>`).join(''); }

function renderSchedulesByView() {
  const coord = safeText(state.viewSelection.coordinacion);
  const carrera = safeText(state.viewSelection.carrera);
  const turno = safeText(state.viewSelection.turno || state.activeSelection.turno);
  const key = comboKey(coord, carrera, turno);
  const schedules = state.schedulesByCombo[key] || {};
  const years = [...new Set([...DEFAULT_YEARS, ...Object.keys(schedules).map(Number)])].sort((a, b) => a - b);
  const blocks = getBlocks(turno);
  const days = parseDaysConfig(turno);

  const container = el.vistaTable?.parentElement;
  if (!container) return;
  container.innerHTML = years.map((year) => {
    const sched = schedules[year] || buildEmptySchedule(days, blocks);
    const header = `<tr><th>Bloque</th>${days.map((d) => `<th>${d}</th>`).join('')}</tr>`;
    const rows = blocks.map((b) => {
      const cells = days.map((day) => {
        const entry = sched?.[day]?.[b.label];
        if (!entry) return '<td></td>';
        if (entry.type === 'receso') return '<td class="block-receso">RECESO</td>';
        if (entry.type === 'almuerzo') return '<td class="block-almuerzo">ALMUERZO</td>';
        return `<td class="celda-clase"><strong>${entry.clase}</strong><br><small>${entry.aula} · ${entry.docente}</small></td>`;
      }).join('');
      return `<tr><td>${b.label}</td>${cells}</tr>`;
    }).join('');
    return `<h4>Año ${year}</h4><table><thead>${header}</thead><tbody>${rows}</tbody></table><br/>`;
  }).join('');
}

function renderPeriodos() {
  const list = document.getElementById('periodos-list');
  if (!list) return;
  ensureTurnoConfig(state.activeSelection.turno);
  const arr = state.periodosPorTurno[state.activeSelection.turno] || [];
  list.innerHTML = arr.map((p, idx) => `<li>${p} <button class="btn btn-outline" type="button" data-del-periodo="${idx}">Eliminar</button></li>`).join('') || '<li>Sin periodos para este turno.</li>';
}

function bindSelectorsEvents() {
  document.getElementById('coord-select-top')?.addEventListener('change', (e) => { state.activeSelection.coordinacion = e.target.value; refreshSelectors(); renderSchedulesByView(); });
  document.getElementById('carrera-select-top')?.addEventListener('change', (e) => { state.activeSelection.carrera = e.target.value; saveStorage(); });
  document.getElementById('vista-coord-select')?.addEventListener('change', (e) => { state.viewSelection.coordinacion = e.target.value; refreshSelectors(); renderSchedulesByView(); });
  document.getElementById('vista-carrera-select')?.addEventListener('change', (e) => { state.viewSelection.carrera = e.target.value; renderSchedulesByView(); saveStorage(); });
  document.getElementById('vista-turno-select')?.addEventListener('change', (e) => { state.viewSelection.turno = e.target.value; renderSchedulesByView(); saveStorage(); });

  document.getElementById('btn-add-periodo')?.addEventListener('click', () => {
    const p = safeText(document.getElementById('periodo-input')?.value);
    if (!p) return;
    ensureTurnoConfig(state.activeSelection.turno);
    if (!state.periodosPorTurno[state.activeSelection.turno].includes(p)) state.periodosPorTurno[state.activeSelection.turno].push(p);
    refreshSelectors(); renderPeriodos(); saveStorage();
  });

  document.getElementById('periodos-list')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-del-periodo]');
    if (!btn) return;
    const idx = Number(btn.getAttribute('data-del-periodo'));
    ensureTurnoConfig(state.activeSelection.turno);
    state.periodosPorTurno[state.activeSelection.turno].splice(idx, 1);
    refreshSelectors(); renderPeriodos(); saveStorage();
  });
}

function setView(view) {
  if (!el.principalView || !el.configView) return;
  const principal = view === 'principal';
  el.principalView.classList.toggle('hidden', !principal);
  el.configView.classList.toggle('hidden', principal);
  el.tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === view));
}

function setupNavigation() {
  el.btnMenu?.addEventListener('click', () => el.sidebar?.classList.toggle('open'));
  el.tabs.forEach((tab) => tab.addEventListener('click', () => setView(tab.dataset.tab)));
}

function initConfigUI() {
  const turno = state.activeSelection.turno || state.turno;
  ensureTurnoConfig(turno);
  document.getElementById('cfg-dias-habilitados').value = state.turnoConfig[turno].diasHabilitados;
  document.getElementById('cfg-prioridad-dias').value = state.turnoConfig[turno].prioridadDias || 'Lunes:1,Martes:2,Miércoles:3,Jueves:4,Viernes:5';
  document.getElementById('cfg-hora-inicio').value = state.turnoConfig[turno].horaInicio || '08:00';
}

function renderAll() {
  el.turnoSelect.value = state.turno;
  renderClases(); renderDocentes(); renderCarreras();
  refreshSelectors(); renderPeriodos(); renderSchedulesByView();
  initConfigUI();
}

// ---------- Eventos base ----------
el.btnImportCsv?.addEventListener('click', importCSV);
el.btnAddClase?.addEventListener('click', addManualClase);
el.btnGenerar?.addEventListener('click', generateSchedule);
el.btnLimpiar?.addEventListener('click', clearSchedule);
el.btnAddDocente?.addEventListener('click', addDocenteArea);
el.btnAddCarrera?.addEventListener('click', addCarreraCoord);

el.btnSaveConfig?.addEventListener('click', () => {
  const turno = state.activeSelection.turno || el.turnoSelect.value;
  ensureTurnoConfig(turno);
  state.turno = el.cfgTurnoDefault?.value || turno;
  state.blockMinutes = Math.max(30, Number(el.cfgBlockMin?.value) || 45);
  state.turnoConfig[turno].diasHabilitados = safeText(document.getElementById('cfg-dias-habilitados')?.value) || 'Lunes,Martes,Miércoles,Jueves,Viernes';
  state.turnoConfig[turno].prioridadDias = safeText(document.getElementById('cfg-prioridad-dias')?.value) || 'Lunes:1,Martes:2,Miércoles:3,Jueves:4,Viernes:5';
  state.turnoConfig[turno].horaInicio = safeText(document.getElementById('cfg-hora-inicio')?.value) || '08:00';
  saveStorage(); refreshSelectors(); renderSchedulesByView();
  logMessage('Configuración de turno guardada.', 'ok');
});

el.turnoSelect?.addEventListener('change', () => {
  state.activeSelection.turno = el.turnoSelect.value;
  state.viewSelection.turno = state.viewSelection.turno || el.turnoSelect.value;
  ensureTurnoConfig(state.activeSelection.turno);
  refreshSelectors(); renderPeriodos(); initConfigUI(); renderSchedulesByView();
});

setupNavigation();
loadStorage();
ensureTurnoConfig(state.turno);
setupDynamicSelectors();
bindSelectorsEvents();
renderAll();
logMessage('Sistema listo para planificar horarios.', 'ok');

/*
Casos de prueba manuales solicitados:
1) Agregar clase manual (Año 1), mismo día/bloque para misma carrera y confirmar diálogo de reemplazo.
2) Importar CSV con anio=1 y anio=3, generar y validar tablas separadas para Año 1..5 (solo 1 y 3 llenos).
3) Guardar configuración (días/prioridad/hora), pulsar "Limpiar horario" y comprobar que configuración y CSV siguen disponibles.
4) Cambiar "Hora de inicio de clases" a 07:00, generar y verificar que el primer bloque inicia en 07:00.
5) Agregar periodos en turno diurno/sabatino y eliminar uno; validar que la lista se actualiza y permanece separada por turno.
*/
