import React, { useMemo, useState } from 'react';
import { apiRequest, patchJson, postJson } from '../../api/client';

const ROLE_OPTIONS = [
  ['Student', 'Estudiante'],
  ['Teacher', 'Profesor'],
  ['BranchDirector', 'Director de sede'],
  ['GeneralDirector', 'Director general'],
  ['Admin', 'Administrador'],
];

function roleLabel(role) {
  return ROLE_OPTIONS.find(([value]) => value === role)?.[1] || role;
}

function friendlyError(error, fallback) {
  const messages = {
    SELF_DEACTIVATION_FORBIDDEN:'No puedes desactivar tu propia cuenta.',
    SELF_ROLE_CHANGE_FORBIDDEN:'No puedes cambiar tu propio rol.',
    SELF_PASSWORD_RESET_FORBIDDEN:'Cambia tu propia contraseña desde tu cuenta.',
    LAST_ADMIN_REQUIRED:'Debe permanecer al menos un administrador activo.',
    STUDENT_PROFILE_REQUIRED:'La cuenta necesita un perfil de estudiante antes de recibir ese rol.',
    TEACHER_PROFILE_REQUIRED:'La cuenta necesita un perfil de profesor antes de recibir ese rol.',
    BRANCH_ACCESS_REQUIRED:'Asigna al menos una sede antes de usar el rol de director de sede.',
  };
  return messages[error?.code] || fallback;
}

export default function UserDirectoryPanel({ users, branches, currentUser, onOutput, onUserUpdated }) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [sortOrder, setSortOrder] = useState('newest');
  const [expandedId, setExpandedId] = useState('');
  const [roleDrafts, setRoleDrafts] = useState({});
  const [accessDrafts, setAccessDrafts] = useState({});
  const [busy, setBusy] = useState('');
  const [deliveryNotice, setDeliveryNotice] = useState(null);

  const visibleUsers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es');
    return [...users]
      .filter((user) => roleFilter === 'all' || user.role === roleFilter)
      .filter((user) => statusFilter === 'all' || (statusFilter === 'active' ? user.active !== false : user.active === false))
      .filter((user) => !normalized || `${user.name} ${user.email}`.toLocaleLowerCase('es').includes(normalized))
      .sort((left, right) => {
        const leftDate = new Date(left.createdAt || 0).getTime();
        const rightDate = new Date(right.createdAt || 0).getTime();
        if (leftDate !== rightDate) return sortOrder === 'newest' ? rightDate - leftDate : leftDate - rightDate;
        return left.name.localeCompare(right.name, 'es');
      });
  }, [query, roleFilter, sortOrder, statusFilter, users]);

  async function toggleDetails(user) {
    if (expandedId === user.id) {
      setExpandedId('');
      return;
    }
    setExpandedId(user.id);
    setRoleDrafts((current) => ({ ...current, [user.id]:user.role }));
    setDeliveryNotice(null);
    if (user.role !== 'BranchDirector' || accessDrafts[user.id]) return;
    setBusy(`access-${user.id}`);
    try {
      const payload = await apiRequest(`/users/${user.id}/branch-access`);
      setAccessDrafts((current) => ({ ...current, [user.id]:payload.data.map((row) => row.branchId) }));
    } catch (error) {
      onOutput({ success:false, message:friendlyError(error, 'No se pudieron cargar las sedes asignadas.') });
    } finally {
      setBusy('');
    }
  }

  async function saveRole(user) {
    const role = roleDrafts[user.id] || user.role;
    if (role === user.role || busy) return;
    setBusy(`role-${user.id}`);
    try {
      const payload = await patchJson(`/users/${user.id}/role`, { role });
      onUserUpdated(payload.data);
      onOutput({ success:true, message:`El rol de ${user.name} fue actualizado.` });
    } catch (error) {
      onOutput({ success:false, message:friendlyError(error, 'No se pudo actualizar el rol de esta cuenta.') });
    } finally {
      setBusy('');
    }
  }

  async function toggleStatus(user) {
    if (busy) return;
    const active = user.active === false;
    setBusy(`status-${user.id}`);
    try {
      const payload = await patchJson(`/users/${user.id}/status`, { active });
      onUserUpdated(payload.data);
      onOutput({ success:true, message:active ? 'La cuenta fue activada.' : 'La cuenta fue desactivada y sus sesiones se cerraron.' });
    } catch (error) {
      onOutput({ success:false, message:friendlyError(error, 'No se pudo actualizar el estado de la cuenta.') });
    } finally {
      setBusy('');
    }
  }

  async function resetPassword(user) {
    if (busy) return;
    setBusy(`password-${user.id}`);
    setDeliveryNotice(null);
    try {
      const payload = await postJson(`/users/${user.id}/reset-password`, {});
      onUserUpdated(payload.data.user);
      setDeliveryNotice({ userId:user.id, email:payload.data.user.email });
      onOutput({ success:true, message:`La nueva clave temporal fue enviada a ${payload.data.user.email}.` });
    } catch (error) {
      onOutput({ success:false, message:friendlyError(error, 'No se pudo restablecer la contraseña.') });
    } finally {
      setBusy('');
    }
  }

  async function resendInvitation(user) {
    if (busy) return;
    setBusy(`invitation-${user.id}`);
    setDeliveryNotice(null);
    try {
      const payload = await postJson(`/users/${user.id}/resend-invitation`, {});
      onUserUpdated(payload.data.user);
      setDeliveryNotice({ userId:user.id, email:payload.data.user.email });
      onOutput({ success:true, message:`La invitación fue enviada nuevamente a ${payload.data.user.email}.` });
    } catch (error) {
      onOutput({ success:false, message:friendlyError(error, 'No se pudo reenviar la invitación.') });
    } finally {
      setBusy('');
    }
  }

  function toggleBranch(userId, branchId) {
    setAccessDrafts((current) => {
      const selected = new Set(current[userId] || []);
      if (selected.has(branchId)) selected.delete(branchId);
      else selected.add(branchId);
      return { ...current, [userId]:[...selected] };
    });
  }

  async function saveBranches(user) {
    const branchIds = accessDrafts[user.id] || [];
    if (!branchIds.length || busy) {
      onOutput({ success:false, message:'Selecciona al menos una sede para este director.' });
      return;
    }
    setBusy(`branches-${user.id}`);
    try {
      await patchJson(`/users/${user.id}/branch-access`, { branchIds });
      onOutput({ success:true, message:`Las sedes de ${user.name} fueron actualizadas.` });
    } catch (error) {
      onOutput({ success:false, message:friendlyError(error, 'No se pudieron actualizar las sedes asignadas.') });
    } finally {
      setBusy('');
    }
  }

  const isAdmin = currentUser?.role === 'Admin';
  const isGeneralDirector = currentUser?.role === 'GeneralDirector';

  return (
    <section className="academic-panel user-directory" aria-labelledby="user-directory-title">
      <div className="section-title-row">
        <div><p className="eyebrow">Directorio</p><h2 id="user-directory-title">Cuentas registradas</h2><p>Busca personas, revisa su acceso y administra cambios sensibles desde un solo lugar.</p></div>
        <span className="count-badge">{visibleUsers.length}</span>
      </div>
      <div className="user-directory-filters">
        <label>Buscar<input type="search" value={query} maxLength="80" placeholder="Nombre o correo" onChange={(event) => setQuery(event.target.value)} /></label>
        <label>Rol<select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="all">Todos</option>{ROLE_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Estado<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="active">Activas</option><option value="inactive">Inactivas</option><option value="all">Todas</option></select></label>
        <label>Orden<select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}><option value="newest">Más recientes primero</option><option value="oldest">Más antiguas primero</option></select></label>
      </div>
      <div className="table-scroll">
        <table className="data-table user-directory-table">
          <thead><tr><th>Persona</th><th>Rol</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody>{visibleUsers.map((user) => (
            <React.Fragment key={user.id}>
              <tr><td><strong>{user.name}</strong><span>{user.email}</span></td><td>{roleLabel(user.role)}</td><td><span className={`status-chip ${user.active === false ? 'error' : 'success'}`}>{user.active === false ? 'Inactiva' : user.mustChangePassword ? 'Cambio de clave pendiente' : 'Activa'}</span></td><td><button type="button" className="secondary-action" aria-expanded={expandedId === user.id} onClick={() => toggleDetails(user)}>{expandedId === user.id ? 'Cerrar' : 'Gestionar'}</button></td></tr>
              {expandedId === user.id && <tr className="user-detail-row"><td colSpan="4"><div className="user-detail-grid">
                {isAdmin && <section><h3>Rol y estado</h3><label>Rol<select value={roleDrafts[user.id] || user.role} disabled={user.id === currentUser.id || busy.startsWith('role-')} onChange={(event) => setRoleDrafts((current) => ({ ...current, [user.id]:event.target.value }))}>{ROLE_OPTIONS.filter(([value]) => value !== 'BranchDirector' || user.role === 'BranchDirector').map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><div className="button-row responsive-actions"><button type="button" onClick={() => saveRole(user)} disabled={busy === `role-${user.id}` || (roleDrafts[user.id] || user.role) === user.role}>Guardar rol</button><button type="button" className="secondary-action danger-action" onClick={() => toggleStatus(user)} disabled={user.id === currentUser.id || busy === `status-${user.id}`}>{user.active === false ? 'Activar cuenta' : 'Desactivar cuenta'}</button></div></section>}
                {user.role === 'BranchDirector' && <section><h3>Sedes asignadas</h3>{busy === `access-${user.id}` ? <p>Cargando sedes...</p> : <fieldset className="branch-checkbox-list"><legend className="sr-only">Sedes disponibles</legend>{branches.map((branch) => <label key={branch.id}><input type="checkbox" checked={(accessDrafts[user.id] || []).includes(branch.id)} onChange={() => toggleBranch(user.id, branch.id)} /><span>{branch.name}</span></label>)}</fieldset>}<button type="button" onClick={() => saveBranches(user)} disabled={busy === `branches-${user.id}`}>Guardar sedes</button></section>}
                {isGeneralDirector && <section><h3>Invitación de acceso</h3><p>Genera una nueva clave temporal y la envía únicamente al correo registrado.</p><button type="button" className="secondary-action" onClick={() => resendInvitation(user)} disabled={user.id === currentUser.id || busy === `invitation-${user.id}`}>Reenviar invitación</button>{deliveryNotice?.userId === user.id && <div className="delivery-confirmation compact"><span className="delivery-confirmation-mark" aria-hidden="true">✓</span><div><strong>Correo enviado</strong><p>La invitación fue enviada a {deliveryNotice.email}.</p></div></div>}</section>}
                {isAdmin && <section><h3>Recuperación de acceso</h3><p>Envía una nueva clave temporal al correo asociado, cierra las sesiones anteriores y exige un cambio en el próximo ingreso.</p><button type="button" className="secondary-action" onClick={() => resetPassword(user)} disabled={user.id === currentUser.id || busy === `password-${user.id}`}>Enviar nueva clave</button>{deliveryNotice?.userId === user.id && <div className="delivery-confirmation compact"><span className="delivery-confirmation-mark" aria-hidden="true">✓</span><div><strong>Correo enviado</strong><p>La nueva clave temporal fue enviada a {deliveryNotice.email}.</p></div></div>}</section>}
              </div></td></tr>}
            </React.Fragment>
          ))}</tbody>
        </table>
      </div>
      {!visibleUsers.length && <p className="empty-state">No hay cuentas que coincidan con los filtros.</p>}
    </section>
  );
}
