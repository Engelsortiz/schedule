const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

const state = {
  courses: [
    { clase: 'Programación I', creditos: 4, docente: 'María Pérez', aula: 'A-201', estado: 'Pendiente' },
    { clase: 'Matemática II', creditos: 3, docente: 'Carlos Ruiz', aula: 'B-104', estado: 'Cargado' },
    { clase: 'Física General', creditos: 3, docente: 'Ana Torres', aula: 'Lab-2', estado: 'Pendiente' }
  ],
  teachers: [
    { nombre: 'María Pérez', area: 'Programación' },
    { nombre: 'Carlos Ruiz', area: 'Matemáticas' },
    { nombre: 'Ana Torres', area: 'Ciencias' }
  ],
  careers: [],
  enrollments: [],
  assignments: []
};

const principalView = document.getElementById('principal-view');
const configView = document.getElementById('config-view');
const footerTabs = document.getElementById('footer-tabs');
const sidebar = document.getElementById('sidebar');

const coursesBody = document.getElementById('courses-body');
const csvInput = document.getElementById('csv-input');
const csvStatus = document.getElementById('csv-status');
const btnImportCsv = document.getElementById('btn-importar-csv');

const manualCourse = document.getElementById('manual-course');
const manualDay = document.getElementById('manual-day');
const manualSlot = document.getElementById('manual-slot');
const manualRoom = document.getElementById('manual-room');
const manualTeacher = document.getElementById('manual-teacher');
const manualNote = document.getElementById('manual-note');
const btnSaveManual = document.getElementById('btn-guardar-asignacion');
const btnClearManual = document.getElementById('btn-limpiar-asignacion');

const btnAuto = document.getElementById('btn-generar-auto');
const btnReset = document.getElementById('btn-reiniciar-demo');
const autoStatus = document.getElementById('auto-status');
const scheduleTable = document.getElementById('schedule-table');

const cfgInicio = document.getElementById('cfg-inicio');
const cfgFin = document.getElementById('cfg-fin');
const cfgBloque = document.getElementById('cfg-bloque');

const teacherName = document.getElementById('teacher-name');
const teacherArea = document.getElementById('teacher-area');
const btnAddTeacher = document.getElementById('btn-add-teacher');
const teacherList = document.getElementById('teacher-list');

const coordName = document.getElementById('coord-name');
const careerName = document.getElementById('career-name');
const btnAddCareer = document.getElementById('btn-add-career');
const careerList = document.getElementById('career-list');

const enrollCareer = document.getElementById('enroll-career');
const enrollSemester = document.getElementById('enroll-semester');
const enrollStudents = document.getElementById('enroll-students');
const enrollMax = document.getElementById('enroll-max');
const enrollGroups = document.getElementById('enroll-groups');
const btnSaveEnroll = document.getElementById('btn-save-enroll');
const enrollList = document.getElementById('enroll-list');
const logConsole = document.getElementById('log-console');


const logMessage = (message) => {
  if (!logConsole) return;
  const date = new Date();
  const stamp = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
  logConsole.textContent = `[${stamp}] ${message}
${logConsole.textContent}`.trim().slice(0, 5000);
};

const setActiveView = (tabName) => {
  const isConfig = tabName === 'config';
  principalView.classList.toggle('view-hidden', isConfig);
  configView.classList.toggle('view-hidden', !isConfig);
  footerTabs.querySelectorAll('.tab').forEach((tab) => {
    const isActive = tab.dataset.tab === tabName;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });
};

const timeToMin = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const minToTime = (minutes) => {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
};

const getTimeSlots = () => {
  const start = timeToMin(cfgInicio.value || '07:00');
  const end = timeToMin(cfgFin.value || '12:15');
  const block = Number(cfgBloque.value) || 45;
  const slots = [];

  for (let min = start; min + block <= end; min += block) {
    slots.push(`${minToTime(min)} - ${minToTime(min + block)}`);
  }
  return slots.length ? slots : ['07:00 - 07:45'];
};

const parseCSVLine = (line) => {
  const values = [];
  let value = '';
  let quote = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      quote = !quote;
      continue;
    }
    if (char === ',' && !quote) {
      values.push(value.trim());
      value = '';
      continue;
    }
    value += char;
  }
  values.push(value.trim());
  return values;
};

const renderCourses = () => {
  coursesBody.innerHTML = state.courses
    .map(
      (course) => `<tr>
        <td>${course.clase}</td>
        <td>${course.creditos}</td>
        <td>${course.docente}</td>
        <td>${course.aula}</td>
        <td><span class="tag">${course.estado}</span></td>
      </tr>`
    )
    .join('');
};

const renderManualSelectors = () => {
  const aulas = [...new Set(state.courses.map((c) => c.aula))].sort();
  const docentes = [...new Set(state.courses.map((c) => c.docente).concat(state.teachers.map((t) => t.nombre)))].sort();
  const bloques = getTimeSlots();

  manualCourse.innerHTML = state.courses.map((c) => `<option value="${c.clase}">${c.clase}</option>`).join('');
  manualDay.innerHTML = DAYS.map((d) => `<option value="${d}">${d}</option>`).join('');
  manualSlot.innerHTML = bloques.map((b) => `<option value="${b}">${b}</option>`).join('');
  manualRoom.innerHTML = aulas.map((a) => `<option value="${a}">${a}</option>`).join('');
  manualTeacher.innerHTML = docentes.map((d) => `<option value="${d}">${d}</option>`).join('');
};

const assignmentAt = (day, slot) => state.assignments.find((a) => a.dia === day && a.bloque === slot);

const renderSchedule = () => {
  const slots = getTimeSlots();
  const head = `
    <thead>
      <tr><th>Hora</th>${DAYS.map((d) => `<th class="day-col">${d}</th>`).join('')}</tr>
    </thead>
  `;

  const body = slots
    .map((slot) => {
      const cells = DAYS.map((day) => {
        const item = assignmentAt(day, slot);
        if (!item) return '<td class="cell-empty">—</td>';
        return `<td class="cell-filled">${item.clase}<br><small>${item.aula} · ${item.docente}</small></td>`;
      }).join('');
      return `<tr><td>${slot}</td>${cells}</tr>`;
    })
    .join('');

  scheduleTable.innerHTML = `${head}<tbody>${body}</tbody>`;
};

const renderTeachers = () => {
  teacherList.innerHTML = state.teachers.map((t) => `<li><strong>${t.nombre}</strong> · ${t.area}</li>`).join('');
};

const renderCareers = () => {
  careerList.innerHTML = state.careers.map((c) => `<li><strong>${c.coordinacion}</strong> → ${c.carrera}</li>`).join('');
};

const renderEnrollments = () => {
  enrollList.innerHTML = state.enrollments
    .map((e) => `<li>${e.carrera} · Semestre ${e.semestre} · ${e.estudiantes} estudiantes · ${e.grupos} grupos</li>`)
    .join('');
};

const saveManualAssignment = () => {
  const item = {
    clase: manualCourse.value,
    dia: manualDay.value,
    bloque: manualSlot.value,
    aula: manualRoom.value,
    docente: manualTeacher.value,
    observacion: manualNote.value.trim()
  };

  const conflict = state.assignments.find((a) => a.dia === item.dia && a.bloque === item.bloque && (a.docente === item.docente || a.aula === item.aula));
  if (conflict) {
    autoStatus.textContent = 'Conflicto detectado: aula o docente ocupado en ese bloque.';
    autoStatus.classList.add('warning');
    return;
  }

  state.assignments = state.assignments.filter((a) => !(a.dia === item.dia && a.bloque === item.bloque));
  state.assignments.push(item);
  autoStatus.textContent = `Asignación guardada: ${item.clase} (${item.dia} ${item.bloque}).`;
  logMessage(`Asignación manual guardada: ${item.clase} / ${item.dia} ${item.bloque}`);
  autoStatus.classList.remove('warning');
  renderSchedule();
};

const autoGenerate = () => {
  const slots = getTimeSlots();
  const maxSessions = Number(document.getElementById('auto-max').value) || 35;
  const allCells = DAYS.flatMap((day) => slots.map((slot) => ({ day, slot })));

  state.assignments = [];
  state.courses.forEach((course, index) => {
    const sessions = Math.max(1, Math.min(3, Math.round(course.creditos / 2)));
    for (let i = 0; i < sessions; i += 1) {
      const cell = allCells[(index * 2 + i) % allCells.length];
      if (!assignmentAt(cell.day, cell.slot)) {
        state.assignments.push({
          clase: course.clase,
          dia: cell.day,
          bloque: cell.slot,
          aula: course.aula,
          docente: course.docente,
          observacion: `Auto (${maxSessions} max/grupo)`
        });
      }
    }
  });

  autoStatus.textContent = `Horario generado automáticamente para ${state.courses.length} materias.`;
  logMessage(`Generación automática completada (${state.courses.length} materias).`);
  autoStatus.classList.remove('warning');
  renderSchedule();
};

const resetDemo = () => {
  state.assignments = [];
  autoStatus.textContent = 'Demo reiniciada. Sin asignaciones activas.';
  logMessage('Se reinició la demo.');
  autoStatus.classList.remove('warning');
  renderSchedule();
};

const importCSV = async () => {
  const file = csvInput.files?.[0];
  if (!file) {
    csvStatus.textContent = 'Selecciona un archivo CSV antes de importar.';
    return;
  }

  const text = await file.text();
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCSVLine)
    .filter((cols) => cols.length >= 4);

  if (!rows.length) {
    csvStatus.textContent = 'No se encontraron filas válidas. Usa: clase,creditos,docente,aula';
    return;
  }

  const hasHeader = /clase/i.test(rows[0][0]);
  const dataRows = hasHeader ? rows.slice(1) : rows;

  state.courses = dataRows.map(([clase, creditos, docente, aula]) => ({
    clase,
    creditos: Number(creditos) || 1,
    docente,
    aula,
    estado: 'Importado'
  }));

  csvStatus.textContent = `CSV importado: ${state.courses.length} materias cargadas.`;
  logMessage(`CSV importado correctamente (${state.courses.length} materias).`);
  renderCourses();
  renderManualSelectors();
  renderSchedule();
};

const calculateGroups = () => {
  const students = Number(enrollStudents.value) || 0;
  const max = Math.max(1, Number(enrollMax.value) || 35);
  enrollGroups.value = String(Math.ceil(students / max) || 0);
};

document.getElementById('btn-menu').addEventListener('click', () => {
  sidebar.classList.toggle('sidebar-open');
});

footerTabs.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => setActiveView(tab.dataset.tab));
});

btnImportCsv.addEventListener('click', importCSV);
btnSaveManual.addEventListener('click', saveManualAssignment);
btnClearManual.addEventListener('click', () => {
  manualNote.value = '';
  autoStatus.textContent = 'Formulario de asignación limpiado.';
});
btnAuto.addEventListener('click', autoGenerate);
btnReset.addEventListener('click', resetDemo);

cfgInicio.addEventListener('change', () => {
  renderManualSelectors();
  renderSchedule();
});
cfgFin.addEventListener('change', () => {
  renderManualSelectors();
  renderSchedule();
});
cfgBloque.addEventListener('change', () => {
  renderManualSelectors();
  renderSchedule();
});

btnAddTeacher.addEventListener('click', () => {
  const nombre = teacherName.value.trim();
  const area = teacherArea.value.trim() || 'General';
  if (!nombre) return;
  state.teachers.push({ nombre, area });
  teacherName.value = '';
  teacherArea.value = '';
  renderTeachers();
  renderManualSelectors();
  logMessage(`Docente agregado: ${nombre} (${area}).`);
});

btnAddCareer.addEventListener('click', () => {
  const coordinacion = coordName.value.trim();
  const carrera = careerName.value.trim();
  if (!coordinacion || !carrera) return;
  state.careers.push({ coordinacion, carrera });
  coordName.value = '';
  careerName.value = '';
  renderCareers();
  logMessage(`Carrera agregada: ${coordinacion} -> ${carrera}.`);
});

enrollStudents.addEventListener('input', calculateGroups);
enrollMax.addEventListener('input', calculateGroups);
btnSaveEnroll.addEventListener('click', () => {
  calculateGroups();
  state.enrollments.push({
    carrera: enrollCareer.value.trim() || 'Sin nombre',
    semestre: Number(enrollSemester.value) || 1,
    estudiantes: Number(enrollStudents.value) || 0,
    grupos: Number(enrollGroups.value) || 0
  });
  renderEnrollments();
  logMessage(`Matrícula guardada para ${enrollCareer.value.trim() || 'Sin nombre'}.`);
});

setActiveView('principal');
calculateGroups();
renderCourses();
renderTeachers();
renderCareers();
renderEnrollments();
renderManualSelectors();
renderSchedule();
logMessage('Interfaz iniciada.');
