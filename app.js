const YEARS = [1, 2, 3, 4, 5];
const DEFAULT_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

const state = {
  turnos: {
    Diurno: {
      bloqueMin: 45,
      maxBloquesDia: 8,
      inicio: '08:00',
      fin: '14:30',
      diasHabilitados: [...DEFAULT_DAYS],
      prioridadDias: 'Lunes:1,Martes:2,Miércoles:3,Jueves:4,Viernes:5',
      recesoInicio: '10:00',
      recesoFin: '10:15',
      almuerzoInicio: '12:00',
      almuerzoFin: '13:00'
    },
    Nocturno: {
      bloqueMin: 45,
      maxBloquesDia: 6,
      inicio: '18:00',
      fin: '22:30',
      diasHabilitados: [...DEFAULT_DAYS],
      prioridadDias: 'Lunes:1,Martes:2,Miércoles:3,Jueves:4,Viernes:5',
      recesoInicio: '20:00',
      recesoFin: '20:15',
      almuerzoInicio: '00:00',
      almuerzoFin: '00:00'
    }
  },
  periodosByTurno: {
    Diurno: ['Cuatrimestre I', 'Cuatrimestre II'],
    Nocturno: ['Cuatrimestre I', 'Cuatrimestre II']
  },
  careersByCoord: {
    Arquitectura: ['Arquitectura', 'Diseño Gráfico'],
    Ingeniería: ['Ingeniería Industrial']
  },
  teachers: [
    { nombre: 'Ing. José Pérez', area: 'Tecnología' },
    { nombre: 'MSc. María López', area: 'Ciencias Básicas' }
  ],
  courses: [],
  assignments: []
};

state.courses = [
  {
    clase: 'Taller de Diseño',
    creditos: 4,
    docente: 'Ing. José Pérez',
    aula: 'Aula 1',
    coordinacion: 'Arquitectura',
    carrera: 'Arquitectura',
    turno: 'Diurno',
    year: 1
  }
];

const byId = (id) => document.getElementById(id);
const el = {
  sidebar: byId('sidebar'),
  principalView: byId('principal-view'),
  configView: byId('config-view'),
  coursesBody: byId('courses-body'),
  csvStatus: byId('csv-status'),
  csvInput: byId('csv-input'),
  manualStatus: byId('manual-status'),
  scheduleContainer: byId('schedule-container'),
  logConsole: byId('log-console'),
  teacherBody: byId('teacher-body'),
  coordBody: byId('coord-body'),
  cfgTurnoStatus: byId('cfg-turno-status'),
  periodBody: byId('period-body')
};

const selectIds = ['csv-coordinacion', 'manual-coordinacion', 'view-coordinacion'];
const careerSelectIds = ['csv-carrera', 'manual-carrera', 'view-carrera'];
const turnSelectIds = ['csv-turno', 'manual-turno', 'view-turno', 'cfg-turno', 'period-turno'];

const pad = (n) => String(n).padStart(2, '0');
const timeToMin = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};
const minToTime = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

const listCoordinaciones = () => Object.keys(state.careersByCoord);
const listCarreras = (coord) => state.careersByCoord[coord] || [];
const listTurnos = () => Object.keys(state.turnos);

const currentFilters = (scope = 'csv') => ({
  coordinacion: byId(`${scope}-coordinacion`)?.value,
  carrera: byId(`${scope}-carrera`)?.value,
  turno: byId(`${scope}-turno`)?.value
});

const slotLabel = (idx, from, to) => `D${idx}\n${from}-${to}`;

const parsePrioridadDias = (prioridad) => {
  const map = {};
  prioridad.split(',').forEach((item) => {
    const [d, p] = item.split(':').map((v) => v.trim());
    if (d) map[d] = Number(p) || 999;
  });
  return map;
};

const getDaysByTurno = (turno) => {
  const cfg = state.turnos[turno] || state.turnos.Diurno;
  const days = (cfg.diasHabilitados || DEFAULT_DAYS).map((d) => d.trim()).filter(Boolean);
  const priority = parsePrioridadDias(cfg.prioridadDias || 'Lunes:1,Martes:2,Miércoles:3,Jueves:4,Viernes:5');
  return [...new Set(days)].sort((a, b) => (priority[a] || 999) - (priority[b] || 999));
};

const getSlotsByTurno = (turno) => {
  const cfg = state.turnos[turno] || state.turnos.Diurno;
  const start = timeToMin(cfg.inicio);
  const end = timeToMin(cfg.fin);
  const slots = [];
  let idx = 1;
  for (let min = start; min + cfg.bloqueMin <= end && idx <= cfg.maxBloquesDia; min += cfg.bloqueMin) {
    const next = min + cfg.bloqueMin;
    const inBreak = timeToMin(cfg.recesoInicio) < next && timeToMin(cfg.recesoFin) > min;
    const inLunch = timeToMin(cfg.almuerzoInicio) < next && timeToMin(cfg.almuerzoFin) > min;
    if (!inBreak && !inLunch) {
      slots.push(slotLabel(idx, minToTime(min), minToTime(next)));
      idx += 1;
    }
  }
  return slots;
};

const log = (msg) => {
  const now = new Date();
  const stamp = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  el.logConsole.textContent = `[${stamp}] ${msg}\n${el.logConsole.textContent}`.trim();
};

const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      result.push(current.trim());
      current = '';
    } else current += char;
  }
  result.push(current.trim());
  return result;
};

const sameContext = (item, ctx) =>
  item.coordinacion === ctx.coordinacion && item.carrera === ctx.carrera && item.turno === ctx.turno;

const classAlreadyScheduled = (courseName, ctx, year) =>
  state.assignments.some((a) => a.course === courseName && sameContext(a, ctx) && a.year === year);

const findConflict = (candidate) =>
  state.assignments.find((a) => a.day === candidate.day && a.block === candidate.block && sameContext(a, candidate) && a.year === candidate.year);

const parseSlotRange = (slotLabelValue) => {
  const [, range = ''] = slotLabelValue.split('\n');
  const [from = '00:00', to = '00:00'] = range.split('-');
  return { from: from.trim(), to: to.trim() };
};

const buildSlotMetadata = (slots) =>
  slots.map((slot, index) => {
    const { from, to } = parseSlotRange(slot);
    return {
      label: slot,
      index,
      from,
      to,
      fromMin: timeToMin(from),
      toMin: timeToMin(to)
    };
  });

const hasContiguousSequence = (slotMeta, startIdx, size, bloqueMin) => {
  if (startIdx + size > slotMeta.length) return false;
  for (let i = startIdx; i < startIdx + size - 1; i += 1) {
    if (slotMeta[i + 1].fromMin - slotMeta[i].toMin !== 0) return false;
    if (slotMeta[i].toMin - slotMeta[i].fromMin !== bloqueMin) return false;
  }
  return slotMeta[startIdx + size - 1].toMin - slotMeta[startIdx + size - 1].fromMin === bloqueMin;
};

const findResourceConflict = (ctx, day, block, teacher, room) =>
  state.assignments.find(
    (a) => sameContext(a, ctx) && a.day === day && a.block === block && (a.teacher === teacher || a.room === room)
  );

const countYearAssignmentsByDay = (ctx, year, day) =>
  state.assignments.filter((a) => sameContext(a, ctx) && a.year === year && a.day === day).length;

const classHasAssignments = (ctx, year, courseName) =>
  state.assignments.some((a) => sameContext(a, ctx) && a.year === year && a.course === courseName);

const canPlaceSequence = ({ ctx, year, day, startIdx, size, slotMeta, teacher, room, bloqueMin }) => {
  if (!hasContiguousSequence(slotMeta, startIdx, size, bloqueMin)) {
    return { ok: false, reason: 'No existe secuencia contigua suficiente.' };
  }

  for (let offset = 0; offset < size; offset += 1) {
    const slot = slotMeta[startIdx + offset];
    const occupiedYearCell = state.assignments.some(
      (a) => sameContext(a, ctx) && a.year === year && a.day === day && a.block === slot.label
    );
    if (occupiedYearCell) return { ok: false, reason: `Celda ocupada en ${day} ${slot.label.replace('\n', ' ')}.` };

    const resourceConflict = findResourceConflict(ctx, day, slot.label, teacher, room);
    if (resourceConflict) {
      const resource = resourceConflict.teacher === teacher ? 'docente' : 'aula';
      return {
        ok: false,
        reason: `Choque de ${resource} (${resource === 'docente' ? teacher : room}) en ${day} ${slot.label.replace('\n', ' ')}.`
      };
    }
  }

  return { ok: true };
};

const getPlacementCandidates = ({ ctx, year, course, days, slotMeta, bloqueMin }) => {
  const needed = Math.max(1, Number(course.creditos) || 1);
  const candidates = [];

  for (const day of days) {
    const dayLoad = countYearAssignmentsByDay(ctx, year, day);
    for (let startIdx = 0; startIdx <= slotMeta.length - needed; startIdx += 1) {
      const validation = canPlaceSequence({
        ctx,
        year,
        day,
        startIdx,
        size: needed,
        slotMeta,
        teacher: course.docente,
        room: course.aula,
        bloqueMin
      });

      if (validation.ok) {
        candidates.push({ day, startIdx, dayLoad, needed });
      }
    }
  }

  return candidates.sort((a, b) => (a.dayLoad - b.dayLoad) || (a.startIdx - b.startIdx));
};

const placeCourseSequence = ({ ctx, year, course, candidate, slotMeta }) => {
  const assignments = [];
  for (let offset = 0; offset < candidate.needed; offset += 1) {
    const block = slotMeta[candidate.startIdx + offset].label;
    const item = {
      course: course.clase,
      day: candidate.day,
      block,
      room: course.aula,
      teacher: course.docente,
      note: '',
      coordinacion: course.coordinacion,
      carrera: course.carrera,
      turno: course.turno,
      year,
      source: 'auto'
    };
    state.assignments.push(item);
    assignments.push(item);
  }
  return assignments;
};

const summarizeAutoGeneration = (assigned, conflicts) => {
  console.group('Resumen generación automática');
  console.log('Asignadas:', assigned.length);
  assigned.forEach((item) => {
    console.log(
      `✔ ${item.course} (Año ${item.year}) -> ${item.blocks.length} bloque(s) en ${item.day}: ${item.blocks.join(', ')}`
    );
  });
  console.log('Conflictos:', conflicts.length);
  conflicts.forEach((item) => {
    console.log(`✖ ${item.course} (Año ${item.year}) -> ${item.reason}`);
  });
  console.groupEnd();
};

const renderCoordinacionOptions = () => {
  const options = listCoordinaciones().map((c) => `<option value="${c}">${c}</option>`).join('');
  selectIds.forEach((id) => {
    const node = byId(id);
    if (node) node.innerHTML = options;
  });
};

const renderTurnoOptions = () => {
  const options = listTurnos().map((t) => `<option value="${t}">${t}</option>`).join('');
  turnSelectIds.forEach((id) => {
    const node = byId(id);
    if (node) node.innerHTML = options;
  });
};

const syncCareerSelects = () => {
  careerSelectIds.forEach((id) => {
    const scope = id.split('-')[0];
    const coord = byId(`${scope}-coordinacion`)?.value || listCoordinaciones()[0];
    const carrs = listCarreras(coord);
    byId(id).innerHTML = carrs.map((c) => `<option value="${c}">${c}</option>`).join('');
  });
};

const syncTopSelectors = () => {
  byId('manual-coordinacion').value = byId('csv-coordinacion').value;
  byId('manual-carrera').value = byId('csv-carrera').value;
  byId('manual-turno').value = byId('csv-turno').value;
};

const getCoursesByContext = (ctx) => state.courses.filter((c) => sameContext(c, ctx));

const renderCourses = () => {
  const ctx = currentFilters('csv');
  const rows = getCoursesByContext(ctx)
    .map(
      (c) => `<tr><td>${c.coordinacion}</td><td>${c.carrera}</td><td>${c.year || 1}</td><td>${c.clase}</td><td><span class="badge">${c.creditos} créditos</span></td><td>${c.docente}</td><td>${c.aula}</td></tr>`
    )
    .join('');
  el.coursesBody.innerHTML = rows || '<tr><td colspan="7">Sin información todavía.</td></tr>';
};

const renderTeacherTable = () => {
  el.teacherBody.innerHTML = state.teachers.map((t) => `<tr><td>${t.nombre}</td><td>${t.area}</td></tr>`).join('');
};

const renderCoordTable = () => {
  byId('coord-target').innerHTML = listCoordinaciones().map((c) => `<option value="${c}">${c}</option>`).join('');
  el.coordBody.innerHTML = listCoordinaciones().map((c) => `<tr><td>${c}</td><td>${listCarreras(c).join(', ')}</td></tr>`).join('');
};

const renderManualSelectors = () => {
  const ctx = currentFilters('manual');
  const courses = getCoursesByContext(ctx);
  const rooms = [...new Set(courses.map((c) => c.aula))];
  const teachers = [...new Set(courses.map((c) => c.docente).concat(state.teachers.map((t) => t.nombre)))];
  byId('manual-year').innerHTML = YEARS.map((y) => `<option value="${y}">${y}</option>`).join('');
  byId('manual-course').innerHTML = courses.map((c) => `<option value="${c.clase}">${c.clase} (Año ${c.year || 1})</option>`).join('');
  byId('manual-day').innerHTML = getDaysByTurno(ctx.turno).map((d) => `<option value="${d}">${d}</option>`).join('');
  byId('manual-slot').innerHTML = getSlotsByTurno(ctx.turno).map((s) => `<option value="${s}">${s.replace('\n', ' ')}</option>`).join('');
  byId('manual-room').innerHTML = rooms.map((r) => `<option value="${r}">${r}</option>`).join('');
  byId('manual-teacher').innerHTML = teachers.map((t) => `<option value="${t}">${t}</option>`).join('');
};

const renderPeriodos = () => {
  const turno = byId('csv-turno').value;
  byId('auto-periodo').innerHTML = (state.periodosByTurno[turno] || []).map((p) => `<option value="${p}">${p}</option>`).join('');
  const turnoPeriod = byId('period-turno').value || turno;
  el.periodBody.innerHTML = (state.periodosByTurno[turnoPeriod] || [])
    .map((p) => `<tr><td>${p}</td><td><button class="btn-outline btn-delete-period" data-period="${p}">Eliminar</button></td></tr>`)
    .join('');
};

const renderSchedule = () => {
  const ctx = currentFilters('view');
  const slots = getSlotsByTurno(ctx.turno);
  const days = getDaysByTurno(ctx.turno);
  el.scheduleContainer.innerHTML = YEARS.map((year) => {
    const rows = slots
      .map(
        (slot) => `<tr><td>${slot.replace('\n', '<br>')}</td>${days
          .map((day) => {
            const a = state.assignments.find((item) => item.day === day && item.block === slot && sameContext(item, ctx) && item.year === year);
            return `<td>${a ? `${a.course}<br><small>${a.teacher}</small><br><small>${a.room}</small>` : '-'}</td>`;
          })
          .join('')}</tr>`
      )
      .join('');
    return `<h4>Horario ${year}° año</h4><div class="table-wrap"><table><thead><tr><th>Bloque</th>${days
      .map((d) => `<th>${d}</th>`)
      .join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join('');
};

const importCSV = async () => {
  const file = el.csvInput.files?.[0];
  if (!file) {
    el.csvStatus.textContent = 'Selecciona un archivo CSV primero.';
    el.csvStatus.className = 'hint status-error';
    return;
  }
  const ctx = currentFilters('csv');
  const lines = (await file.text()).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map(parseCSVLine).filter((row) => row.length >= 4);

  const rows = /clase/i.test(lines[0]?.[0]) ? lines.slice(1) : lines;
  const loaded = rows.map(([clase, creditos, docente, aula, anio]) => ({
    clase,
    creditos: Number(creditos) || 1,
    docente,
    aula,
    coordinacion: ctx.coordinacion,
    carrera: ctx.carrera,
    turno: ctx.turno,
    year: Math.max(1, Math.min(5, Number(anio) || 1))
  }));

  state.courses = state.courses.filter((c) => !sameContext(c, ctx)).concat(loaded);
  el.csvStatus.textContent = `CSV importado: ${loaded.length} clases para ${ctx.carrera}.`;
  el.csvStatus.className = 'hint status-ok';
  log(`CSV cargado (${loaded.length} clases).`);
  renderCourses();
  renderManualSelectors();
};

const saveManual = (replaceMode = false) => {
  const ctx = currentFilters('manual');
  if (!ctx.carrera) {
    el.manualStatus.textContent = 'Selecciona carrera antes de agregar una clase manual.';
    el.manualStatus.className = 'hint status-error';
    return;
  }

  const courseName = byId('manual-course').value;
  const year = Number(byId('manual-year').value) || 1;
  if (!courseName) {
    el.manualStatus.textContent = 'No hay clases disponibles para asignar.';
    el.manualStatus.className = 'hint status-error';
    return;
  }

  const candidate = {
    course: courseName,
    day: byId('manual-day').value,
    block: byId('manual-slot').value,
    room: byId('manual-room').value,
    teacher: byId('manual-teacher').value,
    note: byId('manual-note').value.trim(),
    coordinacion: ctx.coordinacion,
    carrera: ctx.carrera,
    turno: ctx.turno,
    year,
    source: 'manual'
  };

  if (!replaceMode && classAlreadyScheduled(candidate.course, candidate, candidate.year)) {
    el.manualStatus.textContent = 'Esta clase ya fue asignada en ese contexto/año.';
    el.manualStatus.className = 'hint status-error';
    return;
  }

  const existingInCell = findConflict(candidate);
  if (existingInCell) {
    const ok = window.confirm(
      `Ya existe ${existingInCell.course} en ${candidate.day} ${candidate.block} para año ${candidate.year} de ${candidate.carrera}. Se perderá la clase actual. ¿Deseas reemplazar?`
    );
    if (!ok) return;
    state.assignments = state.assignments.filter((a) => a !== existingInCell);
  }

  if (replaceMode) {
    state.assignments = state.assignments.filter((a) => !(a.course === candidate.course && sameContext(a, candidate) && a.year === candidate.year));
  }

  state.assignments.push(candidate);
  byId('manual-note').value = '';
  el.manualStatus.textContent = 'Asignación guardada correctamente.';
  el.manualStatus.className = 'hint status-ok';
  renderSchedule();
};

const autoGenerate = () => {
  const ctx = currentFilters('csv');
  const slots = getSlotsByTurno(ctx.turno);
  const days = getDaysByTurno(ctx.turno);
  const slotMeta = buildSlotMetadata(slots);
  const courses = getCoursesByContext(ctx);
  const bloqueMin = (state.turnos[ctx.turno] || state.turnos.Diurno).bloqueMin;

  state.assignments = state.assignments.filter((a) => !(sameContext(a, ctx) && a.source === 'auto'));

  const assignedCourses = [];
  const conflicts = [];

  for (const year of YEARS) {
    const yearCourses = courses
      .filter((c) => (c.year || 1) === year)
      .sort((a, b) => (Number(b.creditos) || 1) - (Number(a.creditos) || 1));

    for (const course of yearCourses) {
      if (classHasAssignments(ctx, year, course.clase)) continue;

      const candidates = getPlacementCandidates({
        ctx,
        year,
        course,
        days,
        slotMeta,
        bloqueMin
      });

      if (!candidates.length) {
        const needed = Math.max(1, Number(course.creditos) || 1);
        conflicts.push({
          course: course.clase,
          year,
          reason: `Sin espacio contiguo de ${needed} bloque(s) o recursos ocupados.`
        });
        continue;
      }

      const placed = placeCourseSequence({
        ctx,
        year,
        course,
        candidate: candidates[0],
        slotMeta
      });
      assignedCourses.push({
        course: course.clase,
        year,
        day: candidates[0].day,
        blocks: placed.map((a) => a.block.replace('\n', ' '))
      });
    }
  }

  summarizeAutoGeneration(assignedCourses, conflicts);

  const totalBlocks = assignedCourses.reduce((sum, c) => sum + c.blocks.length, 0);
  const info = `Generación completada: ${assignedCourses.length} clases asignadas (${totalBlocks} bloques) y ${conflicts.length} conflicto(s).`;
  el.manualStatus.textContent = info;
  el.manualStatus.className = conflicts.length ? 'hint status-error' : 'hint status-ok';
  log(info);
  renderSchedule();
};

const resetDemo = () => {
  state.assignments = [];
  el.manualStatus.textContent = 'Solo se reinició el horario. Configuración conservada.';
  el.manualStatus.className = 'hint';
  renderSchedule();
  log('Horarios reiniciados (configuración preservada).');
};

const saveTurnoConfig = () => {
  const turno = byId('cfg-turno').value;
  const bloqueMin = Number(byId('cfg-turno-bloque').value) || 45;
  const maxBloquesDia = Number(byId('cfg-turno-max').value) || 8;
  const inicio = byId('cfg-turno-inicio').value || '08:00';
  const fin = byId('cfg-turno-fin').value || '14:30';
  const diasHabilitados = byId('cfg-turno-dias').value.split(',').map((d) => d.trim()).filter(Boolean);
  const prioridadDias = byId('cfg-turno-prioridad').value.trim() || 'Lunes:1,Martes:2,Miércoles:3,Jueves:4,Viernes:5';
  if (timeToMin(fin) <= timeToMin(inicio)) {
    el.cfgTurnoStatus.textContent = 'Rango de horas inválido.';
    el.cfgTurnoStatus.className = 'hint status-error';
    return;
  }
  state.turnos[turno] = {
    ...state.turnos[turno],
    bloqueMin,
    maxBloquesDia,
    inicio,
    fin,
    diasHabilitados: diasHabilitados.length ? diasHabilitados : [...DEFAULT_DAYS],
    prioridadDias,
    recesoInicio: byId('cfg-receso-inicio').value,
    recesoFin: byId('cfg-receso-fin').value,
    almuerzoInicio: byId('cfg-almuerzo-inicio').value,
    almuerzoFin: byId('cfg-almuerzo-fin').value
  };
  el.cfgTurnoStatus.textContent = `Turno ${turno} actualizado.`;
  el.cfgTurnoStatus.className = 'hint status-ok';
  renderManualSelectors();
  renderSchedule();
};

const loadTurnoConfig = (turno) => {
  const cfg = state.turnos[turno];
  byId('cfg-turno-bloque').value = cfg.bloqueMin;
  byId('cfg-turno-max').value = cfg.maxBloquesDia;
  byId('cfg-turno-inicio').value = cfg.inicio;
  byId('cfg-turno-fin').value = cfg.fin;
  byId('cfg-turno-dias').value = (cfg.diasHabilitados || DEFAULT_DAYS).join(',');
  byId('cfg-turno-prioridad').value = cfg.prioridadDias || 'Lunes:1,Martes:2,Miércoles:3,Jueves:4,Viernes:5';
  byId('cfg-receso-inicio').value = cfg.recesoInicio;
  byId('cfg-receso-fin').value = cfg.recesoFin;
  byId('cfg-almuerzo-inicio').value = cfg.almuerzoInicio;
  byId('cfg-almuerzo-fin').value = cfg.almuerzoFin;
};

const addPeriod = () => {
  const turno = byId('period-turno').value;
  const period = byId('period-name').value.trim();
  if (!period) return;
  state.periodosByTurno[turno] = state.periodosByTurno[turno] || [];
  if (!state.periodosByTurno[turno].includes(period)) state.periodosByTurno[turno].push(period);
  byId('period-name').value = '';
  renderPeriodos();
};

const removePeriod = (period) => {
  const turno = byId('period-turno').value;
  state.periodosByTurno[turno] = (state.periodosByTurno[turno] || []).filter((p) => p !== period);
  renderPeriodos();
};

const addTeacher = () => {
  const nombre = byId('teacher-name').value.trim();
  const area = byId('teacher-area').value.trim() || 'General';
  if (!nombre || state.teachers.some((t) => t.nombre === nombre)) return;
  state.teachers.push({ nombre, area });
  byId('teacher-name').value = '';
  byId('teacher-area').value = '';
  renderTeacherTable();
  renderManualSelectors();
};

const addCoord = () => {
  const coord = byId('coord-name').value.trim();
  const career = byId('career-name').value.trim();
  if (!coord || !career) return;
  if (!state.careersByCoord[coord]) state.careersByCoord[coord] = [];
  if (!state.careersByCoord[coord].includes(career)) state.careersByCoord[coord].push(career);
  byId('coord-name').value = '';
  byId('career-name').value = '';
  renderAllSelectors();
};

const linkCareer = () => {
  const coord = byId('coord-target').value;
  const career = byId('career-name').value.trim();
  if (!coord || !career) return;
  if (!state.careersByCoord[coord].includes(career)) state.careersByCoord[coord].push(career);
  byId('career-name').value = '';
  renderAllSelectors();
};

const renderAllSelectors = () => {
  renderCoordinacionOptions();
  renderTurnoOptions();
  syncCareerSelects();
  syncTopSelectors();
  renderCoordTable();
  renderCourses();
  renderManualSelectors();
  renderPeriodos();
  renderSchedule();
};

byId('btn-menu').addEventListener('click', () => el.sidebar.classList.toggle('open'));
byId('btn-importar-csv').addEventListener('click', importCSV);
byId('btn-guardar-asignacion').addEventListener('click', () => saveManual(false));
byId('btn-cambiar-asignacion').addEventListener('click', () => saveManual(true));
byId('btn-generar-auto').addEventListener('click', autoGenerate);
byId('btn-reiniciar').addEventListener('click', resetDemo);
byId('btn-guardar-turno').addEventListener('click', saveTurnoConfig);
byId('btn-add-period').addEventListener('click', addPeriod);
byId('btn-add-teacher').addEventListener('click', addTeacher);
byId('btn-add-coord').addEventListener('click', addCoord);
byId('btn-link-career').addEventListener('click', linkCareer);

el.periodBody.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.btn-delete-period');
  if (btn) removePeriod(btn.dataset.period);
});

selectIds.forEach((id) => byId(id).addEventListener('change', () => {
  syncCareerSelects();
  if (id === 'csv-coordinacion') syncTopSelectors();
  renderCourses();
  renderManualSelectors();
  renderSchedule();
}));

careerSelectIds.forEach((id) => byId(id).addEventListener('change', () => {
  if (id === 'csv-carrera') syncTopSelectors();
  renderCourses();
  renderSchedule();
}));

turnSelectIds.forEach((id) => {
  const node = byId(id);
  if (!node) return;
  node.addEventListener('change', () => {
    if (id === 'cfg-turno') loadTurnoConfig(node.value);
    if (id === 'period-turno' || id === 'csv-turno') renderPeriodos();
    if (id === 'csv-turno') syncTopSelectors();
    renderManualSelectors();
    renderSchedule();
  });
});

document.querySelectorAll('#footer-tabs .tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#footer-tabs .tab').forEach((tab) => tab.classList.remove('active'));
    btn.classList.add('active');
    const goConfig = btn.dataset.tab === 'config';
    el.principalView.classList.toggle('view-hidden', goConfig);
    el.configView.classList.toggle('view-hidden', !goConfig);
  });
});

renderAllSelectors();
loadTurnoConfig(byId('cfg-turno').value);
renderTeacherTable();
log('Interfaz iniciada.');
