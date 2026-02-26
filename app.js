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
  bloques: [],
  dayLoads: {},
  manualMode: false,
  selectedCell: null,
  lastGeneratedEntries: [],
  dragData: null
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
  toggleManualMode: document.getElementById('toggleManualMode'),
  manualHint: document.getElementById('manualHint'),
  listaAsignacionesManual: document.getElementById('listaAsignacionesManual'),
  conflictSuggestions: document.getElementById('conflictSuggestions'),
  matriculaInput: document.getElementById('matriculaInput'),
  maxGrupoInput: document.getElementById('maxGrupoInput'),
  btnGenerar: document.getElementById('btnGenerar'),
  btnLimpiar: document.getElementById('btnLimpiar'),
  groupResult: document.getElementById('groupResult'),
  generationList: document.getElementById('generationList'),
  horarioWrap: document.getElementById('horarioWrap'),
  consoleOutput: document.getElementById('consoleOutput'),
  menuToggle: document.getElementById('menuToggle'),
  sidebar: document.getElementById('sidebar'),
  mainContent: document.getElementById('mainContent'),
  footerTabs: document.getElementById('footerTabs'),
  manualModal: document.getElementById('manualModal'),
  modalManualClase: document.getElementById('modalManualClase'),
  modalManualDia: document.getElementById('modalManualDia'),
  modalManualBloque: document.getElementById('modalManualBloque'),
  modalBloquesSugeridos: document.getElementById('modalBloquesSugeridos'),
  modalFeedback: document.getElementById('modalFeedback'),
  btnGuardarModal: document.getElementById('btnGuardarModal'),
  btnLiberarSlot: document.getElementById('btnLiberarSlot')
};

init();

function init() {
  refs.csvInput.addEventListener('change', onCsvLoad);
  refs.turnoSelect.addEventListener('change', () => {
    state.turno = refs.turnoSelect.value;
    renderManualDays();
    log(`Turno seleccionado: ${state.turno}`);
  });
  refs.agregarManual.addEventListener('click', addManualAssignmentFromForm);
  refs.toggleManualMode.addEventListener('click', toggleManualMode);
  refs.btnGenerar.addEventListener('click', generateSchedule);
  refs.btnLimpiar.addEventListener('click', resetAll);
  refs.menuToggle.addEventListener('click', () => refs.sidebar.classList.toggle('hidden'));
  refs.btnGuardarModal.addEventListener('click', applyModalManualAssignment);
  refs.btnLiberarSlot.addEventListener('click', clearSelectedSlot);

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
  renderManualDays();
  log('Sistema listo. Carga un CSV para comenzar.');
}

function onCsvLoad(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state.clases = parseCsv(reader.result);
      renderClassesTable();
      renderManualClassesOptions();
      refs.modalManualClase.innerHTML = refs.manualClase.innerHTML;
      log(`CSV cargado con ${state.clases.length} clases válidas.`);
    } catch (error) {
      emitFeedback(error.message, 'error');
      log(`Error CSV: ${error.message}`);
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

    const bloques = Math.max(1, Math.round((creditos * 45) / 45));
    return {
      id: `${data.clase}-${index}`,
      clase: data.clase,
      creditos,
      bloques,
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
      <td>${item.bloques}</td>
      <td>${item.tipo}</td>
      <td>${item.aula}</td>
      <td>${item.docente}</td>
      <td>
        <span class="tag">${item.bloques} bloques</span>
        <span class="tag">${item.tipo}</span>
      </td>
    `;
    refs.tablaClases.appendChild(tr);
  });
}

function renderManualClassesOptions() {
  refs.manualClase.innerHTML = state.clases.map((c) => `<option value="${c.id}">${c.clase}</option>`).join('');
  refs.modalManualClase.innerHTML = refs.manualClase.innerHTML;
}

function renderManualDays() {
  const days = DAYS_BY_TURNO[state.turno] || DAYS_BY_TURNO.diurno;
  refs.manualDia.innerHTML = days.map((d) => `<option value="${d}">${d}</option>`).join('');
}

function addManualAssignmentFromForm() {
  if (!refs.manualClase.value) return;
  const assignment = {
    classId: refs.manualClase.value,
    dia: refs.manualDia.value,
    bloqueInicio: Number(refs.manualBloque.value),
    source: 'formulario'
  };
  registerManualAssignment(assignment);
}

function registerManualAssignment(assignment) {
  const clase = state.clases.find((c) => c.id === assignment.classId);
  if (!clase) return;

  state.manualAssignments.push(assignment);
  refs.listaAsignacionesManual.innerHTML = state.manualAssignments
    .map((m) => {
      const c = state.clases.find((item) => item.id === m.classId);
      return `<li>${c?.clase || 'Clase'} · ${m.dia} · bloque ${m.bloqueInicio} <small>(${m.source || 'manual'})</small></li>`;
    })
    .join('');

  log(`Asignación manual registrada: ${clase.clase} (${assignment.dia}, bloque ${assignment.bloqueInicio}).`);
}

function generateSchedule() {
  if (!state.clases.length) {
    emitFeedback('Carga clases desde CSV antes de generar.', 'warn');
    return;
  }

  const turno = refs.turnoSelect.value;
  const days = DAYS_BY_TURNO[turno];
  const slots = buildSlots(turno);
  const reserved = buildReservedSlots(slots, turno);

  state.turno = turno;
  state.bloques = slots;
  state.schedule = initializeSchedule(days, slots, reserved);
  state.conflictos = [];
  state.dayLoads = Object.fromEntries(days.map((d) => [d, 0]));
  state.lastGeneratedEntries = [];

  const classesSorted = [...state.clases].sort((a, b) => {
    if (b.bloques !== a.bloques) return b.bloques - a.bloques;
    return a.tipo.localeCompare(b.tipo);
  });

  applyManualAssignments(classesSorted, days);

  classesSorted.forEach((clase) => {
    if (isClassScheduled(clase.id)) return;

    const placement = findBestPlacement(clase, days, slots, turno);
    if (placement) {
      placeContiguous(clase, placement.day, placement.startIndex, clase.bloques, 'auto');
      state.dayLoads[placement.day] += clase.bloques;
      state.lastGeneratedEntries.push({
        clase: clase.clase,
        dia: placement.day,
        bloque: placement.startIndex + 1,
        score: placement.score
      });
    } else {
      state.conflictos.push({ clase: clase.clase, reason: 'No se encontró slot compatible' });
    }
  });

  renderSchedule(days, slots);
  renderGroupSummary();
  renderGenerationList();
  printSummary();
}

function buildSlots(turno) {
  const start = '08:00';
  const end = '16:00';
  const slots = [];
  let current = toMinutes(start);
  while (current < toMinutes(end)) {
    const next = current + 45;
    slots.push({ start: toHour(current), end: toHour(next), key: `${toHour(current)}-${toHour(next)}` });
    current = next;
  }
  return slots;
}

function buildReservedSlots(slots, turno) {
  const reserved = {};
  if (turno !== 'diurno') return reserved;

  const windows = [
    { type: 'RECESO', start: refs.recesoInicio.value, end: refs.recesoFin.value },
    { type: 'ALMUERZO', start: refs.almuerzoInicio.value, end: refs.almuerzoFin.value }
  ];

  slots.forEach((slot, index) => {
    const slotStart = toMinutes(slot.start);
    windows.forEach((window) => {
      if (slotStart >= toMinutes(window.start) && slotStart < toMinutes(window.end)) {
        reserved[index] = window.type;
      }
    });
  });

  return reserved;
}

function initializeSchedule(days, slots, reserved) {
  const schedule = {};
  days.forEach((day) => {
    schedule[day] = slots.map((_, index) => {
      if (reserved[index]) return { reserved: reserved[index] };
      return null;
    });
  });
  return schedule;
}

function applyManualAssignments(classesSorted, days) {
  state.manualAssignments.forEach((manual) => {
    const clase = classesSorted.find((c) => c.id === manual.classId);
    if (!clase || !days.includes(manual.dia)) return;

    const start = manual.bloqueInicio - 1;
    const validation = canPlaceContiguous(clase, manual.dia, start, clase.bloques);

    if (validation.ok) {
      placeContiguous(clase, manual.dia, start, clase.bloques, 'manual');
      state.dayLoads[manual.dia] += clase.bloques;
    } else {
      state.conflictos.push({
        clase: clase.clase,
        reason: `Manual no aplicada (${validation.reason})`
      });
    }
  });
}

function findBestPlacement(clase, days, slots, turno) {
  const candidates = [];

  days.forEach((day) => {
    for (let i = 0; i <= slots.length - clase.bloques; i += 1) {
      const validation = canPlaceContiguous(clase, day, i, clase.bloques);
      if (!validation.ok) continue;
      const score = scorePlacement(clase, day, i, turno);
      candidates.push({ day, startIndex: i, score });
    }
  });

  if (!candidates.length) {
    if (turno === 'diurno') {
      return trySplitPlacement(clase, days, slots.length);
    }
    state.conflictos.push({ clase: clase.clase, reason: 'Sabatino/Dominical exige continuidad total' });
    return null;
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

function scorePlacement(clase, day, startIndex, turno) {
  const loadValues = Object.values(state.dayLoads);
  const avgLoad = loadValues.reduce((sum, value) => sum + value, 0) / (loadValues.length || 1);
  const projectedLoad = state.dayLoads[day] + clase.bloques;
  const balancePenalty = Math.abs(projectedLoad - avgLoad);

  let continuityBonus = 0;
  if (turno === 'diurno') {
    const morningPreference = startIndex < 5 ? 1.2 : 0.8;
    continuityBonus += morningPreference;
  } else {
    continuityBonus += 2;
  }

  const gapPenalty = calculateGapPenalty(day, startIndex, clase.bloques);
  return 10 + continuityBonus - balancePenalty * 0.8 - gapPenalty;
}

function calculateGapPenalty(day, startIndex, blocks) {
  let penalty = 0;
  const daySchedule = state.schedule[day];
  const before = daySchedule[startIndex - 1];
  const after = daySchedule[startIndex + blocks];

  if (before && !before.reserved && before.classId) penalty += 0.2;
  if (after && !after.reserved && after.classId) penalty += 0.2;

  for (let i = 0; i < daySchedule.length; i += 1) {
    const slot = daySchedule[i];
    if (!slot || slot.reserved) continue;
    if (i < startIndex - 1 || i > startIndex + blocks) penalty += 0.1;
  }

  return penalty;
}

function trySplitPlacement(clase, days, totalSlots) {
  if (clase.bloques < 2) return null;

  for (let firstPart = clase.bloques - 1; firstPart >= 1; firstPart -= 1) {
    const secondPart = clase.bloques - firstPart;
    for (const day of days) {
      for (let i = 0; i <= totalSlots - firstPart; i += 1) {
        const firstCheck = canPlaceContiguous(clase, day, i, firstPart);
        if (!firstCheck.ok) continue;

        for (let j = i + firstPart + 1; j <= totalSlots - secondPart; j += 1) {
          const secondCheck = canPlaceContiguous(clase, day, j, secondPart);
          if (!secondCheck.ok) continue;

          placeContiguous(clase, day, i, firstPart, 'auto tramo 1/2');
          placeContiguous(clase, day, j, secondPart, 'auto tramo 2/2');
          state.dayLoads[day] += clase.bloques;
          state.lastGeneratedEntries.push({ clase: clase.clase, dia: day, bloque: i + 1, score: 6.3 });
          return { day, startIndex: i, score: 6.3 };
        }
      }
    }
  }

  return null;
}

function canPlaceContiguous(clase, day, startIndex, blocks) {
  const daySchedule = state.schedule[day];
  if (!daySchedule || startIndex < 0 || startIndex + blocks > daySchedule.length) {
    return { ok: false, reason: 'Fuera de rango' };
  }

  for (let i = startIndex; i < startIndex + blocks; i += 1) {
    const slot = daySchedule[i];
    if (slot?.reserved) return { ok: false, reason: 'Bloque reservado' };
    if (slot?.classId && slot.classId !== clase.id) return { ok: false, reason: 'Bloque ocupado' };

    if (hasResourceConflict(day, i, clase.aula, clase.docente, clase.id)) {
      return { ok: false, reason: 'Conflicto de aula/docente' };
    }
  }

  return { ok: true };
}

function hasResourceConflict(day, slotIndex, aula, docente, classId) {
  const slot = state.schedule[day]?.[slotIndex];
  if (!slot || slot.reserved || slot.classId === classId) return false;
  return slot.aula === aula || slot.docente === docente;
}

function placeContiguous(clase, day, startIndex, blocks, source = 'auto') {
  for (let i = startIndex; i < startIndex + blocks; i += 1) {
    state.schedule[day][i] = {
      classId: clase.id,
      clase: clase.clase,
      aula: clase.aula,
      docente: clase.docente,
      source
    };
  }
}

function isClassScheduled(classId) {
  return Object.values(state.schedule)
    .flat()
    .some((slot) => slot && slot.classId === classId);
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
    const blockLabel = `<td><strong>${i + 1}</strong><br/><small>${slot.start} - ${slot.end}</small></td>`;

    const cells = days
      .map((day) => {
        const data = state.schedule[day][i];
        if (!data) {
          return `<td class="slot-cell clickable" data-day="${day}" data-block="${i + 1}" draggable="false">-</td>`;
        }

        if (data.reserved) {
          return `<td class="slot-cell" data-day="${day}" data-block="${i + 1}"><span class="tag tag-reservado">${data.reserved}</span></td>`;
        }

        return `
          <td class="slot-cell clickable" data-day="${day}" data-block="${i + 1}" data-class-id="${data.classId}" draggable="true">
            <article class="slot-card" draggable="true" data-class-id="${data.classId}" data-day="${day}" data-block="${i + 1}">
              <strong>${data.clase}</strong>
              <small>${data.aula}</small><br/>
              <small>${data.docente}</small><br/>
              <small>(${data.source})</small>
            </article>
          </td>
        `;
      })
      .join('');

    row.innerHTML = `${blockLabel}${cells}`;
    tbody.appendChild(row);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  refs.horarioWrap.innerHTML = '';
  refs.horarioWrap.appendChild(table);

  attachVisualAssignmentEvents();
}

function attachVisualAssignmentEvents() {
  const cells = refs.horarioWrap.querySelectorAll('.slot-cell.clickable');

  cells.forEach((cell) => {
    cell.addEventListener('click', () => {
      if (!state.manualMode) return;
      selectSlotCell(cell);
      openManualModalForCell(cell);
    });

    cell.addEventListener('dragstart', (event) => {
      const classId = cell.dataset.classId;
      if (!classId) return;
      state.dragData = {
        classId,
        fromDay: cell.dataset.day,
        fromBlock: Number(cell.dataset.block)
      };
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', classId);
    });

    cell.addEventListener('dragover', (event) => {
      if (!state.dragData) return;
      event.preventDefault();
      cell.classList.add('selected');
    });

    cell.addEventListener('dragleave', () => cell.classList.remove('selected'));

    cell.addEventListener('drop', (event) => {
      event.preventDefault();
      cell.classList.remove('selected');
      if (!state.dragData) return;
      handleDropAssignment(cell, state.dragData);
      state.dragData = null;
    });
  });
}

function toggleManualMode() {
  state.manualMode = !state.manualMode;
  refs.toggleManualMode.textContent = `Modo selección visual: ${state.manualMode ? 'ON' : 'OFF'}`;
  refs.manualHint.textContent = state.manualMode
    ? 'Modo activo: haz clic en una celda de la vista para abrir el panel de asignación.'
    : 'Modo inactivo: activa para editar por selección visual.';
}

function selectSlotCell(cell) {
  refs.horarioWrap.querySelectorAll('.slot-cell').forEach((node) => node.classList.remove('selected'));
  cell.classList.add('selected');
  state.selectedCell = {
    day: cell.dataset.day,
    block: Number(cell.dataset.block)
  };
}

function openManualModalForCell(cell) {
  refs.modalManualDia.value = cell.dataset.day;
  refs.modalManualBloque.value = cell.dataset.block;

  const classId = cell.dataset.classId || refs.manualClase.value;
  refs.modalManualClase.value = classId;
  const clase = state.clases.find((item) => item.id === classId);
  refs.modalBloquesSugeridos.value = clase ? `${clase.bloques} bloques (${clase.creditos} créditos)` : 'N/A';
  refs.modalFeedback.innerHTML = '';

  if (typeof refs.manualModal.showModal === 'function') {
    refs.manualModal.showModal();
  }
}

function applyModalManualAssignment() {
  const classId = refs.modalManualClase.value;
  const dia = refs.modalManualDia.value;
  const bloqueInicio = Number(refs.modalManualBloque.value);
  const clase = state.clases.find((c) => c.id === classId);

  if (!classId || !clase) {
    renderModalFeedback('Selecciona una clase válida.', 'error');
    return;
  }

  const validation = canPlaceContiguous(clase, dia, bloqueInicio - 1, clase.bloques);
  if (!validation.ok) {
    renderModalFeedback(`Conflicto detectado: ${validation.reason}`, 'error');
    renderSuggestions(clase, dia, bloqueInicio);
    return;
  }

  registerManualAssignment({ classId, dia, bloqueInicio, source: 'visual' });
  placeContiguous(clase, dia, bloqueInicio - 1, clase.bloques, 'manual visual');
  renderSchedule(DAYS_BY_TURNO[state.turno], state.bloques);
  renderModalFeedback('Asignación aplicada correctamente.', 'ok');

  if (refs.manualModal.open) refs.manualModal.close();
}

function clearSelectedSlot() {
  if (!state.selectedCell) {
    renderModalFeedback('No hay celda seleccionada.', 'warn');
    return;
  }

  const { day, block } = state.selectedCell;
  const slot = state.schedule[day]?.[block - 1];
  if (!slot || slot.reserved) {
    renderModalFeedback('El slot está vacío o reservado.', 'warn');
    return;
  }

  const classId = slot.classId;
  state.schedule[day] = state.schedule[day].map((entry) => {
    if (!entry || entry.reserved || entry.classId !== classId) return entry;
    return null;
  });

  state.manualAssignments = state.manualAssignments.filter((assignment) => assignment.classId !== classId);
  refs.listaAsignacionesManual.innerHTML = state.manualAssignments
    .map((m) => `<li>${state.clases.find((c) => c.id === m.classId)?.clase || 'Clase'} · ${m.dia} · bloque ${m.bloqueInicio}</li>`)
    .join('');

  renderSchedule(DAYS_BY_TURNO[state.turno], state.bloques);
  renderModalFeedback('Slot liberado y asignación eliminada.', 'ok');
}

function handleDropAssignment(targetCell, dragData) {
  const clase = state.clases.find((item) => item.id === dragData.classId);
  if (!clase) return;

  const toDay = targetCell.dataset.day;
  const toBlock = Number(targetCell.dataset.block);

  const validation = canPlaceContiguous(clase, toDay, toBlock - 1, clase.bloques);
  if (!validation.ok) {
    emitFeedback(`No se pudo mover ${clase.clase}: ${validation.reason}`, 'error');
    renderSuggestions(clase, toDay, toBlock);
    return;
  }

  state.schedule[dragData.fromDay] = state.schedule[dragData.fromDay].map((slot) => {
    if (!slot || slot.reserved || slot.classId !== clase.id) return slot;
    return null;
  });

  placeContiguous(clase, toDay, toBlock - 1, clase.bloques, 'drag&drop');
  registerManualAssignment({ classId: clase.id, dia: toDay, bloqueInicio: toBlock, source: 'drag' });
  renderSchedule(DAYS_BY_TURNO[state.turno], state.bloques);
  emitFeedback(`Clase movida por drag & drop: ${clase.clase}.`, 'ok');
}

function renderSuggestions(clase, preferredDay, preferredBlock) {
  const days = DAYS_BY_TURNO[state.turno] || [];
  const suggestions = [];

  days.forEach((day) => {
    for (let i = 0; i <= state.bloques.length - clase.bloques; i += 1) {
      const check = canPlaceContiguous(clase, day, i, clase.bloques);
      if (check.ok) {
        const distance = Math.abs((preferredBlock - 1) - i) + (day === preferredDay ? 0 : 1);
        suggestions.push({ day, block: i + 1, distance });
      }
    }
  });

  suggestions.sort((a, b) => a.distance - b.distance);
  const top = suggestions.slice(0, 4);

  if (!top.length) {
    refs.conflictSuggestions.className = 'suggestions visible';
    refs.conflictSuggestions.textContent = 'Sin sugerencias disponibles para reubicación.';
    return;
  }

  refs.conflictSuggestions.className = 'suggestions visible';
  refs.conflictSuggestions.innerHTML = `<strong>Sugerencias de reubicación:</strong><ul>${top
    .map((item) => `<li>${item.day} · bloque ${item.block}</li>`)
    .join('')}</ul>`;
}

function renderGroupSummary() {
  const matricula = Number(refs.matriculaInput.value);
  const maxGrupo = Number(refs.maxGrupoInput.value);
  const grupos = Math.ceil(matricula / maxGrupo);

  const byTipo = state.clases.reduce((acc, clase) => {
    acc[clase.tipo] = (acc[clase.tipo] || 0) + 1;
    return acc;
  }, {});

  refs.groupResult.innerHTML = `
    <strong>Grupos sugeridos por matrícula:</strong> ${grupos}<br/>
    <small>Matrícula: ${matricula}, máximo/grupo: ${maxGrupo}</small><br/>
    <small>Distribución por tipo: ${Object.entries(byTipo)
      .map(([tipo, count]) => `${tipo}: ${count}`)
      .join(' · ')}</small>
  `;
}

function renderGenerationList() {
  refs.generationList.innerHTML = state.lastGeneratedEntries
    .slice(0, 20)
    .map(
      (entry) =>
        `<div class="generation-item"><strong>${entry.clase}</strong> → ${entry.dia}, bloque ${entry.bloque} <small>(score ${entry.score.toFixed(
          2
        )})</small></div>`
    )
    .join('');
}

function printSummary() {
  const assigned = Object.values(state.schedule)
    .flat()
    .filter((slot) => slot && slot.classId).length;
  const reserved = Object.values(state.schedule)
    .flat()
    .filter((slot) => slot && slot.reserved).length;

  const dayBalance = Object.entries(state.dayLoads)
    .map(([day, load]) => `${day}: ${load}`)
    .join(' · ');

  const lines = [
    'Resumen de generación',
    `- Turno: ${state.turno}`,
    `- Bloques asignados: ${assigned}`,
    `- Bloques reservados: ${reserved}`,
    `- Balance por día: ${dayBalance || 'N/A'}`,
    `- Conflictos: ${state.conflictos.length}`
  ];

  if (state.conflictos.length) {
    lines.push('Detalle de conflictos:');
    state.conflictos.forEach((conflict) => lines.push(`  • ${conflict.clase}: ${conflict.reason}`));
  }

  refs.consoleOutput.textContent = lines.join('\n');
}

function resetAll() {
  state.schedule = {};
  state.conflictos = [];
  state.manualAssignments = [];
  state.bloques = [];
  state.dayLoads = {};
  state.selectedCell = null;
  state.lastGeneratedEntries = [];

  refs.listaAsignacionesManual.innerHTML = '';
  refs.horarioWrap.innerHTML = '';
  refs.groupResult.innerHTML = '';
  refs.generationList.innerHTML = '';
  refs.conflictSuggestions.className = 'suggestions';
  refs.conflictSuggestions.textContent = '';
  refs.consoleOutput.textContent = '';

  log('Estado reiniciado.');
}

function emitFeedback(message, type = 'warn') {
  const className = type === 'error' ? 'feedback-error' : type === 'ok' ? 'feedback-ok' : 'feedback-warn';
  refs.consoleOutput.innerHTML += `\n<div class="${className}">${message}</div>`;
}

function renderModalFeedback(message, type) {
  const className = type === 'error' ? 'feedback-error' : type === 'ok' ? 'feedback-ok' : 'feedback-warn';
  refs.modalFeedback.innerHTML = `<div class="${className}">${message}</div>`;
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
