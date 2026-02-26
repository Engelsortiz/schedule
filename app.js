const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const YEARS = [1, 2, 3, 4, 5];
const STORAGE_KEY = 'ucc-schedule-state-v2';

const defaultState = {
  turnos: {
    Diurno: {
      bloqueMin: 45,
      maxBloquesDia: 8,
      inicio: '08:00',
      fin: '14:30',
      receso: '10:00-10:15',
      almuerzo: '12:00-13:00',
      diasHabiles: 'Lunes,Martes,Miércoles,Jueves,Viernes',
      prioridad: 'Lunes:1,Martes:2,Miércoles:3,Jueves:4,Viernes:5',
      periodos: ['Cuatrimestre I', 'Cuatrimestre II']
    },
    Nocturno: {
      bloqueMin: 45,
      maxBloquesDia: 6,
      inicio: '18:00',
      fin: '22:30',
      receso: '20:00-20:15',
      almuerzo: '00:00-00:00',
      diasHabiles: 'Lunes,Martes,Miércoles,Jueves,Viernes',
      prioridad: 'Lunes:1,Martes:2,Miércoles:3,Jueves:4,Viernes:5',
      periodos: ['Cuatrimestre I', 'Cuatrimestre II']
    }
  },
  careersByCoord: {
    Arquitectura: ['Arquitectura', 'Diseño Gráfico'],
    Ingeniería: ['Ingeniería Industrial']
  },
  teachers: [
    { nombre: 'Ing. José Pérez', area: 'Tecnología' },
    { nombre: 'MSc. María López', area: 'Ciencias Básicas' }
  ],
  courses: [
    { clase: 'Taller de Diseño', creditos: 4, docente: 'Ing. José Pérez', aula: 'Aula 1', coordinacion: 'Arquitectura', carrera: 'Arquitectura', turno: 'Diurno', year: 1 },
    { clase: 'Identidad Nacional', creditos: 2, docente: 'MSc. María López', aula: 'Aula 2', coordinacion: 'Arquitectura', carrera: 'Diseño Gráfico', turno: 'Diurno', year: 1 }
  ],
  assignments: []
};

const byId = (id) => document.getElementById(id);
const safeParse = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
const loaded = safeParse(localStorage.getItem(STORAGE_KEY));
const state = loaded ? { ...defaultState, ...loaded } : structuredClone(defaultState);

const el = {
  sidebar: byId('sidebar'),
  coursesBody: byId('courses-body'),
  csvStatus: byId('csv-status'),
  csvInput: byId('csv-input'),
  manualStatus: byId('manual-status'),
  scheduleBoards: byId('schedule-boards'),
  logConsole: byId('log-console'),
  teacherBody: byId('teacher-body'),
  coordBody: byId('coord-body'),
  cfgTurnoStatus: byId('cfg-turno-status'),
  periodList: byId('period-list'),
  principalView: byId('principal-view'),
  configView: byId('config-view')
};

const pad = (n) => String(n).padStart(2, '0');
const timeToMin = (time) => {
  const [h, m] = String(time || '00:00').split(':').map(Number);
  return h * 60 + m;
};
const minToTime = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

const persist = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const log = (msg) => {
  const now = new Date();
  const stamp = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  el.logConsole.textContent = `[${stamp}] ${msg}\n${el.logConsole.textContent}`.trim();
};

const listCoordinaciones = () => Object.keys(state.careersByCoord);
const listCarreras = (coord) => state.careersByCoord[coord] || [];
const listTurnos = () => Object.keys(state.turnos);

const appContext = () => ({
  coordinacion: byId('ctx-coordinacion').value,
  carrera: byId('ctx-carrera').value,
  turno: byId('ctx-turno').value
});

const sameContext = (a, b) => a.coordinacion === b.coordinacion && a.carrera === b.carrera && a.turno === b.turno;

const getSlotsByTurno = (turno) => {
  const cfg = state.turnos[turno] || state.turnos.Diurno;
  const dias = cfg.diasHabiles
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)
    .filter((d) => DAYS.includes(d));
  const dayOrder = dias.length ? dias : DAYS;

  const receso = cfg.receso.split('-').map((v) => timeToMin(v.trim()));
  const almuerzo = cfg.almuerzo.split('-').map((v) => timeToMin(v.trim()));

  const slots = [];
  let idx = 1;
  for (let min = timeToMin(cfg.inicio); min + cfg.bloqueMin <= timeToMin(cfg.fin) && idx <= cfg.maxBloquesDia; min += cfg.bloqueMin) {
    const to = min + cfg.bloqueMin;
    const inBreak = (min < receso[1] && to > receso[0]) || (min < almuerzo[1] && to > almuerzo[0]);
    if (!inBreak) {
      slots.push(`D${idx}\n${minToTime(min)}-${minToTime(to)}`);
      idx += 1;
    }
  }
  return { slots, days: dayOrder };
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

const findHeaderIndex = (headers, names) => headers.findIndex((h) => names.includes(String(h).toLowerCase()));

const renderContextOptions = () => {
  const coordOpts = listCoordinaciones().map((c) => `<option value="${c}">${c}</option>`).join('');
  ['ctx-coordinacion', 'view-coordinacion'].forEach((id) => (byId(id).innerHTML = coordOpts));

  const turnoOpts = listTurnos().map((t) => `<option value="${t}">${t}</option>`).join('');
  ['ctx-turno', 'view-turno', 'cfg-turno', 'period-turno'].forEach((id) => (byId(id).innerHTML = turnoOpts));

  syncCareerSelectors();
};

const syncCareerSelectors = () => {
  const ctxCoord = byId('ctx-coordinacion').value || listCoordinaciones()[0];
  const viewCoord = byId('view-coordinacion').value || ctxCoord;
  byId('ctx-carrera').innerHTML = listCarreras(ctxCoord).map((c) => `<option value="${c}">${c}</option>`).join('');
  byId('view-carrera').innerHTML = listCarreras(viewCoord).map((c) => `<option value="${c}">${c}</option>`).join('');
};

const getCoursesByContextYear = (ctx, year) => state.courses.filter((c) => sameContext(c, ctx) && Number(c.year) === Number(year));
const classAssigned = (ctx, year, course) => state.assignments.some((a) => sameContext(a, ctx) && Number(a.year) === Number(year) && a.course === course);

const renderCourses = () => {
  const ctx = appContext();
  const rows = state.courses
    .filter((c) => sameContext(c, ctx))
    .sort((a, b) => Number(a.year) - Number(b.year))
    .map((c) => `<tr><td>${c.year}</td><td>${c.clase}</td><td><span class="badge">${c.creditos}</span></td><td>${c.docente}</td><td>${c.aula}</td></tr>`)
    .join('');
  el.coursesBody.innerHTML = rows || '<tr><td colspan="5">Sin información todavía.</td></tr>';
};

const renderTeacherTable = () => {
  el.teacherBody.innerHTML = state.teachers.map((t) => `<tr><td>${t.nombre}</td><td>${t.area}</td></tr>`).join('');
};

const renderCoordTable = () => {
  byId('coord-target').innerHTML = listCoordinaciones().map((c) => `<option value="${c}">${c}</option>`).join('');
  el.coordBody.innerHTML = listCoordinaciones().map((c) => `<tr><td>${c}</td><td>${listCarreras(c).join(', ')}</td></tr>`).join('');
};

const renderManualSelectors = () => {
  byId('manual-year').innerHTML = YEARS.map((y) => `<option value="${y}">${y}</option>`).join('');
  const ctx = appContext();
  const year = Number(byId('manual-year').value || 1);
  const courses = getCoursesByContextYear(ctx, year);
  const rooms = [...new Set(courses.map((c) => c.aula))];
  const teachers = [...new Set(courses.map((c) => c.docente).concat(state.teachers.map((t) => t.nombre)))];
  byId('manual-course').innerHTML = courses.map((c) => `<option value="${c.clase}">${c.clase}</option>`).join('');
  byId('manual-day').innerHTML = DAYS.map((d) => `<option value="${d}">${d}</option>`).join('');
  const cfg = getSlotsByTurno(ctx.turno);
  byId('manual-slot').innerHTML = cfg.slots.map((s) => `<option value="${s}">${s.replace('\n', ' ')}</option>`).join('');
  byId('manual-room').innerHTML = rooms.map((r) => `<option value="${r}">${r}</option>`).join('');
  byId('manual-teacher').innerHTML = teachers.map((t) => `<option value="${t}">${t}</option>`).join('');
};

const renderPeriodSelect = () => {
  const turno = byId('ctx-turno').value;
  const periods = state.turnos[turno]?.periodos || [];
  byId('auto-periodo').innerHTML = periods.map((p) => `<option value="${p}">${p}</option>`).join('');
};

const renderPeriodList = () => {
  const turno = byId('period-turno').value;
  const periods = state.turnos[turno]?.periodos || [];
  el.periodList.innerHTML = periods
    .map((p, i) => `<li>${p}<button class="btn-outline" data-remove-period="${i}">Eliminar</button></li>`)
    .join('');
};

const renderTurnoConfigInputs = () => {
  const turno = byId('cfg-turno').value;
  const cfg = state.turnos[turno];
  byId('cfg-turno-bloque').value = cfg.bloqueMin;
  byId('cfg-turno-max').value = cfg.maxBloquesDia;
  byId('cfg-inicio').value = cfg.inicio;
  byId('cfg-fin').value = cfg.fin;
  byId('cfg-receso').value = cfg.receso;
  byId('cfg-almuerzo').value = cfg.almuerzo;
  byId('cfg-dias').value = cfg.diasHabiles;
  byId('cfg-prioridad').value = cfg.prioridad;
};

const renderSchedules = () => {
  const ctx = {
    coordinacion: byId('view-coordinacion').value,
    carrera: byId('view-carrera').value,
    turno: byId('view-turno').value
  };
  const cfg = getSlotsByTurno(ctx.turno);

  el.scheduleBoards.innerHTML = YEARS.map((year) => {
    const table = `<table><thead><tr><th>Bloque</th>${cfg.days.map((d) => `<th>${d}</th>`).join('')}</tr></thead><tbody>${cfg.slots
      .map((slot) => `<tr><td>${slot.replace('\n', '<br>')}</td>${cfg.days
        .map((day) => {
          const a = state.assignments.find((it) => sameContext(it, ctx) && Number(it.year) === year && it.day === day && it.block === slot);
          return `<td>${a ? `${a.course}<br><small>${a.teacher}</small><br><small>${a.room}</small>` : '-'}</td>`;
        })
        .join('')}</tr>`)
      .join('')}</tbody></table>`;
    return `<section class="schedule-year"><h3>Horario ${year}° año</h3><div class="table-wrap">${table}</div></section>`;
  }).join('');
};

const importCSV = async () => {
  const file = el.csvInput.files?.[0];
  if (!file) {
    el.csvStatus.textContent = 'Selecciona un archivo CSV primero.';
    el.csvStatus.className = 'hint status-error';
    return;
  }
  const ctx = appContext();
  if (!ctx.carrera) {
    el.csvStatus.textContent = 'Debes seleccionar carrera antes de importar.';
    el.csvStatus.className = 'hint status-error';
    return;
  }
  const rows = (await file.text())
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCSVLine);

  const maybeHeader = rows[0].map((h) => h.toLowerCase());
  const hasHeader = maybeHeader.includes('clase');
  const body = hasHeader ? rows.slice(1) : rows;
  const classIdx = hasHeader ? findHeaderIndex(maybeHeader, ['clase']) : 0;
  const creditIdx = hasHeader ? findHeaderIndex(maybeHeader, ['creditos', 'créditos']) : 1;
  const teacherIdx = hasHeader ? findHeaderIndex(maybeHeader, ['docente', 'profesor']) : 2;
  const roomIdx = hasHeader ? findHeaderIndex(maybeHeader, ['aula', 'salon', 'salón']) : 3;
  const yearIdx = hasHeader ? findHeaderIndex(maybeHeader, ['año', 'anio', 'year']) : 4;

  const imported = body
    .filter((r) => r[classIdx])
    .map((r) => ({
      clase: r[classIdx],
      creditos: Number(r[creditIdx]) || 1,
      docente: r[teacherIdx] || 'Sin docente',
      aula: r[roomIdx] || 'Sin aula',
      coordinacion: ctx.coordinacion,
      carrera: ctx.carrera,
      turno: ctx.turno,
      year: YEARS.includes(Number(r[yearIdx])) ? Number(r[yearIdx]) : 1
    }));

  state.courses = state.courses.filter((c) => !sameContext(c, ctx)).concat(imported);
  persist();
  el.csvStatus.textContent = `CSV importado: ${imported.length} clases.`;
  el.csvStatus.className = 'hint status-ok';
  renderCourses();
  renderManualSelectors();
  renderSchedules();
  log(`CSV importado para ${ctx.carrera}.`);
};

const addManualAssignment = (replaceMode = false) => {
  const ctx = appContext();
  if (!ctx.carrera) {
    el.manualStatus.textContent = 'Selecciona carrera primero para agregar una clase manual.';
    el.manualStatus.className = 'hint status-error';
    return;
  }
  const year = Number(byId('manual-year').value || 1);
  const candidate = {
    coordinacion: ctx.coordinacion,
    carrera: ctx.carrera,
    turno: ctx.turno,
    year,
    course: byId('manual-course').value,
    day: byId('manual-day').value,
    block: byId('manual-slot').value,
    room: byId('manual-room').value,
    teacher: byId('manual-teacher').value,
    source: 'manual'
  };

  if (!candidate.course) {
    el.manualStatus.textContent = 'No hay clase para este año. Importa CSV o agrega clases primero.';
    el.manualStatus.className = 'hint status-error';
    return;
  }

  const sameBlock = state.assignments.find(
    (a) => sameContext(a, candidate) && Number(a.year) === year && a.day === candidate.day && a.block === candidate.block
  );

  if (sameBlock && !replaceMode) {
    const warn = `Ya existe una clase en ${candidate.day} ${candidate.block.replace('\n', ' ')}. Se perderá para ${year}° año de ${ctx.carrera}. ¿Deseas reemplazarla?`;
    if (!window.confirm(warn)) {
      el.manualStatus.textContent = 'Asignación cancelada.';
      el.manualStatus.className = 'hint';
      return;
    }
  }

  const teacherRoomConflict = state.assignments.find(
    (a) =>
      sameContext(a, candidate) &&
      Number(a.year) === year &&
      a.day === candidate.day &&
      a.block === candidate.block &&
      (a.teacher === candidate.teacher || a.room === candidate.room)
  );

  if (teacherRoomConflict) {
    el.manualStatus.textContent = `Conflicto de ${teacherRoomConflict.teacher === candidate.teacher ? 'docente' : 'aula'} en ese bloque.`;
    el.manualStatus.className = 'hint status-error';
    return;
  }

  state.assignments = state.assignments.filter(
    (a) => !(sameContext(a, candidate) && Number(a.year) === year && a.day === candidate.day && a.block === candidate.block)
  );
  if (replaceMode) {
    state.assignments = state.assignments.filter(
      (a) => !(sameContext(a, candidate) && Number(a.year) === year && a.course === candidate.course)
    );
  }

  state.assignments.push(candidate);
  persist();
  el.manualStatus.textContent = 'Clase manual agregada.';
  el.manualStatus.className = 'hint status-ok';
  renderSchedules();
};

const autoGenerate = () => {
  const ctx = appContext();
  if (!ctx.carrera) {
    el.manualStatus.textContent = 'Selecciona carrera antes de generar.';
    el.manualStatus.className = 'hint status-error';
    return;
  }

  const { slots, days } = getSlotsByTurno(ctx.turno);
  const cells = days.flatMap((day) => slots.map((block) => ({ day, block })));
  const manualBase = state.assignments.filter((a) => !(sameContext(a, ctx) && a.source !== 'manual'));
  state.assignments = manualBase;

  let created = 0;
  for (const year of YEARS) {
    const courses = getCoursesByContextYear(ctx, year);
    for (const course of courses) {
      const already = classAssigned(ctx, year, course.clase);
      if (already) continue;

      const needed = Math.max(1, Number(course.creditos) || 1);
      let placed = 0;
      for (const cell of cells) {
        if (placed >= needed) break;
        const busyInYear = state.assignments.some((a) => sameContext(a, ctx) && Number(a.year) === year && a.day === cell.day && a.block === cell.block);
        const teacherRoomConflict = state.assignments.some(
          (a) => sameContext(a, ctx) && Number(a.year) === year && a.day === cell.day && a.block === cell.block && (a.teacher === course.docente || a.room === course.aula)
        );
        if (busyInYear || teacherRoomConflict) continue;

        state.assignments.push({
          coordinacion: ctx.coordinacion,
          carrera: ctx.carrera,
          turno: ctx.turno,
          year,
          course: course.clase,
          day: cell.day,
          block: cell.block,
          room: course.aula,
          teacher: course.docente,
          source: 'auto'
        });
        created += 1;
        placed += 1;
      }
    }
  }

  persist();
  const msg = `Generación automática completada (${created} bloques). Periodo: ${byId('auto-periodo').value || '-'} ${byId('auto-anio').value || ''}`;
  el.manualStatus.textContent = msg;
  el.manualStatus.className = 'hint status-ok';
  log(msg);
  renderSchedules();
};

const resetSchedules = () => {
  state.assignments = [];
  persist();
  renderSchedules();
  el.manualStatus.textContent = 'Se reiniciaron solo los horarios. Configuración intacta.';
  el.manualStatus.className = 'hint status-ok';
  log('Se reiniciaron solo horarios.');
};

const saveTurnoConfig = () => {
  const turno = byId('cfg-turno').value;
  const inicio = byId('cfg-inicio').value;
  const fin = byId('cfg-fin').value;
  if (timeToMin(fin) <= timeToMin(inicio)) {
    el.cfgTurnoStatus.textContent = 'Rango horario inválido.';
    el.cfgTurnoStatus.className = 'hint status-error';
    return;
  }

  state.turnos[turno] = {
    ...state.turnos[turno],
    bloqueMin: Number(byId('cfg-turno-bloque').value) || 45,
    maxBloquesDia: Number(byId('cfg-turno-max').value) || 8,
    inicio,
    fin,
    receso: byId('cfg-receso').value.trim() || '10:00-10:15',
    almuerzo: byId('cfg-almuerzo').value.trim() || '12:00-13:00',
    diasHabiles: byId('cfg-dias').value.trim() || 'Lunes,Martes,Miércoles,Jueves,Viernes',
    prioridad: byId('cfg-prioridad').value.trim() || 'Lunes:1,Martes:2,Miércoles:3,Jueves:4,Viernes:5'
  };

  persist();
  renderPeriodSelect();
  renderManualSelectors();
  renderSchedules();
  el.cfgTurnoStatus.textContent = `Turno ${turno} actualizado.`;
  el.cfgTurnoStatus.className = 'hint status-ok';
};

const addPeriod = () => {
  const turno = byId('period-turno').value;
  const period = byId('period-name').value.trim();
  if (!period) return;
  const list = state.turnos[turno].periodos;
  if (!list.includes(period)) list.push(period);
  byId('period-name').value = '';
  persist();
  renderPeriodList();
  renderPeriodSelect();
};

const removePeriod = (index) => {
  const turno = byId('period-turno').value;
  state.turnos[turno].periodos.splice(index, 1);
  persist();
  renderPeriodList();
  renderPeriodSelect();
};

const addTeacher = () => {
  const nombre = byId('teacher-name').value.trim();
  const area = byId('teacher-area').value.trim() || 'General';
  if (!nombre || state.teachers.some((t) => t.nombre === nombre)) return;
  state.teachers.push({ nombre, area });
  byId('teacher-name').value = '';
  byId('teacher-area').value = '';
  persist();
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
  persist();
  renderContextOptions();
  renderCoordTable();
};

const linkCareer = () => {
  const coord = byId('coord-target').value;
  const career = byId('career-name').value.trim();
  if (!coord || !career) return;
  if (!state.careersByCoord[coord].includes(career)) state.careersByCoord[coord].push(career);
  byId('career-name').value = '';
  persist();
  renderContextOptions();
  renderCoordTable();
};

const initEvents = () => {
  byId('btn-menu').addEventListener('click', () => el.sidebar.classList.toggle('open'));
  byId('btn-importar-csv').addEventListener('click', importCSV);
  byId('btn-guardar-asignacion').addEventListener('click', () => addManualAssignment(false));
  byId('btn-cambiar-asignacion').addEventListener('click', () => addManualAssignment(true));
  byId('btn-generar-auto').addEventListener('click', autoGenerate);
  byId('btn-reiniciar').addEventListener('click', resetSchedules);
  byId('btn-guardar-turno').addEventListener('click', saveTurnoConfig);
  byId('btn-add-period').addEventListener('click', addPeriod);
  byId('btn-add-teacher').addEventListener('click', addTeacher);
  byId('btn-add-coord').addEventListener('click', addCoord);
  byId('btn-link-career').addEventListener('click', linkCareer);

  ['ctx-coordinacion', 'ctx-carrera', 'ctx-turno'].forEach((id) => {
    byId(id).addEventListener('change', () => {
      if (id === 'ctx-coordinacion') syncCareerSelectors();
      renderCourses();
      renderManualSelectors();
      renderPeriodSelect();
    });
  });

  ['view-coordinacion', 'view-carrera', 'view-turno'].forEach((id) => {
    byId(id).addEventListener('change', () => {
      if (id === 'view-coordinacion') syncCareerSelectors();
      renderSchedules();
    });
  });

  byId('manual-year').addEventListener('change', renderManualSelectors);
  byId('cfg-turno').addEventListener('change', renderTurnoConfigInputs);
  byId('period-turno').addEventListener('change', renderPeriodList);

  el.periodList.addEventListener('click', (ev) => {
    const idx = ev.target?.dataset?.removePeriod;
    if (idx !== undefined) removePeriod(Number(idx));
  });

  document.querySelectorAll('#footer-tabs .tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#footer-tabs .tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const isConfig = btn.dataset.tab === 'config';
      el.principalView.classList.toggle('view-hidden', isConfig);
      el.configView.classList.toggle('view-hidden', !isConfig);
    });
  });
};

const init = () => {
  renderContextOptions();
  renderCourses();
  renderManualSelectors();
  renderTurnoConfigInputs();
  renderPeriodSelect();
  renderPeriodList();
  renderTeacherTable();
  renderCoordTable();
  renderSchedules();
  initEvents();
  log('Interfaz iniciada.');
};

init();
