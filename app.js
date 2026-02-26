const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

const state = {
  turnos: {
    Diurno: { bloqueMin: 45, maxBloquesDia: 8, inicio: '08:00', fin: '14:30' },
    Nocturno: { bloqueMin: 45, maxBloquesDia: 6, inicio: '18:00', fin: '22:30' }
  },
  periodos: ['Cuatrimestre I', 'Cuatrimestre II'],
  careersByCoord: {
    Arquitectura: ['Arquitectura', 'Diseño Gráfico'],
    Ingeniería: ['Ingeniería Industrial']
  },
  teachers: [
    { nombre: 'Ing. José Pérez', area: 'Tecnología' },
    { nombre: 'MSc. María López', area: 'Ciencias Básicas' }
  ],
  courses: [
    {
      clase: 'Taller de Diseño',
      creditos: 4,
      docente: 'Ing. José Pérez',
      aula: 'Aula 1',
      coordinacion: 'Arquitectura',
      carrera: 'Arquitectura',
      turno: 'Diurno'
    },
    {
      clase: 'Identidad Nacional',
      creditos: 2,
      docente: 'MSc. María López',
      aula: 'Aula 2',
      coordinacion: 'Arquitectura',
      carrera: 'Diseño Gráfico',
      turno: 'Diurno'
    }
  ],
  assignments: []
};

const byId = (id) => document.getElementById(id);
const el = {
  sidebar: byId('sidebar'),
  principalView: byId('principal-view'),
  configView: byId('config-view'),
  coursesBody: byId('courses-body'),
  csvStatus: byId('csv-status'),
  csvInput: byId('csv-input'),
  manualStatus: byId('manual-status'),
  scheduleTable: byId('schedule-table'),
  logConsole: byId('log-console'),
  teacherBody: byId('teacher-body'),
  coordBody: byId('coord-body'),
  cfgTurnoStatus: byId('cfg-turno-status')
};

const selectIds = [
  'csv-coordinacion',
  'manual-coordinacion',
  'auto-coordinacion',
  'view-coordinacion'
];
const careerSelectIds = ['csv-carrera', 'auto-carrera', 'view-carrera'];
const turnSelectIds = ['csv-turno', 'manual-turno', 'auto-turno', 'view-turno', 'cfg-turno'];

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

const getSlotsByTurno = (turno) => {
  const cfg = state.turnos[turno] || state.turnos.Diurno;
  const start = timeToMin(cfg.inicio);
  const end = timeToMin(cfg.fin);
  const slots = [];
  let idx = 1;
  for (let min = start; min + cfg.bloqueMin <= end && idx <= cfg.maxBloquesDia; min += cfg.bloqueMin) {
    slots.push(slotLabel(idx, minToTime(min), minToTime(min + cfg.bloqueMin)));
    idx += 1;
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

const classAlreadyScheduled = (courseName, ctx) =>
  state.assignments.some((a) => a.course === courseName && sameContext(a, ctx));

const findConflict = (candidate, ignoreCourse = null) =>
  state.assignments.find(
    (a) =>
      a.day === candidate.day &&
      a.block === candidate.block &&
      sameContext(a, candidate) &&
      a.course !== ignoreCourse &&
      (a.teacher === candidate.teacher || a.room === candidate.room)
  );

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

const getCoursesByContext = (ctx) => state.courses.filter((c) => sameContext(c, ctx));

const renderCourses = () => {
  const ctx = currentFilters('csv');
  const rows = getCoursesByContext(ctx)
    .map(
      (c) => `<tr><td>${c.coordinacion}</td><td>${c.carrera}</td><td>${c.clase}</td><td><span class="badge">${c.creditos} créditos</span></td><td>${c.docente}</td><td>${c.aula}</td></tr>`
    )
    .join('');
  el.coursesBody.innerHTML = rows || '<tr><td colspan="6">Sin información todavía.</td></tr>';
};

const renderTeacherTable = () => {
  el.teacherBody.innerHTML = state.teachers
    .map((t) => `<tr><td>${t.nombre}</td><td>${t.area}</td></tr>`)
    .join('');
};

const renderCoordTable = () => {
  byId('coord-target').innerHTML = listCoordinaciones().map((c) => `<option value="${c}">${c}</option>`).join('');
  el.coordBody.innerHTML = listCoordinaciones()
    .map((c) => `<tr><td>${c}</td><td>${listCarreras(c).join(', ')}</td></tr>`)
    .join('');
};

const renderManualSelectors = () => {
  const ctx = {
    coordinacion: byId('manual-coordinacion').value,
    carrera: listCarreras(byId('manual-coordinacion').value)[0] || '',
    turno: byId('manual-turno').value
  };
  const courses = getCoursesByContext(ctx);
  const rooms = [...new Set(courses.map((c) => c.aula))];
  const teachers = [...new Set(courses.map((c) => c.docente).concat(state.teachers.map((t) => t.nombre)))];
  byId('manual-course').innerHTML = courses.map((c) => `<option value="${c.clase}">${c.clase}</option>`).join('');
  byId('manual-day').innerHTML = DAYS.map((d) => `<option value="${d}">${d}</option>`).join('');
  byId('manual-slot').innerHTML = getSlotsByTurno(ctx.turno).map((s) => `<option value="${s}">${s.replace('\n', ' ')}</option>`).join('');
  byId('manual-room').innerHTML = rooms.map((r) => `<option value="${r}">${r}</option>`).join('');
  byId('manual-teacher').innerHTML = teachers.map((t) => `<option value="${t}">${t}</option>`).join('');
};

const renderPeriodos = () => {
  byId('auto-periodo').innerHTML = state.periodos.map((p) => `<option value="${p}">${p}</option>`).join('');
};

const renderSchedule = () => {
  const ctx = currentFilters('view');
  const slots = getSlotsByTurno(ctx.turno);
  el.scheduleTable.innerHTML = `<thead><tr><th>Bloque</th>${DAYS.map((d) => `<th>${d}</th>`).join('')}</tr></thead><tbody>${slots
    .map(
      (slot) => `<tr><td>${slot.replace('\n', '<br>')}</td>${DAYS.map((day) => {
        const a = state.assignments.find((item) => item.day === day && item.block === slot && sameContext(item, ctx));
        return `<td>${a ? `${a.course}<br><small>${a.teacher}</small><br><small>${a.room}</small>` : '-'}</td>`;
      }).join('')}</tr>`
    )
    .join('')}</tbody>`;
};

const importCSV = async () => {
  const file = el.csvInput.files?.[0];
  if (!file) {
    el.csvStatus.textContent = 'Selecciona un archivo CSV primero.';
    el.csvStatus.className = 'hint status-error';
    return;
  }
  const ctx = currentFilters('csv');
  const lines = (await file.text())
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseCSVLine)
    .filter((row) => row.length >= 4);

  const rows = /clase/i.test(lines[0]?.[0]) ? lines.slice(1) : lines;
  const loaded = rows.map(([clase, creditos, docente, aula]) => ({
    clase,
    creditos: Number(creditos) || 1,
    docente,
    aula,
    coordinacion: ctx.coordinacion,
    carrera: ctx.carrera,
    turno: ctx.turno
  }));

  state.courses = state.courses.filter((c) => !sameContext(c, ctx)).concat(loaded);
  el.csvStatus.textContent = `CSV importado: ${loaded.length} clases para ${ctx.carrera}.`;
  el.csvStatus.className = 'hint status-ok';
  log(`CSV cargado (${loaded.length} clases).`);
  renderCourses();
  renderManualSelectors();
};

const saveManual = (replaceMode = false) => {
  const courseName = byId('manual-course').value;
  if (!courseName) {
    el.manualStatus.textContent = 'No hay clases disponibles para asignar.';
    el.manualStatus.className = 'hint status-error';
    return;
  }

  const coord = byId('manual-coordinacion').value;
  const turno = byId('manual-turno').value;
  const career = listCarreras(coord)[0] || '';
  const candidate = {
    course: courseName,
    day: byId('manual-day').value,
    block: byId('manual-slot').value,
    room: byId('manual-room').value,
    teacher: byId('manual-teacher').value,
    note: byId('manual-note').value.trim(),
    coordinacion: coord,
    carrera: career,
    turno
  };

  if (!replaceMode && classAlreadyScheduled(candidate.course, candidate)) {
    el.manualStatus.textContent = 'Esta clase ya fue asignada en ese contexto.';
    el.manualStatus.className = 'hint status-error';
    return;
  }

  const conflict = findConflict(candidate, replaceMode ? candidate.course : null);
  if (conflict) {
    el.manualStatus.textContent = `Conflicto: ${conflict.teacher === candidate.teacher ? 'docente' : 'aula'} ocupado(a) en ${candidate.day}.`;
    el.manualStatus.className = 'hint status-error';
    return;
  }

  if (replaceMode) {
    state.assignments = state.assignments.filter((a) => !(a.course === candidate.course && sameContext(a, candidate)));
  }

  state.assignments.push(candidate);
  byId('manual-note').value = '';
  el.manualStatus.textContent = 'Asignación guardada correctamente.';
  el.manualStatus.className = 'hint status-ok';
  renderSchedule();
};

const autoGenerate = () => {
  const ctx = currentFilters('auto');
  const slots = getSlotsByTurno(ctx.turno);
  const cells = DAYS.flatMap((day) => slots.map((block) => ({ day, block })));
  const courses = getCoursesByContext(ctx);

  state.assignments = state.assignments.filter((a) => !sameContext(a, ctx));

  let cursor = 0;
  let assignedCount = 0;

  for (const course of courses) {
    const needed = Math.max(1, Number(course.creditos) || 1);
    let placed = 0;

    while (placed < needed && cursor < cells.length) {
      const cell = cells[cursor++];
      const candidate = {
        course: course.clase,
        day: cell.day,
        block: cell.block,
        room: course.aula,
        teacher: course.docente,
        note: '',
        coordinacion: course.coordinacion,
        carrera: course.carrera,
        turno: course.turno
      };

      const alreadyInCell = state.assignments.some((a) => a.day === cell.day && a.block === cell.block && sameContext(a, ctx));
      const conflict = findConflict(candidate);
      if (alreadyInCell || conflict || classAlreadyScheduled(candidate.course, candidate)) {
        continue;
      }
      state.assignments.push(candidate);
      placed += 1;
      assignedCount += 1;
    }
  }

  const info = `Generación completada: ${assignedCount} bloques asignados (${courses.length} clases).`;
  el.manualStatus.textContent = info;
  el.manualStatus.className = 'hint status-ok';
  log(info);
  renderSchedule();
};

const resetDemo = () => {
  state.assignments = [];
  el.manualStatus.textContent = 'Horario reiniciado.';
  el.manualStatus.className = 'hint';
  renderSchedule();
  log('Demo reiniciada.');
};

const saveTurnoConfig = () => {
  const turno = byId('cfg-turno').value;
  const bloqueMin = Number(byId('cfg-turno-bloque').value) || 45;
  const maxBloquesDia = Number(byId('cfg-turno-max').value) || 8;
  const inicio = byId('cfg-inicio').value;
  const fin = byId('cfg-fin').value;
  if (timeToMin(fin) <= timeToMin(inicio)) {
    el.cfgTurnoStatus.textContent = 'Rango de horas inválido.';
    el.cfgTurnoStatus.className = 'hint status-error';
    return;
  }
  state.turnos[turno] = { bloqueMin, maxBloquesDia, inicio, fin };
  el.cfgTurnoStatus.textContent = `Turno ${turno} actualizado.`;
  el.cfgTurnoStatus.className = 'hint status-ok';
  renderManualSelectors();
  renderSchedule();
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
  renderCoordTable();
  renderCourses();
  renderManualSelectors();
  renderSchedule();
};

byId('btn-menu').addEventListener('click', () => el.sidebar.classList.toggle('open'));
byId('btn-importar-csv').addEventListener('click', importCSV);
byId('btn-guardar-asignacion').addEventListener('click', () => saveManual(false));
byId('btn-cambiar-asignacion').addEventListener('click', () => saveManual(true));
byId('btn-generar-auto').addEventListener('click', autoGenerate);
byId('btn-reiniciar').addEventListener('click', resetDemo);
byId('btn-guardar-turno').addEventListener('click', saveTurnoConfig);
byId('btn-add-teacher').addEventListener('click', addTeacher);
byId('btn-add-coord').addEventListener('click', addCoord);
byId('btn-link-career').addEventListener('click', linkCareer);

selectIds.forEach((id) => byId(id).addEventListener('change', () => {
  syncCareerSelects();
  renderCourses();
  renderManualSelectors();
  renderSchedule();
}));

careerSelectIds.forEach((id) => byId(id).addEventListener('change', () => {
  renderCourses();
  renderSchedule();
}));

turnSelectIds.forEach((id) => {
  const node = byId(id);
  if (!node) return;
  node.addEventListener('change', () => {
    if (id === 'cfg-turno') {
      const cfg = state.turnos[node.value];
      byId('cfg-turno-bloque').value = cfg.bloqueMin;
      byId('cfg-turno-max').value = cfg.maxBloquesDia;
      byId('cfg-inicio').value = cfg.inicio;
      byId('cfg-fin').value = cfg.fin;
    }
    renderManualSelectors();
    renderSchedule();
  });
});

['cfg-inicio', 'cfg-fin', 'cfg-bloque'].forEach((id) => {
  byId(id).addEventListener('change', () => {
    const turno = byId('auto-turno').value;
    state.turnos[turno].inicio = byId('cfg-inicio').value;
    state.turnos[turno].fin = byId('cfg-fin').value;
    state.turnos[turno].bloqueMin = Number(byId('cfg-bloque').value) || state.turnos[turno].bloqueMin;
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
renderTeacherTable();
renderPeriodos();
log('Interfaz iniciada.');
