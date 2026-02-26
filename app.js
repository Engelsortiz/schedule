// Estado principal
const state = {
  turno: 'diurno',
  blockMinutes: 45,
  clases: [],
  docentes: [],
  areas: [],
  coordinaciones: [],
  carreras: [],
  schedule: {},
  conflictos: []
};

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

// Referencias DOM
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
function logMessage(message, type = 'ok') {
  const line = document.createElement('div');
  line.className = type;
  const ts = new Date().toLocaleTimeString();
  line.textContent = `[${ts}] ${message}`;
  el.console.appendChild(line);
  el.console.scrollTop = el.console.scrollHeight;
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function toHHMM(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function safeText(value) {
  return String(value ?? '').trim();
}

function normalize(value) {
  return safeText(value).toLowerCase();
}

function getDaysByTurno(turno) {
  if (turno === 'sabatino') return ['Sábado'];
  if (turno === 'dominical') return ['Domingo'];
  return DAYS;
}

function getTimeRangeByTurno(turno) {
  if (turno === 'sabatino' || turno === 'dominical') {
    return { start: '08:00', end: '17:00' };
  }
  return { start: '08:00', end: '16:00' };
}

function createBlocks() {
  const { start, end } = getTimeRangeByTurno(state.turno);
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  const blocks = [];
  for (let t = startMin; t < endMin; t += state.blockMinutes) {
    const label = `${toHHMM(t)}-${toHHMM(t + state.blockMinutes)}`;
    blocks.push({ label, start: t, end: t + state.blockMinutes, type: 'class' });
  }

  const recesoMin = toMinutes(el.breakStart.value);
  const almuerzoMin = toMinutes(el.lunchStart.value);

  return blocks.map((b) => {
    if (b.start === recesoMin) return { ...b, type: 'receso' };
    if (b.start === almuerzoMin) return { ...b, type: 'almuerzo' };
    return b;
  });
}

function loadStorage() {
  const raw = localStorage.getItem('schedule-state-v2');
  if (!raw) return;
  try {
    const persisted = JSON.parse(raw);
    Object.assign(state, persisted);
  } catch {
    logMessage('No se pudo restaurar localStorage.', 'warn');
  }
}

function saveStorage() {
  localStorage.setItem('schedule-state-v2', JSON.stringify({
    turno: state.turno,
    blockMinutes: state.blockMinutes,
    clases: state.clases,
    docentes: state.docentes,
    areas: state.areas,
    coordinaciones: state.coordinaciones,
    carreras: state.carreras
  }));
}

// ---------- Navegación ----------
function setView(view) {
  const principal = view === 'principal';
  el.principalView.classList.toggle('hidden', !principal);
  el.configView.classList.toggle('hidden', principal);
  el.tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === view));
}

function setupNavigation() {
  el.btnMenu.addEventListener('click', () => {
    el.sidebar.classList.toggle('open');
  });

  el.tabs.forEach((tab) => {
    tab.addEventListener('click', () => setView(tab.dataset.tab));
  });
}

// ---------- CSV ----------
function parseCSVLine(line) {
  const cols = [];
  let token = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      cols.push(token.trim());
      token = '';
    } else token += char;
  }
  cols.push(token.trim());
  return cols;
}

async function importCSV() {
  const file = el.csvFile.files?.[0];
  if (!file) {
    logMessage('Selecciona un archivo CSV primero.', 'error');
    return;
  }

  const text = await file.text();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) {
    logMessage('CSV vacío.', 'error');
    return;
  }

  const headers = parseCSVLine(lines[0]).map(normalize);
  const required = ['clase', 'creditos', 'compartida', 'anio', 'categoria', 'tipo', 'aula', 'docente'];
  const missing = required.filter((h) => !headers.includes(h));

  if (missing.length) {
    logMessage(`Faltan columnas obligatorias: ${missing.join(', ')}`, 'error');
    el.csvFeedback.textContent = `Error: faltan columnas ${missing.join(', ')}`;
    return;
  }

  const idx = Object.fromEntries(required.map((name) => [name, headers.indexOf(name)]));
  const rows = lines.slice(1).map(parseCSVLine);

  const imported = rows.map((r) => ({
    clase: safeText(r[idx.clase]),
    creditos: Math.max(1, Number(r[idx.creditos]) || 1),
    compartida: safeText(r[idx.compartida]),
    anio: Number(r[idx.anio]) || 1,
    categoria: safeText(r[idx.categoria]),
    tipo: safeText(r[idx.tipo]),
    aula: safeText(r[idx.aula]) || 'SIN-AULA',
    docente: safeText(r[idx.docente]) || 'SIN-DOCENTE',
    tramos: []
  })).filter((c) => c.clase);

  state.clases = [...state.clases, ...imported];
  renderClases();
  saveStorage();
  el.csvFeedback.textContent = `Importadas ${imported.length} clases.`;
  logMessage(`CSV importado correctamente. Clases: ${imported.length}`, 'ok');
}

// ---------- Gestión manual ----------
function addManualClase() {
  const clase = safeText(document.getElementById('manual-clase').value);
  if (!clase) {
    logMessage('La clase es obligatoria.', 'error');
    return;
  }
  const item = {
    clase,
    creditos: Math.max(1, Number(document.getElementById('manual-creditos').value) || 1),
    compartida: 'No',
    anio: Number(document.getElementById('manual-anio').value) || 1,
    categoria: safeText(document.getElementById('manual-categoria').value) || 'General',
    tipo: safeText(document.getElementById('manual-tipo').value) || 'Teoría',
    aula: safeText(document.getElementById('manual-aula').value) || 'SIN-AULA',
    docente: safeText(document.getElementById('manual-docente').value) || 'SIN-DOCENTE',
    tramos: []
  };
  state.clases.push(item);
  renderClases();
  saveStorage();
  logMessage(`Clase agregada: ${item.clase}`, 'ok');
}

function addDocenteArea() {
  const docente = safeText(el.docenteNombre.value);
  const area = safeText(el.docenteArea.value);
  if (!docente || !area) {
    logMessage('Docente y área son obligatorios.', 'error');
    return;
  }
  state.docentes.push({ docente, area });
  if (!state.areas.includes(area)) state.areas.push(area);
  renderDocentes();
  saveStorage();
  logMessage(`Docente agregado: ${docente} (${area})`, 'ok');
}

function addCarreraCoord() {
  const coordinacion = safeText(el.coordNombre.value);
  const carrera = safeText(el.carreraNombre.value);
  if (!coordinacion || !carrera) {
    logMessage('Coordinación y carrera son obligatorios.', 'error');
    return;
  }
  state.carreras.push({ coordinacion, carrera });
  if (!state.coordinaciones.includes(coordinacion)) state.coordinaciones.push(coordinacion);
  renderCarreras();
  saveStorage();
  logMessage(`Carrera agregada: ${carrera}`, 'ok');
}

// ---------- Algoritmo de generación ----------
function initSchedule(blocks, days) {
  state.schedule = {};
  days.forEach((day) => {
    state.schedule[day] = {};
    blocks.forEach((b) => {
      state.schedule[day][b.label] = b.type === 'class' ? null : { type: b.type };
    });
  });
}

function hasConflict(day, slot, clase) {
  const current = state.schedule[day][slot];
  if (current) return true;
  for (const d of Object.keys(state.schedule)) {
    const cell = state.schedule[d][slot];
    if (!cell || cell.type) continue;
    if (cell.docente === clase.docente || cell.aula === clase.aula) return true;
  }
  return false;
}

function dayLoad(day) {
  return Object.values(state.schedule[day]).filter((c) => c && !c.type).length;
}

function findContiguousSlots(day, needed, blocks, clase) {
  const blockLabels = blocks.filter((b) => b.type === 'class').map((b) => b.label);
  for (let i = 0; i <= blockLabels.length - needed; i += 1) {
    const slice = blockLabels.slice(i, i + needed);
    const free = slice.every((slot) => !hasConflict(day, slot, clase));
    if (free) return slice;
  }
  return null;
}

function placeSlots(day, slots, clase) {
  slots.forEach((slot) => {
    state.schedule[day][slot] = {
      clase: clase.clase,
      docente: clase.docente,
      aula: clase.aula,
      tipo: clase.tipo
    };
  });
}

function generateSchedule() {
  if (!state.clases.length) {
    logMessage('No hay clases para generar.', 'error');
    return;
  }

  state.turno = el.turnoSelect.value;
  const days = getDaysByTurno(state.turno);
  const blocks = createBlocks();
  initSchedule(blocks, days);
  state.conflictos = [];

  const sorted = [...state.clases].sort((a, b) => b.creditos - a.creditos);

  sorted.forEach((clase) => {
    const needed = clase.creditos; // 1 crédito = 1 bloque de 45min
    const candidates = [...days].sort((a, b) => dayLoad(a) - dayLoad(b));
    let placed = false;

    for (const day of candidates) {
      const contiguous = findContiguousSlots(day, needed, blocks, clase);
      if (contiguous) {
        placeSlots(day, contiguous, clase);
        placed = true;
        break;
      }
    }

    // Diurno permite dividir en dos tramos en el mismo día
    if (!placed && state.turno === 'diurno') {
      for (const day of candidates) {
        const free = blocks
          .filter((b) => b.type === 'class')
          .map((b) => b.label)
          .filter((slot) => !hasConflict(day, slot, clase));
        if (free.length >= needed) {
          const first = Math.ceil(needed / 2);
          const tramo1 = free.slice(0, first);
          const tramo2 = free.slice(first, needed);
          placeSlots(day, tramo1.concat(tramo2), clase);
          placed = true;
          break;
        }
      }
    }

    if (!placed) {
      state.conflictos.push(clase);
    }
  });

  renderSchedule(blocks, days);

  const assigned = sorted.length - state.conflictos.length;
  const totalFree = days.reduce((acc, d) => {
    const free = Object.values(state.schedule[d]).filter((s) => s === null).length;
    return acc + free;
  }, 0);

  logMessage(`Generación finalizada: ${assigned}/${sorted.length} clases asignadas.`, 'ok');
  logMessage(`Conflictos: ${state.conflictos.length}. Bloques libres: ${totalFree}.`, state.conflictos.length ? 'warn' : 'ok');
  if (state.conflictos.length) {
    logMessage(`Clases en conflicto: ${state.conflictos.map((c) => c.clase).join(', ')}`, 'warn');
  }
}

function clearSchedule() {
  state.schedule = {};
  state.conflictos = [];
  el.vistaThead.innerHTML = '';
  el.vistaTbody.innerHTML = '';
  logMessage('Horario limpiado.', 'ok');
}

// ---------- Render ----------
function renderClases() {
  el.clasesTbody.innerHTML = state.clases.map((c) => `
    <tr>
      <td>${c.clase}</td>
      <td>${c.creditos}</td>
      <td>${c.aula}</td>
      <td>${c.docente}</td>
      <td>${c.tipo}</td>
    </tr>
  `).join('');
}

function renderDocentes() {
  el.docentesList.innerHTML = state.docentes.map((d) => `<li><strong>${d.docente}</strong> · ${d.area}</li>`).join('');
}

function renderCarreras() {
  el.carrerasList.innerHTML = state.carreras.map((c) => `<li><strong>${c.coordinacion}</strong> → ${c.carrera}</li>`).join('');
}

function renderSchedule(blocks = createBlocks(), days = getDaysByTurno(state.turno)) {
  el.vistaThead.innerHTML = `<tr><th>Bloque</th>${days.map((d) => `<th>${d}</th>`).join('')}</tr>`;

  el.vistaTbody.innerHTML = blocks.map((b) => {
    const cells = days.map((day) => {
      const entry = state.schedule?.[day]?.[b.label];
      if (!entry) return '<td></td>';
      if (entry.type === 'receso') return '<td class="block-receso">RECESO</td>';
      if (entry.type === 'almuerzo') return '<td class="block-almuerzo">ALMUERZO</td>';
      return `<td class="celda-clase"><strong>${entry.clase}</strong><br><small>${entry.aula} · ${entry.docente}</small></td>`;
    }).join('');
    return `<tr><td>${b.label}</td>${cells}</tr>`;
  }).join('');
}

function renderAll() {
  el.turnoSelect.value = state.turno;
  el.cfgTurnoDefault.value = state.turno;
  el.cfgBlockMin.value = state.blockMinutes;
  renderClases();
  renderDocentes();
  renderCarreras();
  renderSchedule();
}

// ---------- Eventos ----------
el.btnImportCsv.addEventListener('click', importCSV);
el.btnAddClase.addEventListener('click', addManualClase);
el.btnGenerar.addEventListener('click', generateSchedule);
el.btnLimpiar.addEventListener('click', clearSchedule);
el.btnAddDocente.addEventListener('click', addDocenteArea);
el.btnAddCarrera.addEventListener('click', addCarreraCoord);

el.btnSaveConfig.addEventListener('click', () => {
  state.turno = el.cfgTurnoDefault.value;
  state.blockMinutes = Math.max(30, Number(el.cfgBlockMin.value) || 45);
  el.turnoSelect.value = state.turno;
  saveStorage();
  logMessage('Configuración guardada en localStorage.', 'ok');
});

el.turnoSelect.addEventListener('change', () => {
  state.turno = el.turnoSelect.value;
  saveStorage();
  renderSchedule();
});

setupNavigation();
loadStorage();
renderAll();
logMessage('Sistema listo para planificar horarios.', 'ok');

/*
Casos de prueba manuales:
1) Importar CSV con 10–15 clases y verificar distribución en varios días (turno diurno).
2) Generar horario con créditos de 1 a 4 y confirmar bloques contiguos por clase.
3) Configurar receso/almuerzo y validar celdas bloqueadas en la tabla.
4) Cargar clases con mismo docente/aula y verificar que el algoritmo reporte conflictos.
5) Probar en móvil: botón menú colapsa sidebar y tabs alternan principal/configuración.
*/
