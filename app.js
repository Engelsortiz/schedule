const REQUIRED_COLUMNS = ['clase', 'creditos', 'tipo', 'aula', 'docente'];
const DAYS_BY_TURNO = {
  diurno: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
  sabatino: ['Sábado'],
  dominical: ['Domingo']
};

const state = {
  clases: [],
  manualAssignments: [],
  schedule: {},
  conflictos: [],
  turno: 'diurno',
  bloques: []
};

const refs = {
  csvInput: document.getElementById('csvInput'),
  turnoSelect: document.getElementById('turnoSelect'),
  recesoInicio: document.getElementById('recesoInicio'),
  recesoFin: document.getElementById('recesoFin'),
  almuerzoInicio: document.getElementById('almuerzoInicio'),
  almuerzoFin: document.getElementById('almuerzoFin'),
  tablaClases: document.querySelector('#tablaClases tbody'),
  manualClase: document.getElementById('manualClase'),
  manualDia: document.getElementById('manualDia'),
  manualBloque: document.getElementById('manualBloque'),
  agregarManual: document.getElementById('agregarManual'),
  listaAsignacionesManual: document.getElementById('listaAsignacionesManual'),
  matriculaInput: document.getElementById('matriculaInput'),
  maxGrupoInput: document.getElementById('maxGrupoInput'),
  btnGenerar: document.getElementById('btnGenerar'),
  btnLimpiar: document.getElementById('btnLimpiar'),
  groupResult: document.getElementById('groupResult'),
  horarioWrap: document.getElementById('horarioWrap'),
  consoleOutput: document.getElementById('consoleOutput'),
  menuToggle: document.getElementById('menuToggle'),
  sidebar: document.getElementById('sidebar'),
  mainContent: document.getElementById('mainContent'),
  footerTabs: document.getElementById('footerTabs')
};

init();

function init() {
  refs.csvInput.addEventListener('change', onCsvLoad);
  refs.turnoSelect.addEventListener('change', () => {
    state.turno = refs.turnoSelect.value;
    log(`Turno seleccionado: ${state.turno}`);
  });
  refs.agregarManual.addEventListener('click', addManualAssignment);
  refs.btnGenerar.addEventListener('click', generateSchedule);
  refs.btnLimpiar.addEventListener('click', resetAll);
  refs.menuToggle.addEventListener('click', () => refs.sidebar.classList.toggle('hidden'));

  refs.footerTabs.querySelectorAll('.tab-btn').forEach((button) => {
    button.addEventListener('click', () => {
      refs.footerTabs.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
      if (button.dataset.tab === 'configuracion') {
        refs.mainContent.classList.add('hidden-config');
      } else {
        refs.mainContent.classList.remove('hidden-config');
      }
    });
  });

  state.turno = refs.turnoSelect.value;
  log('Sistema listo. Carga un CSV para comenzar.');
}

function onCsvLoad(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = parseCsv(reader.result);
      state.clases = parsed;
      renderClassesTable();
      renderManualClassesOptions();
      log(`CSV cargado con ${parsed.length} clases válidas.`);
    } catch (error) {
      log(`Error CSV: ${error.message}`);
      alert(error.message);
    }
  };
  reader.readAsText(file, 'utf-8');
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('El CSV debe incluir cabecera y al menos una fila.');

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length) throw new Error(`Faltan columnas requeridas: ${missing.join(', ')}`);

  return lines.slice(1).map((line, index) => {
    const cols = line.split(',').map((v) => v.trim());
    const data = Object.fromEntries(headers.map((h, i) => [h, cols[i] || '']));
    const creditos = Number(data.creditos);
    if (!data.clase || Number.isNaN(creditos) || creditos < 1) {
      throw new Error(`Fila ${index + 2} inválida: verifica clase y creditos.`);
    }
    return {
      id: `${data.clase}-${index}`,
      clase: data.clase,
      creditos,
      tipo: data.tipo || 'General',
      aula: data.aula || 'Por definir',
      docente: data.docente || 'Por definir'
    };
  });
}

function renderClassesTable() {
  refs.tablaClases.innerHTML = '';
  state.clases.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.clase}</td>
      <td>${item.creditos}</td>
      <td>${item.tipo}</td>
      <td>${item.aula}</td>
      <td>${item.docente}</td>
      <td>
        <span class="tag">${item.creditos} bloques</span>
        <span class="tag">${item.tipo}</span>
      </td>
    `;
    refs.tablaClases.appendChild(tr);
  });
}

function renderManualClassesOptions() {
  refs.manualClase.innerHTML = state.clases.map((c) => `<option value="${c.id}">${c.clase}</option>`).join('');
}

function addManualAssignment() {
  const classId = refs.manualClase.value;
  if (!classId) return;
  const assignment = {
    classId,
    dia: refs.manualDia.value,
    bloqueInicio: Number(refs.manualBloque.value)
  };
  state.manualAssignments.push(assignment);
  refs.listaAsignacionesManual.innerHTML = state.manualAssignments
    .map((m) => {
      const clase = state.clases.find((c) => c.id === m.classId)?.clase || 'Clase';
      return `<li>${clase} · ${m.dia} · bloque ${m.bloqueInicio}</li>`;
    })
    .join('');
  log(`Asignación manual agregada para ${assignment.dia}.`);
}

function generateSchedule() {
  if (!state.clases.length) {
    alert('Carga clases desde CSV antes de generar.');
    return;
  }

  const turno = refs.turnoSelect.value;
  const days = DAYS_BY_TURNO[turno];
  const slots = buildSlots(turno);
  const reserved = buildReservedSlots(slots);
  state.bloques = slots;
  state.schedule = initializeSchedule(days, slots, reserved);
  state.conflictos = [];

  const classesSorted = [...state.clases].sort((a, b) => b.creditos - a.creditos);

  applyManualAssignments(classesSorted, days);

  const dayLoads = Object.fromEntries(days.map((d) => [d, 0]));

  classesSorted.forEach((clase) => {
    if (isClassScheduled(clase.id)) return;

    const placed = tryPlaceClass(clase, days, slots, dayLoads, turno);
    if (!placed) {
      state.conflictos.push({ clase: clase.clase, reason: 'No se encontró slot compatible' });
    }
  });

  renderSchedule(days, slots);
  renderGroupSummary();
  printSummary();
}

function buildSlots(turno) {
  const start = turno === 'diurno' ? '08:00' : '08:00';
  const end = turno === 'diurno' ? '16:00' : '16:00';
  const slots = [];
  let minutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  while (minutes < endMinutes) {
    const next = minutes + 45;
    slots.push({ start: toHour(minutes), end: toHour(next), key: `${toHour(minutes)}-${toHour(next)}` });
    minutes = next;
  }
  return slots;
}

function buildReservedSlots(slots) {
  const windows = [
    { type: 'RECESO', start: refs.recesoInicio.value, end: refs.recesoFin.value },
    { type: 'ALMUERZO', start: refs.almuerzoInicio.value, end: refs.almuerzoFin.value }
  ];
  const reserved = {};
  slots.forEach((slot, index) => {
    const slotStart = toMinutes(slot.start);
    windows.forEach((w) => {
      if (slotStart >= toMinutes(w.start) && slotStart < toMinutes(w.end)) {
        reserved[index] = w.type;
      }
    });
  });
  return reserved;
}

function initializeSchedule(days, slots, reserved) {
  const schedule = {};
  days.forEach((d) => {
    schedule[d] = slots.map((slot, index) => {
      if (reserved[index]) return { reserved: reserved[index] };
      return null;
    });
  });
  return schedule;
}

function applyManualAssignments(classesSorted, days) {
  state.manualAssignments.forEach((manual) => {
    const targetClass = classesSorted.find((c) => c.id === manual.classId);
    if (!targetClass || !days.includes(manual.dia)) return;

    const idx = manual.bloqueInicio - 1;
    const canPlace = canPlaceContiguous(targetClass, manual.dia, idx, targetClass.creditos);
    if (canPlace.ok) {
      placeContiguous(targetClass, manual.dia, idx, targetClass.creditos);
    } else {
      state.conflictos.push({
        clase: targetClass.clase,
        reason: `Manual no aplicada (${canPlace.reason})`
      });
    }
  });
}

function tryPlaceClass(clase, days, slots, dayLoads, turno) {
  const sortedDays = [...days].sort((a, b) => dayLoads[a] - dayLoads[b]);
  for (const day of sortedDays) {
    for (let i = 0; i < slots.length; i += 1) {
      const check = canPlaceContiguous(clase, day, i, clase.creditos);
      if (check.ok) {
        placeContiguous(clase, day, i, clase.creditos);
        dayLoads[day] += clase.creditos;
        return true;
      }
    }

    if (turno === 'diurno') {
      const split = trySplitInDay(clase, day, slots.length);
      if (split) {
        dayLoads[day] += clase.creditos;
        return true;
      }
    }
  }

  if (turno !== 'diurno') {
    state.conflictos.push({
      clase: clase.clase,
      reason: 'Sabatino/Dominical exige bloques contiguos'
    });
  }
  return false;
}

function trySplitInDay(clase, day, totalSlots) {
  for (let first = clase.creditos - 1; first >= 1; first -= 1) {
    const second = clase.creditos - first;
    for (let i = 0; i < totalSlots; i += 1) {
      const firstCheck = canPlaceContiguous(clase, day, i, first);
      if (!firstCheck.ok) continue;
      for (let j = i + first + 1; j < totalSlots; j += 1) {
        const secondCheck = canPlaceContiguous(clase, day, j, second);
        if (secondCheck.ok) {
          placeContiguous(clase, day, i, first, 'tramo 1/2');
          placeContiguous(clase, day, j, second, 'tramo 2/2');
          return true;
        }
      }
    }
  }
  return false;
}

function canPlaceContiguous(clase, day, startIndex, blocks) {
  const daySchedule = state.schedule[day];
  if (!daySchedule || startIndex + blocks > daySchedule.length) {
    return { ok: false, reason: 'Fuera de rango' };
  }

  for (let i = startIndex; i < startIndex + blocks; i += 1) {
    const slot = daySchedule[i];
    if (slot && slot.reserved) return { ok: false, reason: 'Bloque reservado' };
    if (slot && slot.classId && slot.classId !== clase.id) return { ok: false, reason: 'Ocupado' };

    if (hasResourceConflict(day, i, clase.aula, clase.docente, clase.id)) {
      return { ok: false, reason: 'Conflicto aula/docente' };
    }
  }

  return { ok: true };
}

function hasResourceConflict(day, slotIndex, aula, docente, classId) {
  return Object.keys(state.schedule).some((d) => {
    if (d !== day) return false;
    const slot = state.schedule[d][slotIndex];
    if (!slot || slot.reserved || slot.classId === classId) return false;
    return slot.aula === aula || slot.docente === docente;
  });
}

function placeContiguous(clase, day, startIndex, blocks, tramoLabel = '') {
  for (let i = startIndex; i < startIndex + blocks; i += 1) {
    state.schedule[day][i] = {
      classId: clase.id,
      clase: clase.clase,
      aula: clase.aula,
      docente: clase.docente,
      tramo: tramoLabel
    };
  }
}

function isClassScheduled(classId) {
  return Object.values(state.schedule)
    .flat()
    .some((slot) => slot && !slot.reserved && slot.classId === classId);
}

function renderSchedule(days, slots) {
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

  thead.innerHTML = `
    <tr>
      <th>Bloque</th>
      ${days.map((d) => `<th>${d}</th>`).join('')}
    </tr>
  `;

  slots.forEach((slot, i) => {
    const row = document.createElement('tr');
    const cells = days
      .map((d) => {
        const data = state.schedule[d][i];
        if (!data) return '<td>-</td>';
        if (data.reserved) return `<td><span class="tag tag-reservado">${data.reserved}</span></td>`;
        return `<td><strong>${data.clase}</strong><br/>${data.aula}<br/><small>${data.tramo || data.docente}</small></td>`;
      })
      .join('');

    row.innerHTML = `<td>${i + 1}<br/><small>${slot.start} - ${slot.end}</small></td>${cells}`;
    tbody.appendChild(row);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  refs.horarioWrap.innerHTML = '';
  refs.horarioWrap.appendChild(table);
}

function renderGroupSummary() {
  const matricula = Number(refs.matriculaInput.value);
  const maxGrupo = Number(refs.maxGrupoInput.value);
  const grupos = Math.ceil(matricula / maxGrupo);

  const byTipo = state.clases.reduce((acc, c) => {
    acc[c.tipo] = (acc[c.tipo] || 0) + 1;
    return acc;
  }, {});

  refs.groupResult.innerHTML = `
    <strong>Grupos sugeridos por matrícula:</strong> ${grupos}<br/>
    <small>Matrícula: ${matricula}, máximo/grupo: ${maxGrupo}</small><br/>
    <small>Distribución de clases por tipo: ${Object.entries(byTipo)
      .map(([tipo, count]) => `${tipo}: ${count}`)
      .join(' · ')}</small>
  `;
}

function printSummary() {
  const assigned = Object.values(state.schedule)
    .flat()
    .filter((slot) => slot && slot.classId)
    .length;
  const reserved = Object.values(state.schedule)
    .flat()
    .filter((slot) => slot && slot.reserved)
    .length;

  const lines = [
    `Resumen de generación`,
    `- Bloques asignados: ${assigned}`,
    `- Bloques reservados (receso/almuerzo): ${reserved}`,
    `- Conflictos: ${state.conflictos.length}`
  ];

  if (state.conflictos.length) {
    lines.push('Detalle de conflictos:');
    state.conflictos.forEach((c) => lines.push(`  • ${c.clase}: ${c.reason}`));
  }

  refs.consoleOutput.textContent = lines.join('\n');
}

function resetAll() {
  state.schedule = {};
  state.conflictos = [];
  state.manualAssignments = [];
  state.bloques = [];
  refs.listaAsignacionesManual.innerHTML = '';
  refs.horarioWrap.innerHTML = '';
  refs.groupResult.innerHTML = '';
  refs.consoleOutput.textContent = '';
  log('Estado reiniciado.');
}

function log(message) {
  const now = new Date().toLocaleTimeString();
  refs.consoleOutput.textContent += `[${now}] ${message}\n`;
}

function toMinutes(hour) {
  const [h, m] = hour.split(':').map(Number);
  return h * 60 + m;
}

function toHour(totalMinutes) {
  const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const m = String(totalMinutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}
