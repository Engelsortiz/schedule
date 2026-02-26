const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

const state = {
  courses: [
    { clase: 'Taller de Diseño', creditos: 4, docente: 'Ing. José Pérez', aula: 'Aula 1', coordinacion: 'Arquitectura', carrera: 'Arquitectura' },
    { clase: 'Identidad Nacional', creditos: 2, docente: 'MSc. María López', aula: 'Aula 2', coordinacion: 'Arquitectura', carrera: 'Diseño Gráfico' }
  ],
  teachers: [{ nombre: 'Ing. José Pérez', area: 'Tecnología' }, { nombre: 'MSc. María López', area: 'Ciencias Básicas' }],
  careers: [{ coordinacion: 'Arquitectura', carrera: 'Arquitectura' }],
  assignments: []
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
const autoStatus = byId('auto-status');
const scheduleTable = byId('schedule-table');
const principalView = byId('principal-view');
const configView = byId('config-view');
const logConsole = byId('log-console');

const timeToMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const minToTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const getTimeSlots = () => {
  const start = timeToMin(byId('cfg-inicio').value || '08:00');
  const end = timeToMin(byId('cfg-fin').value || '14:30');
  const block = 45;
  const slots = [];
  let idx = 1;
  for (let m = start; m + block <= end; m += block) {
    slots.push(`D${idx++}\n${minToTime(m)}-${minToTime(m + block)}`);
  }
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
  const coord = byId('csv-coordinacion').value;
  const career = byId('csv-carrera').value;
  coursesBody.innerHTML = state.courses
    .map((c) => `<tr><td>${coord}</td><td>${career}</td><td>${c.clase}</td><td>${c.creditos}</td><td>${c.docente}</td><td>${c.aula}</td></tr>`)
    .join('');
};

const renderSelectors = () => {
  const slots = getTimeSlots();
  const rooms = [...new Set(state.courses.map((c) => c.aula))];
  const teachers = [...new Set(state.courses.map((c) => c.docente).concat(state.teachers.map((t) => t.nombre)))];
  manualCourse.innerHTML = state.courses.map((c) => `<option>${c.clase}</option>`).join('');
  manualDay.innerHTML = DAYS.map((d) => `<option>${d}</option>`).join('');
  manualSlot.innerHTML = slots.map((s) => `<option>${s}</option>`).join('');
  manualRoom.innerHTML = rooms.map((r) => `<option>${r}</option>`).join('');
  manualTeacher.innerHTML = teachers.map((d) => `<option>${d}</option>`).join('');
};

const assignmentAt = (day, block) => state.assignments.find((a) => a.day === day && a.block === block);

const renderSchedule = () => {
  const slots = getTimeSlots();
  scheduleTable.innerHTML = `<thead><tr><th>Bloque</th>${DAYS.map((d) => `<th>${d}</th>`).join('')}</tr></thead><tbody>${slots
    .map((slot) => `<tr><td>${slot.replace('\n', '<br>')}</td>${DAYS.map((day) => {
      const item = assignmentAt(day, slot);
      return `<td>${item ? `${item.course}<br><small>${item.room}</small>` : '-'}</td>`;
    }).join('')}</tr>`)
    .join('')}</tbody>`;
};

const importCSV = async () => {
  const file = csvInput.files?.[0];
  if (!file) {
    csvStatus.textContent = 'Selecciona un archivo CSV primero.';
    return;
  }
  const rows = (await file.text())
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseCSVLine)
    .filter((r) => r.length >= 4);

  const body = /clase/i.test(rows[0]?.[0]) ? rows.slice(1) : rows;
  state.courses = body.map(([clase, creditos, docente, aula]) => ({ clase, creditos: Number(creditos) || 1, docente, aula }));
  csvStatus.textContent = `CSV importado: ${state.courses.length} clases.`;
  logMessage('CSV cargado con éxito.');
  renderCourses();
  renderSelectors();
};

const saveManual = () => {
  const item = {
    course: manualCourse.value,
    day: manualDay.value,
    block: manualSlot.value,
    room: manualRoom.value,
    teacher: manualTeacher.value,
    note: manualNote.value.trim()
  };
  const conflict = state.assignments.find((a) => a.day === item.day && a.block === item.block && (a.room === item.room || a.teacher === item.teacher));
  if (conflict) {
    autoStatus.textContent = 'Conflicto detectado: aula o docente ocupado.';
    autoStatus.classList.add('warning');
    return;
  }
  state.assignments = state.assignments.filter((a) => !(a.day === item.day && a.block === item.block));
  state.assignments.push(item);
  autoStatus.textContent = 'Asignación manual guardada.';
  autoStatus.classList.remove('warning');
  renderSchedule();
};

const autoGenerate = () => {
  const slots = getTimeSlots();
  const cells = DAYS.flatMap((day) => slots.map((block) => ({ day, block })));
  state.assignments = [];
  state.courses.forEach((course, i) => {
    const cell = cells[i % cells.length];
    state.assignments.push({ course: course.clase, day: cell.day, block: cell.block, room: course.aula, teacher: course.docente });
  });
  logMessage('Horario generado automáticamente.');
  autoStatus.textContent = 'Generación automática completada.';
  autoStatus.classList.remove('warning');
  renderSchedule();
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
  autoStatus.textContent = 'Demo reiniciada.';
  renderSchedule();
});

byId('cfg-inicio').addEventListener('change', () => {
  renderSelectors();
  renderSchedule();
});
byId('cfg-fin').addEventListener('change', () => {
  renderSelectors();
  renderSchedule();
});

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
});

document.querySelectorAll('#footer-tabs .tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#footer-tabs .tab').forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');
    const config = btn.dataset.tab === 'config';
    principalView.classList.toggle('view-hidden', config);
    configView.classList.toggle('view-hidden', !config);
  });
});

renderCourses();
renderSelectors();
renderSchedule();
byId('teacher-list').innerHTML = state.teachers.map((t) => `<li><strong>${t.nombre}</strong> · ${t.area}</li>`).join('');
byId('career-list').innerHTML = state.careers.map((c) => `<li>${c.coordinacion} → ${c.carrera}</li>`).join('');
logMessage('Interfaz iniciada.');
