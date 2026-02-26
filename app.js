const YEARS = [1, 2, 3, 4, 5];
const DEFAULT_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const DEFAULT_PRIORITY = 'Lunes:1,Martes:2,Miércoles:3,Jueves:4,Viernes:5';

const state = {
  courses: [
    { clase: 'Taller de Diseño', creditos: 4, docente: 'Ing. José Pérez', aula: 'Aula 1', coordinacion: 'Arquitectura', carrera: 'Arquitectura', turno: 'Diurno', year: 1 },
    { clase: 'Identidad Nacional', creditos: 2, docente: 'MSc. María López', aula: 'Aula 2', coordinacion: 'Arquitectura', carrera: 'Diseño Gráfico', turno: 'Diurno', year: 2 }
  ],
  teachers: [{ nombre: 'Ing. José Pérez', area: 'Tecnología' }, { nombre: 'MSc. María López', area: 'Ciencias Básicas' }],
  careers: [{ coordinacion: 'Arquitectura', carrera: 'Arquitectura' }],
  assignments: [],
  shiftConfig: {
    Diurno: { days: [...DEFAULT_DAYS], priority: DEFAULT_PRIORITY, start: '08:00', end: '14:30' },
    Nocturno: { days: [...DEFAULT_DAYS], priority: DEFAULT_PRIORITY, start: '18:00', end: '22:00' }
  },
  periods: { Diurno: ['Semestre I'], Nocturno: ['Semestre I'] }
};

const byId = (id) => document.getElementById(id);
const csvInput = byId('csv-input');
const coursesBody = byId('courses-body');
const csvStatus = byId('csv-status');
const manualCourse = byId('manual-course');
const manualDay = byId('manual-day');
const manualSlot = byId('manual-slot');
const manualRoom = byId('manual-room');
const manualTeacher = byId('manual-teacher');
const manualNote = byId('manual-note');
const manualYear = byId('manual-year');
const autoStatus = byId('auto-status');
const scheduleContainer = byId('schedule-container');
const principalView = byId('principal-view');
const configView = byId('config-view');
const logConsole = byId('log-console');

const activeSelection = () => ({
  coordinacion: byId('csv-coordinacion').value,
  carrera: byId('csv-carrera').value,
  turno: byId('csv-turno').value
});

const timeToMin = (t) => {
  const [h, m] = (t || '08:00').split(':').map(Number);
  return h * 60 + m;
};
const minToTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const currentConfig = () => state.shiftConfig[activeSelection().turno] || state.shiftConfig.Diurno;

const getTimeSlots = () => {
  const cfg = currentConfig();
  const start = timeToMin(cfg.start || '08:00');
  const end = timeToMin(cfg.end || '14:30');
  const block = 45;
  const slots = [];
  let idx = 1;
  for (let m = start; m + block <= end; m += block) slots.push(`D${idx++}\n${minToTime(m)}-${minToTime(m + block)}`);
  return slots;
};

const logMessage = (msg) => {
  const now = new Date();
  const stamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  logConsole.textContent = `[${stamp}] ${msg}\n${logConsole.textContent}`.trim();
};

const parseCSVLine = (line) => {
  const values = [];
  let value = '';
  let quote = false;
  for (const char of line) {
    if (char === '"') quote = !quote;
    else if (char === ',' && !quote) {
      values.push(value.trim());
      value = '';
    } else value += char;
  }
  values.push(value.trim());
  return values;
};

const renderCourses = () => {
  coursesBody.innerHTML = state.courses
    .map((c) => `<tr><td>${c.coordinacion}</td><td>${c.carrera}</td><td>${c.turno}</td><td>${c.year}</td><td>${c.clase}</td><td>${c.creditos}</td><td>${c.docente}</td><td>${c.aula}</td></tr>`)
    .join('');
};

const assignmentAt = (context, year, day, block) => state.assignments.find((a) => a.coordinacion === context.coordinacion && a.carrera === context.carrera && a.turno === context.turno && a.year === year && a.day === day && a.block === block);

const renderSelectors = () => {
  const slots = getTimeSlots();
  const context = activeSelection();
  const filtered = state.courses.filter((c) => c.coordinacion === context.coordinacion && c.carrera === context.carrera && c.turno === context.turno);
  const rooms = [...new Set(filtered.map((c) => c.aula))];
  const teachers = [...new Set(filtered.map((c) => c.docente).concat(state.teachers.map((t) => t.nombre)))];

  manualYear.innerHTML = YEARS.map((y) => `<option value="${y}">${y}</option>`).join('');
  manualCourse.innerHTML = filtered.map((c) => `<option>${c.clase}</option>`).join('');
  manualDay.innerHTML = (currentConfig().days || DEFAULT_DAYS).map((d) => `<option>${d}</option>`).join('');
  manualSlot.innerHTML = slots.map((s) => `<option>${s}</option>`).join('');
  manualRoom.innerHTML = rooms.map((r) => `<option>${r}</option>`).join('');
  manualTeacher.innerHTML = teachers.map((d) => `<option>${d}</option>`).join('');

  const periods = state.periods[context.turno] || [];
  byId('auto-period').innerHTML = periods.map((p) => `<option>${p}</option>`).join('');
};

const renderSchedule = () => {
  const context = {
    coordinacion: byId('view-coordinacion').value,
    carrera: byId('view-carrera').value,
    turno: byId('view-turno').value
  };
  const slots = getTimeSlots();
  const days = state.shiftConfig[context.turno]?.days || DEFAULT_DAYS;

  scheduleContainer.innerHTML = YEARS.map((year) => {
    const body = slots
      .map((slot) => `<tr><td>${slot.replace('\n', '<br>')}</td>${days.map((day) => {
        const item = assignmentAt(context, year, day, slot);
        return `<td>${item ? `${item.course}<br><small>${item.room}</small>` : '-'}</td>`;
      }).join('')}</tr>`)
      .join('');
    return `<h3>${year}° año</h3><div class="table-wrap"><table><thead><tr><th>Bloque</th>${days.map((d) => `<th>${d}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
  }).join('');
};

const syncViewFilters = () => {
  ['view-coordinacion', 'view-carrera', 'view-turno'].forEach((id) => {
    const base = byId(id.replace('view-', 'csv-'));
    const target = byId(id);
    target.innerHTML = base.innerHTML;
    target.value = base.value;
  });
};

const importCSV = async () => {
  const file = csvInput.files?.[0];
  if (!file) return (csvStatus.textContent = 'Selecciona un archivo CSV primero.');

  const rows = (await file.text()).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map(parseCSVLine);
  const header = rows[0]?.map((h) => h.toLowerCase()) || [];
  const hasHeader = header.some((h) => /clase|creditos|docente|aula|año|ano/.test(h));
  const body = hasHeader ? rows.slice(1) : rows;
  const idx = {
    clase: header.findIndex((h) => /clase/.test(h)),
    creditos: header.findIndex((h) => /creditos/.test(h)),
    docente: header.findIndex((h) => /docente/.test(h)),
    aula: header.findIndex((h) => /aula/.test(h)),
    year: header.findIndex((h) => /año|ano/.test(h))
  };
  const context = activeSelection();
  state.courses = body
    .filter((r) => r.length >= 4)
    .map((r) => ({
      clase: r[idx.clase >= 0 ? idx.clase : 0],
      creditos: Number(r[idx.creditos >= 0 ? idx.creditos : 1]) || 1,
      docente: r[idx.docente >= 0 ? idx.docente : 2],
      aula: r[idx.aula >= 0 ? idx.aula : 3],
      year: Number(r[idx.year]) || 1,
      ...context
    }));
  csvStatus.textContent = `CSV importado: ${state.courses.length} clases.`;
  logMessage('CSV cargado con éxito.');
  renderCourses();
  renderSelectors();
  renderSchedule();
};

const saveManual = () => {
  const context = activeSelection();
  if (!context.carrera) {
    autoStatus.textContent = 'Selecciona carrera primero para agregar clase manual.';
    autoStatus.classList.add('warning');
    return;
  }

  const year = Number(manualYear.value || 1);
  const item = { course: manualCourse.value, day: manualDay.value, block: manualSlot.value, room: manualRoom.value, teacher: manualTeacher.value, note: manualNote.value.trim(), year, ...context };
  const existingInHour = state.assignments.find((a) => a.coordinacion === context.coordinacion && a.carrera === context.carrera && a.turno === context.turno && a.year === year && a.day === item.day && a.block === item.block);

  if (existingInHour) {
    autoStatus.textContent = `Advertencia: se reemplazará la clase actual en ${item.day} ${item.block.split('\n')[0]} para ${year}° año de ${context.carrera}.`;
    autoStatus.classList.add('warning');
  } else {
    autoStatus.textContent = 'Asignación manual guardada.';
    autoStatus.classList.remove('warning');
  }

  state.assignments = state.assignments.filter((a) => !(a.coordinacion === context.coordinacion && a.carrera === context.carrera && a.turno === context.turno && a.year === year && a.day === item.day && a.block === item.block));
  state.assignments.push(item);
  renderSchedule();
};

const autoGenerate = () => {
  const context = activeSelection();
  if (!context.carrera) return;
  const period = byId('auto-period').value || 'Sin período';
  const slots = getTimeSlots();
  const days = state.shiftConfig[context.turno]?.days || DEFAULT_DAYS;
  const cells = days.flatMap((day) => slots.map((block) => ({ day, block })));

  state.assignments = state.assignments.filter((a) => !(a.coordinacion === context.coordinacion && a.carrera === context.carrera && a.turno === context.turno));
  const filtered = state.courses.filter((c) => c.coordinacion === context.coordinacion && c.carrera === context.carrera && c.turno === context.turno);
  filtered.forEach((course, i) => {
    const cell = cells[i % cells.length];
    state.assignments.push({ course: course.clase, day: cell.day, block: cell.block, room: course.aula, teacher: course.docente, year: Number(course.year) || 1, ...context, period });
  });
  logMessage(`Horario generado automáticamente (${period}).`);
  autoStatus.textContent = 'Generación automática completada.';
  autoStatus.classList.remove('warning');
  renderSchedule();
};

const renderPeriodList = () => {
  const turno = byId('period-turno').value;
  const list = state.periods[turno] || [];
  byId('period-list').innerHTML = list
    .map((p, i) => `<li>${turno}: ${p} <button data-turno="${turno}" data-i="${i}" class="btn-del-period">Eliminar</button></li>`)
    .join('');
  document.querySelectorAll('.btn-del-period').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.periods[btn.dataset.turno].splice(Number(btn.dataset.i), 1);
      renderPeriodList();
      renderSelectors();
    });
  });
};

byId('btn-menu').addEventListener('click', () => byId('sidebar').classList.toggle('sidebar-open'));
byId('btn-importar-csv').addEventListener('click', importCSV);
byId('btn-guardar-asignacion').addEventListener('click', saveManual);
byId('btn-limpiar-asignacion').addEventListener('click', () => {
  manualNote.value = '';
  autoStatus.textContent = 'Formulario listo para edición.';
});
byId('btn-generar-auto').addEventListener('click', autoGenerate);
byId('btn-reiniciar-demo').addEventListener('click', () => {
  state.assignments = [];
  autoStatus.textContent = 'Horario reiniciado. Configuración conservada.';
  renderSchedule();
});

['csv-coordinacion', 'csv-carrera', 'csv-turno'].forEach((id) => {
  byId(id).addEventListener('change', () => {
    syncViewFilters();
    renderSelectors();
    renderSchedule();
  });
});

['view-coordinacion', 'view-carrera', 'view-turno'].forEach((id) => byId(id).addEventListener('change', renderSchedule));

byId('btn-add-teacher').addEventListener('click', () => {
  const nombre = byId('teacher-name').value.trim();
  const area = byId('teacher-area').value.trim() || 'General';
  if (!nombre) return;
  state.teachers.push({ nombre, area });
  byId('teacher-list').innerHTML = state.teachers.map((t) => `<li><strong>${t.nombre}</strong> · ${t.area}</li>`).join('');
  renderSelectors();
});

byId('btn-add-career').addEventListener('click', () => {
  const coordinacion = byId('coord-name').value.trim();
  const carrera = byId('career-name').value.trim();
  if (!coordinacion || !carrera) return;
  state.careers.push({ coordinacion, carrera });
  byId('career-list').innerHTML = state.careers.map((c) => `<li>${c.coordinacion} → ${c.carrera}</li>`).join('');
  byId('csv-coordinacion').insertAdjacentHTML('beforeend', `<option>${coordinacion}</option>`);
  byId('csv-carrera').insertAdjacentHTML('beforeend', `<option>${carrera}</option>`);
  syncViewFilters();
});

byId('cfg-turno').addEventListener('change', () => {
  const cfg = state.shiftConfig[byId('cfg-turno').value];
  byId('cfg-days').value = cfg.days.join(',');
  byId('cfg-priority').value = cfg.priority || DEFAULT_PRIORITY;
  byId('cfg-start').value = cfg.start || '08:00';
  byId('cfg-end').value = cfg.end || '14:30';
});

byId('btn-save-turno').addEventListener('click', () => {
  const turno = byId('cfg-turno').value;
  state.shiftConfig[turno] = {
    days: byId('cfg-days').value.split(',').map((d) => d.trim()).filter(Boolean),
    priority: byId('cfg-priority').value.trim() || DEFAULT_PRIORITY,
    start: byId('cfg-start').value || '08:00',
    end: byId('cfg-end').value || '14:30'
  };
  renderSelectors();
  renderSchedule();
});

byId('btn-add-period').addEventListener('click', () => {
  const turno = byId('period-turno').value;
  const name = byId('period-name').value.trim();
  if (!name) return;
  state.periods[turno] = state.periods[turno] || [];
  state.periods[turno].push(name);
  byId('period-name').value = '';
  renderPeriodList();
  renderSelectors();
});
byId('period-turno').addEventListener('change', renderPeriodList);

const activateTab = (tab) => {
  const config = tab === 'config';
  document.querySelectorAll('#footer-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  principalView.classList.toggle('view-hidden', config);
  configView.classList.toggle('view-hidden', !config);
  const target = config ? configView : principalView;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

document.querySelectorAll('#footer-tabs .tab').forEach((btn) => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});

renderCourses();
syncViewFilters();
renderSelectors();
renderSchedule();
renderPeriodList();
byId('teacher-list').innerHTML = state.teachers.map((t) => `<li><strong>${t.nombre}</strong> · ${t.area}</li>`).join('');
byId('career-list').innerHTML = state.careers.map((c) => `<li>${c.coordinacion} → ${c.carrera}</li>`).join('');
byId('cfg-turno').dispatchEvent(new Event('change'));
if (window.location.hash === '#config-view') activateTab('config');
logMessage('Interfaz iniciada.');
