import React, { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api/client';

const ATTENDANCE_STATUSES = [
  ['present', 'Presente'],
  ['late', 'Atraso'],
  ['absent', 'Ausente'],
  ['justified', 'Ausencia justificada'],
];

const PAYMENT_STATUSES = [
  ['paid', 'Cobrado'],
  ['pending', 'Pendiente'],
  ['overdue', 'Vencido'],
  ['cancelled', 'Cancelado'],
];

function academyDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-EC', { timeZone:'America/Guayaquil', dateStyle:'medium' }).format(date);
}

function academyDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-EC', {
    timeZone:'America/Guayaquil',
    dateStyle:'medium',
    timeStyle:'short',
  }).format(date);
}

function academyDateInput(value = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone:'America/Guayaquil',
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
  });
  return formatter.format(new Date(value));
}

function formatMoney(value) {
  return new Intl.NumberFormat('es-EC', { style:'currency', currency:'USD' }).format(Number(value || 0));
}

function readableError(error, fallback) {
  return error?.message || fallback;
}

function escapeCsv(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadCsv(filename, columns, rows) {
  const content = [
    columns.map(([label]) => escapeCsv(label)).join(','),
    ...rows.map((row) => columns.map(([, key]) => escapeCsv(row[key])).join(',')),
  ].join('\n');
  const blob = new Blob([`\uFEFF${content}`], { type:'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ReportMetricList({ report }) {
  const totals = report?.totals || report?.branch || {};
  const value = (key, formatter = (item) => item) => (
    totals[key] === undefined || totals[key] === null ? '—' : formatter(totals[key])
  );
  const metrics = [
    [value('totalIncome', formatMoney), 'Ingreso total'],
    [value('tuitionIncome', formatMoney), 'Mensualidades'],
    [value('showIncome', formatMoney), 'Shows y eventos'],
    [value('pendingAmount', formatMoney), 'Cartera pendiente'],
    [value('overdueAmount', formatMoney), 'Cartera vencida'],
    [value('activeStudents'), 'Alumnos activos'],
    [value('retiredStudents'), 'Retirados'],
    [value('attendanceRate', (item) => `${item}%`), 'Asistencia ajustada'],
    [value('rawAttendanceRate', (item) => `${item}%`), 'Asistencia física'],
    [totals.b1Students === undefined && totals.b2Students === undefined ? '—' : `${totals.b1Students || 0} / ${totals.b2Students || 0}`, 'B1 / B2'],
    [value('occupancyRate', (item) => `${item}%`), 'Ocupación'],
  ];
  return <div className="report-metrics">{metrics.map(([metricValue, label]) => <div key={label}><strong>{metricValue}</strong><span>{label}</span></div>)}</div>;
}

function AccessibleBarChart({ title, items, valueFormatter = (value) => String(value) }) {
  const safeItems = items.filter((item) => Number.isFinite(Number(item.value))).slice(0, 10);
  if (!safeItems.length) return <p className="empty-state">No hay datos suficientes para esta gráfica.</p>;
  const max = Math.max(...safeItems.map((item) => Number(item.value)), 1);
  const height = 42 + safeItems.length * 38;
  return (
    <div className="accessible-chart">
      <svg viewBox={`0 0 680 ${height}`} role="img" aria-label={title}>
        <title>{title}</title>
        {safeItems.map((item, index) => {
          const y = 28 + index * 38;
          const width = Math.max((Number(item.value) / max) * 390, Number(item.value) ? 3 : 0);
          return <g key={`${item.label}-${index}`}><text x="0" y={y + 15}>{String(item.label).slice(0, 24)}</text><rect x="190" y={y} width="390" height="22" rx="3" className="chart-track" /><rect x="190" y={y} width={width} height="22" rx="3" className="chart-bar"><title>{item.label}: {valueFormatter(item.value)}</title></rect><text x="590" y={y + 15} className="chart-value">{valueFormatter(item.value)}</text></g>;
        })}
      </svg>
      <details className="chart-data-fallback"><summary>Ver datos de la gráfica</summary><table><thead><tr><th>Elemento</th><th>Valor</th></tr></thead><tbody>{safeItems.map((item) => <tr key={item.label}><td>{item.label}</td><td>{valueFormatter(item.value)}</td></tr>)}</tbody></table></details>
    </div>
  );
}

function ReportVisuals({ report }) {
  const branches = Array.isArray(report?.branches) ? report.branches : [];
  const attendanceTrend = Array.isArray(report?.trends)
    ? report.trends.map((item) => ({ label:item.period, value:Number(item.attendanceRate || 0) }))
    : [];
  const alerts = Array.isArray(report?.qualityAlerts) ? report.qualityAlerts : [];
  return (
    <>
      {(branches.length || attendanceTrend.length) && <div className="report-chart-grid">
        {!!branches.length && <section className="chart-card"><h3>Asistencia por sede</h3><AccessibleBarChart title="Porcentaje de asistencia por sede" items={branches.map((branch) => ({ label:branch.name, value:Number(branch.attendanceRate || 0) }))} valueFormatter={(value) => `${value}%`} /></section>}
        {!!branches.length && <section className="chart-card"><h3>Ingresos por sede</h3><AccessibleBarChart title="Ingreso total por sede" items={branches.map((branch) => ({ label:branch.name, value:Number(branch.totalIncome || 0) }))} valueFormatter={formatMoney} /></section>}
        {!!attendanceTrend.length && <section className="chart-card"><h3>Tendencia de asistencia</h3><AccessibleBarChart title="Asistencia por mes" items={attendanceTrend} valueFormatter={(value) => `${value}%`} /></section>}
      </div>}
      {!!alerts.length && <section className="quality-alerts" aria-labelledby="quality-alerts-title"><h3 id="quality-alerts-title">Alertas que requieren atención</h3><ul>{alerts.map((alert, index) => <li key={alert.id || alert.code || index} data-severity={alert.severity || 'medium'}><strong>{alert.title || alert.type || 'Alerta operativa'}{alert.count ? ` · ${alert.count}` : ''}</strong><span>{alert.message || alert.description || String(alert)}</span></li>)}</ul></section>}
    </>
  );
}

function AttendanceTable({ title, description, rows }) {
  return (
    <section className="report-table-section">
      <div className="section-title-row"><div><h3>{title}</h3><p>{description}</p></div><span className="count-badge">{rows.length}</span></div>
      {rows.length ? <div className="table-scroll"><table className="report-table"><thead><tr><th>Nombre</th><th>Sede</th><th>Nivel</th><th>Sesiones</th><th>Presentes</th><th>Atrasos</th><th>Ausencias</th><th>Justificadas</th><th>Asistencia</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.branchName || '—'}</td><td>{row.level || '—'}</td><td>{row.totalSessions}</td><td>{row.presentSessions}</td><td>{row.lateSessions}</td><td>{row.absentSessions}</td><td>{row.excusedAbsences}</td><td>{row.attendanceRate}%</td></tr>)}</tbody></table></div> : <p className="empty-state">No existen registros para los filtros aplicados.</p>}
    </section>
  );
}

function AttendanceReport({ report, view }) {
  const totals = report.totals || {};
  return (
    <div className="attendance-report-view">
      {view === 'students' && <div className="report-metrics attendance-report-metrics">
        <div><strong>{totals.students ?? 0}</strong><span>Estudiantes</span></div>
        <div><strong>{totals.classGroups ?? 0}</strong><span>Grupos</span></div>
        <div><strong>{totals.totalSessions ?? 0}</strong><span>Registros</span></div>
        <div><strong>{totals.rawAttendanceRate ?? 0}%</strong><span>Asistencia física</span></div>
        <div><strong>{totals.attendanceRate ?? 0}%</strong><span>Asistencia ajustada</span></div>
        <div><strong>{totals.excusedAbsences ?? 0}</strong><span>Justificadas</span></div>
      </div>}
      {view === 'students' && <AttendanceTable title="Asistencia por estudiante" description="Seguimiento individual para detectar atrasos y riesgo de deserción." rows={report.byStudent || []} />}
      {view === 'classes' && <AttendanceTable title="Asistencia por clase" description="Compara la participación de cada grupo y ritmo." rows={report.byClassGroup || []} />}
      {view === 'branches' && <AttendanceTable title="Asistencia por sede" description="Vista consolidada para dirección general." rows={report.byBranch || []} />}
      {view === 'records' && <section className="report-table-section">
        <div className="section-title-row"><div><h3>Detalle de registros</h3><p>Evidencia de cada estudiante y sesión finalizada.</p></div><span className="count-badge">{report.records?.length || 0}</span></div>
        {report.records?.length ? <div className="table-scroll"><table className="report-table"><thead><tr><th>Fecha</th><th>Estudiante</th><th>Clase</th><th>Sede</th><th>Nivel</th><th>Estado</th></tr></thead><tbody>{report.records.map((row) => <tr key={row.id}><td>{academyDateTime(row.sessionStartsAt)}</td><td>{row.studentName}</td><td>{row.classGroupName}</td><td>{row.branchName}</td><td>{row.level}</td><td><span className={`status-chip attendance-${row.status}`}>{row.justified && row.status === 'absent' ? 'Ausencia justificada' : ATTENDANCE_STATUSES.find(([value]) => value === row.status)?.[1] || row.status}</span></td></tr>)}</tbody></table></div> : <p className="empty-state">No existen registros para los filtros aplicados.</p>}
      </section>}
    </div>
  );
}

function FinancialReport({ report, view }) {
  const branches = report.branches?.length ? report.branches : report.branch ? [report.branch] : [];
  if (view === 'summary') return <ReportMetricList report={report} />;
  if (view === 'branches') return <section className="report-table-section"><div className="section-title-row"><div><h3>Resultados financieros por sede</h3><p>Compara mensualidades, shows y total recibido durante el periodo.</p></div><span className="count-badge">{branches.length}</span></div>{branches.length ? <><AccessibleBarChart title="Ingreso total por sede" items={branches.map((branch) => ({ label:branch.name, value:Number(branch.totalIncome || 0) }))} valueFormatter={formatMoney} /><div className="table-scroll"><table className="report-table"><thead><tr><th>Sede</th><th>Mensualidades</th><th>Shows</th><th>Total</th></tr></thead><tbody>{branches.map((branch) => <tr key={branch.id || branch.name}><td><strong>{branch.name}</strong></td><td>{formatMoney(branch.tuitionIncome)}</td><td>{formatMoney(branch.showIncome)}</td><td>{formatMoney(branch.totalIncome)}</td></tr>)}</tbody></table></div></> : <p className="empty-state">No hay sedes con movimientos en este periodo.</p>}</section>;
  if (view === 'receivables') return <section className="report-table-section"><div className="section-title-row"><div><h3>Cartera pendiente y vencida</h3><p>Valores que requieren seguimiento de cobro por sede.</p></div><span className="count-badge">{branches.length}</span></div>{branches.length ? <div className="table-scroll"><table className="report-table"><thead><tr><th>Sede</th><th>Pendiente</th><th>Vencido</th><th>Total por cobrar</th></tr></thead><tbody>{branches.map((branch) => <tr key={branch.id || branch.name}><td><strong>{branch.name}</strong></td><td>{formatMoney(branch.pendingAmount)}</td><td>{formatMoney(branch.overdueAmount)}</td><td>{formatMoney(Number(branch.pendingAmount || 0) + Number(branch.overdueAmount || 0))}</td></tr>)}</tbody></table></div> : <p className="empty-state">No hay cartera visible en este periodo.</p>}</section>;
  const alerts = report.qualityAlerts || [];
  return <section className="quality-alerts"><h3>Alertas financieras y operativas</h3>{alerts.length ? <ul>{alerts.map((alert, index) => <li key={alert.id || alert.code || index} data-severity={alert.severity || 'medium'}><strong>{alert.title || alert.type || 'Alerta'}{alert.count ? ` · ${alert.count}` : ''}</strong><span>{alert.message || alert.description || String(alert)}</span></li>)}</ul> : <p className="empty-state">No hay alertas para los filtros aplicados.</p>}</section>;
}

function exportOverview(report, dateRange) {
  const rows = report.branches?.length ? report.branches : report.branch ? [report.branch] : [];
  downloadCsv(`reporte-general-${dateRange.from}-${dateRange.to}.csv`, [
    ['Sede', 'name'], ['Alumnos activos', 'activeStudents'], ['Retirados', 'retiredStudents'],
    ['Asistencia física (%)', 'rawAttendanceRate'], ['Asistencia ajustada (%)', 'attendanceRate'],
    ['Mensualidades', 'tuitionIncome'], ['Shows', 'showIncome'], ['Ingreso total', 'totalIncome'],
    ['Pendiente', 'pendingAmount'], ['Vencido', 'overdueAmount'],
  ], rows);
}

function exportAttendance(report, dateRange) {
  downloadCsv(`reporte-asistencia-${dateRange.from}-${dateRange.to}.csv`, [
    ['Fecha', 'sessionStartsAt'], ['Estudiante', 'studentName'], ['Clase', 'classGroupName'],
    ['Sede', 'branchName'], ['Nivel', 'level'], ['Estado', 'status'], ['Justificada', 'justified'],
  ], report.records || []);
}

export default function ReportsPanel({ data, role, onOutput }) {
  const canUseGeneralReport = ['Admin', 'GeneralDirector'].includes(role);
  const today = academyDateInput();
  const thirtyDaysAgo = academyDateInput(new Date(Date.now() - 29 * 86400000));
  const [section, setSection] = useState('index');
  const [topic, setTopic] = useState('summary');
  const [reportMode, setReportMode] = useState(canUseGeneralReport ? 'general' : 'branch');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [dateRange, setDateRange] = useState({ from:thirtyDaysAgo, to:today });
  const [appliedRange, setAppliedRange] = useState({ from:thirtyDaysAgo, to:today });
  const [filters, setFilters] = useState({ branchId:'', studentId:'', classGroupId:'', level:'', paymentStatus:'', attendanceStatus:'', search:'' });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const initialLoadStarted = useRef(false);

  useEffect(() => {
    if (!selectedBranchId && data.branches.length) setSelectedBranchId(data.branches[0].id);
  }, [selectedBranchId, data.branches]);

  useEffect(() => {
    const branchReady = reportMode !== 'branch' || selectedBranchId || data.branches[0]?.id;
    if (section !== 'index' && !initialLoadStarted.current && branchReady) {
      initialLoadStarted.current = true;
      loadReport({ branchIdOverride:selectedBranchId || data.branches[0]?.id, announce:false });
    }
  }, [section, selectedBranchId, data.branches]);

  async function loadReport({
    sectionOverride = section,
    modeOverride = reportMode,
    rangeOverride = appliedRange,
    filtersOverride = appliedFilters,
    branchIdOverride = selectedBranchId,
    announce = true,
  } = {}) {
    const branchId = branchIdOverride || data.branches[0]?.id;
    if (sectionOverride === 'overview' && (modeOverride === 'branch' || !canUseGeneralReport) && !branchId) {
      setReportError('No hay una sede disponible para generar el reporte.');
      return;
    }
    setReport(null);
    setReportError('');
    setLoading(true);
    try {
      const basePath = sectionOverride === 'attendance'
        ? '/reports/attendance'
        : modeOverride === 'branch' || !canUseGeneralReport
          ? `/reports/branches/${branchId}/detail`
          : '/reports/general';
      const query = new URLSearchParams({
        from:`${rangeOverride.from}T00:00:00-05:00`,
        to:`${rangeOverride.to}T23:59:59-05:00`,
      });
      const relevantFilters = sectionOverride === 'attendance'
        ? ['branchId', 'studentId', 'classGroupId', 'level', 'attendanceStatus', 'search']
        : ['level', 'paymentStatus'];
      for (const key of relevantFilters) if (filtersOverride[key]) query.set(key, filtersOverride[key]);
      const payload = await apiRequest(`${basePath}?${query}`);
      setReport(payload.data);
      if (announce) onOutput({ success:true, message:sectionOverride === 'attendance' ? 'Reporte de asistencia actualizado.' : 'Reporte directivo actualizado.' });
    } catch (error) {
      const message = readableError(error, 'No se pudo cargar el reporte. Revisa los filtros e intenta nuevamente.');
      setReportError(message);
      if (announce) onOutput({ success:false, message });
    } finally {
      setLoading(false);
    }
  }

  function switchSection(nextSection) {
    setSection(nextSection);
    setTopic(nextSection === 'attendance' ? 'students' : 'summary');
    initialLoadStarted.current = true;
    loadReport({ sectionOverride:nextSection, announce:false });
  }

  function switchMode(mode) {
    setReportMode(mode);
    loadReport({ modeOverride:mode, branchIdOverride:selectedBranchId || data.branches[0]?.id, announce:false });
  }

  function applyFilters(event) {
    event.preventDefault();
    if (!dateRange.from || !dateRange.to || dateRange.from > dateRange.to) {
      setReportError('La fecha inicial debe ser anterior o igual a la fecha final.');
      return;
    }
    setAppliedRange(dateRange);
    setAppliedFilters(filters);
    loadReport({ rangeOverride:dateRange, filtersOverride:filters });
  }

  const visibleStudents = data.students.filter((student) => (
    (!filters.branchId || student.branchId === filters.branchId)
    && (!filters.level || student.level === filters.level)
  ));
  const visibleGroups = data.classGroups.filter((group) => (
    (!filters.branchId || group.branchId === filters.branchId)
    && (!filters.level || group.level === filters.level)
  ));

  const financialTopics = [
    ['summary', 'Resumen financiero', 'Indicadores generales de ingresos, cartera y estudiantes.'],
    ['branches', 'Ingresos por sede', 'Mensualidades, shows y total recibido en cada sede.'],
    ['receivables', 'Cartera por cobrar', 'Valores pendientes y vencidos que requieren seguimiento.'],
    ['alerts', 'Alertas directivas', 'Situaciones financieras y operativas que requieren decisión.'],
  ];
  const attendanceTopics = [
    ['students', 'Por estudiante', 'Seguimiento individual de presencia, atrasos y ausencias.'],
    ['classes', 'Por clase', 'Comparación entre grupos, ritmos y sesiones.'],
    ['branches', 'Por sede', 'Consolidado de asistencia para toda la academia.'],
    ['records', 'Registros detallados', 'Evidencia de cada estudiante y sesión finalizada.'],
  ];
  const currentTopics = section === 'attendance' ? attendanceTopics : financialTopics;

  return (
    <div className="academic-panel reports-panel" aria-busy={loading}>
      <div className="section-title-row"><div><p className="eyebrow">Reportes</p><h2>{section === 'index' ? 'Centro de reportes' : section === 'attendance' ? 'Asistencia académica' : reportMode === 'branch' ? 'Resultados financieros por sede' : 'Resultados financieros generales'}</h2><p>{section === 'index' ? 'Selecciona primero el tipo de información que necesitas revisar.' : 'Aplica filtros, revisa un subtema y exporta la evidencia del periodo.'}</p></div>{report && section !== 'index' && <div className="report-export-actions"><button type="button" onClick={() => section === 'attendance' ? exportAttendance(report, appliedRange) : exportOverview(report, appliedRange)}>Exportar CSV</button><button type="button" className="secondary-action" onClick={() => window.print()}>Imprimir / PDF</button></div>}</div>

      {section === 'index' ? <div className="report-index-grid"><button type="button" onClick={() => switchSection('overview')}><span className="report-index-number">01</span><strong>Reporte financiero</strong><small>Ingresos, mensualidades, shows, cartera y resultados por sede.</small></button><button type="button" onClick={() => switchSection('attendance')}><span className="report-index-number">02</span><strong>Reporte de asistencia</strong><small>Seguimiento por estudiante, clase, sede y registro individual.</small></button></div> : <>
      <button type="button" className="report-back-button secondary-action" onClick={() => { setSection('index'); setReport(null); initialLoadStarted.current = false; }}>Volver al índice de reportes</button>
      <div className="report-topic-grid" aria-label="Subtemas del reporte">{currentTopics.map(([value, label, description]) => <button key={value} type="button" aria-pressed={topic === value} className={topic === value ? 'active' : ''} onClick={() => setTopic(value)}><strong>{label}</strong><small>{description}</small></button>)}</div>

      {section === 'overview' && <div className="report-controls">
        {canUseGeneralReport && <button type="button" aria-pressed={reportMode === 'general'} className={reportMode === 'general' ? '' : 'secondary-action'} onClick={() => switchMode('general')}>Todas las sedes</button>}
        <button type="button" aria-pressed={reportMode === 'branch'} className={reportMode === 'branch' ? '' : 'secondary-action'} onClick={() => switchMode('branch')}>Una sede</button>
        {reportMode === 'branch' && <label>Sede<select value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)}>{data.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>}
      </div>}

      <form className="report-filter-form expanded-report-filters" onSubmit={applyFilters}>
        <label>Desde<input type="date" value={dateRange.from} max={dateRange.to || today} onChange={(event) => setDateRange((current) => ({ ...current, from:event.target.value }))} required /></label>
        <label>Hasta<input type="date" value={dateRange.to} min={dateRange.from} max={today} onChange={(event) => setDateRange((current) => ({ ...current, to:event.target.value }))} required /></label>
        <label>Nivel<select value={filters.level} onChange={(event) => setFilters((current) => ({ ...current, level:event.target.value, studentId:'', classGroupId:'' }))}><option value="">Todos</option><option value="B1">B1</option><option value="B2">B2</option></select></label>
        {section === 'overview' ? <label>Estado de pago<select value={filters.paymentStatus} onChange={(event) => setFilters((current) => ({ ...current, paymentStatus:event.target.value }))}><option value="">Todos</option>{PAYMENT_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : <>
          <label>Sede<select value={filters.branchId} onChange={(event) => setFilters((current) => ({ ...current, branchId:event.target.value, studentId:'', classGroupId:'' }))}><option value="">Todas las disponibles</option>{data.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <label>Estudiante<select value={filters.studentId} onChange={(event) => setFilters((current) => ({ ...current, studentId:event.target.value }))}><option value="">Todos</option>{visibleStudents.map((student) => <option key={student.id} value={student.id}>{student.fullName}</option>)}</select></label>
          <label>Grupo<select value={filters.classGroupId} onChange={(event) => setFilters((current) => ({ ...current, classGroupId:event.target.value }))}><option value="">Todos</option>{visibleGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
          <label>Estado<select value={filters.attendanceStatus} onChange={(event) => setFilters((current) => ({ ...current, attendanceStatus:event.target.value }))}><option value="">Todos</option>{ATTENDANCE_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Buscar estudiante<input value={filters.search} maxLength="80" placeholder="Nombre o apellido" onChange={(event) => setFilters((current) => ({ ...current, search:event.target.value }))} /></label>
        </>}
        <button type="submit" disabled={loading}>{loading ? 'Generando...' : 'Aplicar filtros'}</button>
      </form>

      <p className="report-period">Periodo: {academyDate(`${appliedRange.from}T12:00:00-05:00`)} — {academyDate(`${appliedRange.to}T12:00:00-05:00`)}</p>
      {loading && <div className="loading-state" role="status">Calculando indicadores del periodo...</div>}
      {reportError && <div className="inline-alert error" role="alert"><strong>Reporte no disponible</strong><span>{reportError}</span></div>}
      {report && <><div className="report-freshness"><span>Actualizado</span><strong>{academyDateTime(report.generatedAt)}</strong></div>{section === 'attendance' ? <AttendanceReport report={report} view={topic} /> : <FinancialReport report={report} view={topic} />}</>}
      </>}
    </div>
  );
}
