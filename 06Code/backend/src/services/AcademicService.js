const crypto = require('crypto');
const { AppError } = require('../exceptions/AppError');
const { withRequestAuditContext } = require('../utils/requestAuditContext');
const { hashPassword } = require('../utils/passwordHasher');
const { Roles } = require('../models/constants');

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function generateTemporaryPassword() {
  return `ALC-${crypto.randomBytes(6).toString('base64url')}1`;
}

function normalizeBranchName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function sameInstant(left, right) {
  if (!left || !right) return false;
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  return !Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime === rightTime;
}

function safeEvidenceName(value) {
  const basename = String(value || 'evidencia').split(/[\\/]/).pop();
  const cleaned = basename.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (cleaned || 'evidencia').slice(0, 180);
}

function detectEvidenceMime(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return null;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  return null;
}

function validatedEvidence(file) {
  if (!file) return {};
  const detectedMime = detectEvidenceMime(file.buffer);
  if (!detectedMime || detectedMime !== file.mimetype) {
    throw new AppError('El contenido no corresponde a una imagen JPG, PNG o WebP, ni a un documento PDF valido.', 422, {
      code:'INVALID_EVIDENCE_FILE',
    });
  }
  return {
    evidenceFileName:safeEvidenceName(file.originalname),
    evidenceMimeType:detectedMime,
    evidenceSize:file.size,
    evidenceData:file.buffer,
    evidenceUrl:null,
  };
}

function publicJustification(row) {
  if (!row) return null;
  const { evidenceData, evidenceUrl, ...safe } = row;
  const hasEvidence = Boolean(evidenceData && evidenceData.length);
  return {
    ...safe,
    hasEvidence,
    evidenceUrl:hasEvidence ? `/api/v1/absence-justifications/${row.id}/evidence` : null,
  };
}

class AcademicService {
  constructor(db, auditService, rulesService, accessPolicy = null, cacheService = null, emailService = null) {
    this.db = db;
    this.audit = auditService;
    this.rules = rulesService;
    this.accessPolicy = accessPolicy;
    this.cacheService = cacheService;
    this.emailService = emailService;
  }

  async inTransaction(work) {
    return this.db.transaction ? this.db.transaction(work) : work(this.db);
  }

  policyFor(db) {
    return db && this.accessPolicy ? new this.accessPolicy.constructor(db) : this.accessPolicy;
  }

  async submitEnrollmentRequest(data) {
    const request = {
      ...data,
      email:String(data.email || '').trim().toLowerCase(),
      fullName:String(data.fullName || '').trim(),
      status:'pending',
    };
    if (request.branchId) {
      const branch = await this.db.branches.findById(request.branchId);
      if (!branch) throw new AppError('Branch not found', 404);
      if (branch.active === false) throw new AppError('This branch is not accepting enrollment requests', 422, { code:'BRANCH_INACTIVE' });
    }
    if (!request.branchId && request.preferredBranch) {
      const branches = await this.db.branches.all();
      const preferred = normalizeBranchName(request.preferredBranch);
      const branch = branches.find((item) => normalizeBranchName(item.name) === preferred);
      if (branch) request.branchId = branch.id;
    }
    const duplicateWindow = Date.now() - 24 * 60 * 60 * 1000;
    const duplicate = (await this.db.enrollmentRequests.all()).find((item) => (
      String(item.email || '').trim().toLowerCase() === request.email
      && (item.branchId || null) === (request.branchId || null)
      && ['pending', 'contacted', 'trial_scheduled'].includes(item.status || 'pending')
      && new Date(item.createdAt || 0).getTime() >= duplicateWindow
    ));
    if (duplicate) {
      throw new AppError('An active enrollment request already exists for this email and branch', 409, {
        code:'DUPLICATE_ENROLLMENT_REQUEST',
      });
    }
    const created = await this.inTransaction(async (db) => {
      const concurrentDuplicate = (await db.enrollmentRequests.all()).find((item) => (
        String(item.email || '').trim().toLowerCase() === request.email
        && (item.branchId || null) === (request.branchId || null)
        && ['pending', 'contacted', 'trial_scheduled'].includes(item.status || 'pending')
        && new Date(item.createdAt || 0).getTime() >= duplicateWindow
      ));
      if (concurrentDuplicate) throw new AppError('An active enrollment request already exists for this email and branch', 409, { code:'DUPLICATE_ENROLLMENT_REQUEST' });
      const row = await db.enrollmentRequests.create(request);
      await db.auditLogs.create({
        actorUserId:null,
        action:'ENROLLMENT_REQUEST_CREATED',
        entity:'enrollment_requests',
        entityId:row.id,
        metadata:withRequestAuditContext({ branchId:row.branchId || null, status:row.status }),
      });
      return row;
    });
    if (this.cacheService) this.cacheService.invalidateTags(['enrollment-requests']);
    return created;
  }

  async listEnrollmentRequests(actor) {
    const rows = await this.db.enrollmentRequests.all();
    return this.accessPolicy ? this.accessPolicy.filterList(actor, 'enrollment-requests', rows) : rows;
  }

  async updateEnrollmentRequestStatus(actor, requestId, data) {
    const request = await this.db.enrollmentRequests.findById(requestId);
    if (!request) throw new AppError('Enrollment request not found', 404);
    if (this.accessPolicy) await this.accessPolicy.assertCanUpdate(actor, 'enrollment-requests', request, data);
    const transitions = {
      pending:new Set(['contacted', 'lost']),
      contacted:new Set(['trial_scheduled', 'enrolled', 'lost']),
      trial_scheduled:new Set(['contacted', 'enrolled', 'lost']),
      enrolled:new Set(),
      lost:new Set(),
    };
    const updated = await this.inTransaction(async (db) => {
      const currentRequest = await db.enrollmentRequests.findById(requestId);
      if (!currentRequest) throw new AppError('Enrollment request not found', 404);
      const current = currentRequest.status || 'pending';
      if (current === data.status) return currentRequest;
      if (!transitions[current]?.has(data.status)) {
        throw new AppError(`Enrollment request cannot move from ${current} to ${data.status}`, 409, { code:'INVALID_LEAD_STATUS_TRANSITION' });
      }

      let convertedStudentId = null;
      if (data.status === 'enrolled') {
        let student = data.convertedStudentId ? await db.students.findById(data.convertedStudentId) : null;
        if (!student) {
          const user = await db.users.findBy('email', String(currentRequest.email || '').trim().toLowerCase());
          student = user ? await db.students.findBy('userId', user.id) : null;
        }
        if (!student || student.active === false) {
          throw new AppError('Create and activate the student account before marking the lead as enrolled', 422, { code:'CONVERTED_STUDENT_REQUIRED' });
        }
        if (currentRequest.branchId && student.branchId !== currentRequest.branchId) {
          throw new AppError('Converted student must belong to the requested branch', 422, { code:'LEAD_STUDENT_BRANCH_MISMATCH' });
        }
        convertedStudentId = student.id;
      }

      let followUpAt = null;
      if (data.status === 'trial_scheduled') {
        const trialDate = new Date(data.followUpAt);
        if (trialDate <= new Date()) throw new AppError('Trial date must be in the future', 422, { code:'INVALID_TRIAL_DATE' });
        followUpAt = trialDate.toISOString();
      } else if (data.status === 'contacted' && data.followUpAt) {
        followUpAt = new Date(data.followUpAt).toISOString();
      }

      const row = await db.enrollmentRequests.update(requestId, {
        status:data.status,
        statusNotes:data.notes || null,
        followUpAt,
        convertedStudentId,
        updatedBy:actor.id,
        updatedAt:new Date().toISOString(),
      });
      await db.auditLogs.create({
        actorUserId:actor.id,
        action:'ENROLLMENT_REQUEST_STATUS_UPDATED',
        entity:'enrollment_requests',
        entityId:requestId,
        metadata:withRequestAuditContext({
          before:{ status:current, followUpAt:currentRequest.followUpAt || null, convertedStudentId:currentRequest.convertedStudentId || null },
          after:{ status:row.status, followUpAt:row.followUpAt || null, convertedStudentId:row.convertedStudentId || null },
          notes:data.notes || null,
        }),
      });
      return row;
    });
    if (this.cacheService) this.cacheService.invalidateTags(['enrollment-requests', 'reports']);
    return updated;
  }

  async assertActorCanCreateRole(actor, role) {
    if ([Roles.ADMIN, Roles.GENERAL_DIRECTOR].includes(role) && actor?.role !== Roles.ADMIN) {
      throw new AppError('Only Admin users can grant global administration roles', 403, { code:'GLOBAL_ROLE_RESTRICTED' });
    }
  }

  async assertRoleReady(userId, role) {
    if (role === Roles.STUDENT && !(await this.db.students.findBy('userId', userId))) {
      throw new AppError('Student role requires a linked student profile', 422, { code:'STUDENT_PROFILE_REQUIRED' });
    }
    if (role === Roles.TEACHER && !(await this.db.teachers.findBy('userId', userId))) {
      throw new AppError('Teacher role requires a linked teacher profile', 422, { code:'TEACHER_PROFILE_REQUIRED' });
    }
    if (role === Roles.BRANCH_DIRECTOR) {
      const branchAccess = await this.listUserBranchAccess(userId);
      if (!branchAccess.length) throw new AppError('BranchDirector role requires at least one assigned branch', 422, { code:'BRANCH_ACCESS_REQUIRED' });
    }
  }

  async ensureBranchExists(branchId) {
    if (!branchId) throw new AppError('Branch is required', 422, { code:'BRANCH_REQUIRED' });
    const branch = await this.db.branches.findById(branchId);
    if (!branch) throw new AppError('Branch not found', 404);
    return branch;
  }

  async updateUserRole(actor, userId, role) {
    const user = await this.db.users.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    if (role === user.role) return publicUser(user);
    if (actor.id === userId && role !== user.role) {
      throw new AppError('Administrators cannot change their own role', 422, { code:'SELF_ROLE_CHANGE_FORBIDDEN' });
    }
    await this.assertActorCanCreateRole(actor, role);
    if (role !== user.role) await this.assertRoleReady(userId, role);
    if (user.role === Roles.ADMIN && role !== Roles.ADMIN) {
      const activeAdmins = (await this.db.users.all()).filter((item) => item.role === Roles.ADMIN && item.active !== false);
      if (activeAdmins.length <= 1) throw new AppError('The last active administrator cannot change role', 409, { code:'LAST_ADMIN_REQUIRED' });
    }
    const updated = await this.inTransaction(async (db) => {
      const row = await db.users.update(userId, { role });
      if (role !== Roles.BRANCH_DIRECTOR && db.userBranchAccess.replaceForUser) {
        await db.userBranchAccess.replaceForUser(userId, []);
      }
      const sessions = await db.sessions.all();
      await Promise.all(sessions.filter((session) => session.userId === userId && !session.revoked).map((session) => db.sessions.update(session.id, { revoked:true })));
      await db.auditLogs.create({ actorUserId:actor.id, action:'USER_ROLE_UPDATED', entity:'users', entityId:userId, metadata:withRequestAuditContext({ beforeRole:user.role, afterRole:role }) });
      return row;
    });
    if (this.cacheService) this.cacheService.invalidateTags(['users', 'branches', 'reports', 'user-branch-access']);
    return publicUser(updated);
  }

  async updateUserStatus(actor, userId, active) {
    const user = await this.db.users.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    if (actor.id === userId && active === false) {
      throw new AppError('Administrators cannot deactivate their own account', 422, { code:'SELF_DEACTIVATION_FORBIDDEN' });
    }
    if (active && user.active === false) await this.assertRoleReady(userId, user.role);
    if (!active && user.role === Roles.ADMIN) {
      const activeAdmins = (await this.db.users.all()).filter((item) => item.role === Roles.ADMIN && item.active !== false);
      if (activeAdmins.length <= 1) throw new AppError('The last active administrator cannot be deactivated', 409, { code:'LAST_ADMIN_REQUIRED' });
    }
    if ((user.active !== false) === active) return publicUser(user);

    const updated = await this.inTransaction(async (db) => {
      const row = await db.users.update(userId, { active });
      if (!active) {
        const sessions = await db.sessions.all();
        await Promise.all(sessions.filter((session) => session.userId === userId && !session.revoked).map((session) => db.sessions.update(session.id, { revoked:true })));
      }
      await db.auditLogs.create({
        actorUserId:actor.id,
        action:active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entity:'users',
        entityId:userId,
        metadata:withRequestAuditContext({ beforeActive:user.active !== false, afterActive:active, sessionsRevoked:!active }),
      });
      return row;
    });
    if (this.cacheService) this.cacheService.invalidateTags(['users', 'branches', 'reports']);
    return publicUser(updated);
  }

  async resetUserPassword(actor, userId) {
    const user = await this.db.users.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    if (actor.id === userId) {
      throw new AppError('Use the personal password-change flow for your own account', 422, { code:'SELF_PASSWORD_RESET_FORBIDDEN' });
    }
    const temporaryPassword = generateTemporaryPassword();
    const delivery = await this.sendInvitationEmail(user, temporaryPassword);
    const updated = await this.inTransaction(async (db) => {
      const row = await db.users.update(userId, {
        passwordHash:hashPassword(temporaryPassword),
        mustChangePassword:true,
        passwordChangedAt:null,
      });
      const sessions = await db.sessions.all();
      await Promise.all(sessions.filter((session) => session.userId === userId && !session.revoked).map((session) => db.sessions.update(session.id, { revoked:true })));
      await db.auditLogs.create({
        actorUserId:actor.id,
        action:'USER_PASSWORD_RESET_EMAIL_SENT',
        entity:'users',
        entityId:userId,
        metadata:withRequestAuditContext({ sessionsRevoked:true, mustChangePassword:true, recipient:user.email, messageId:delivery.messageId }),
      });
      return row;
    });
    if (this.cacheService) this.cacheService.invalidateTags(['users']);
    return {
      user:publicUser(updated),
      invitation:delivery,
      message:`La nueva clave temporal fue enviada a ${updated.email}.`,
    };
  }

  async sendInvitationEmail(user, temporaryPassword) {
    if (!this.emailService) {
      throw new AppError('Email delivery is not configured', 503, { code:'EMAIL_DELIVERY_UNAVAILABLE' });
    }
    return this.emailService.sendAccessInvitation({
      recipientName:user.name,
      email:user.email,
      temporaryPassword,
      role:user.role,
    });
  }

  async setLinkedProfileActive(db, user, active) {
    if (user.role === Roles.STUDENT) {
      const profile = await db.students.findBy('userId', user.id);
      if (profile) await db.students.update(profile.id, { active });
    }
    if (user.role === Roles.TEACHER) {
      const profile = await db.teachers.findBy('userId', user.id);
      if (profile) await db.teachers.update(profile.id, { active });
    }
  }

  async resendUserInvitation(actor, userId) {
    const user = await this.db.users.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    if (actor.id === userId) throw new AppError('Use the personal password-change flow for your own account', 422, { code:'SELF_PASSWORD_RESET_FORBIDDEN' });

    const temporaryPassword = generateTemporaryPassword();
    const delivery = await this.sendInvitationEmail(user, temporaryPassword);
    const updated = await this.inTransaction(async (db) => {
      const row = await db.users.update(userId, {
        active:true,
        passwordHash:hashPassword(temporaryPassword),
        mustChangePassword:true,
        passwordChangedAt:null,
      });
      await this.setLinkedProfileActive(db, user, true);
      const sessions = await db.sessions.all();
      await Promise.all(sessions.filter((session) => session.userId === userId && !session.revoked).map((session) => db.sessions.update(session.id, { revoked:true })));
      await db.auditLogs.create({
        actorUserId:actor.id,
        action:'USER_INVITATION_RESENT',
        entity:'users',
        entityId:userId,
        metadata:withRequestAuditContext({ recipient:user.email, messageId:delivery.messageId, accountActivated:true }),
      });
      return row;
    });
    if (this.cacheService) this.cacheService.invalidateTags(['users', 'students', 'teachers', 'reports']);
    return { user:publicUser(updated), invitation:delivery, message:`La invitación fue enviada nuevamente a ${updated.email}.` };
  }

  async createAcademicUser(actor, data) {
    const email = String(data.email || '').trim().toLowerCase();
    if (await this.db.users.findBy('email', email)) throw new AppError('User already exists', 409);
    await this.assertActorCanCreateRole(actor, data.role);

    const uniqueBranchIds = [...new Set(data.branchIds || [])];
    if (data.role === Roles.BRANCH_DIRECTOR && !uniqueBranchIds.length) {
      throw new AppError('BranchDirector accounts require at least one assigned branch', 422, { code:'BRANCH_ACCESS_REQUIRED' });
    }
    for (const branchId of uniqueBranchIds) {
      if (!(await this.db.branches.findById(branchId))) throw new AppError('Branch not found', 404);
    }

    if (data.role !== Roles.BRANCH_DIRECTOR && uniqueBranchIds.length) {
      throw new AppError('Branch access can only be assigned to BranchDirector accounts', 422, { code:'BRANCH_ACCESS_ROLE_MISMATCH' });
    }
    if (data.role === Roles.STUDENT && !data.studentProfile) {
      throw new AppError('Student accounts require a student profile', 422, { code:'STUDENT_PROFILE_REQUIRED' });
    }
    if (data.role === Roles.TEACHER && !data.teacherProfile) {
      throw new AppError('Teacher accounts require a teacher profile', 422, { code:'TEACHER_PROFILE_REQUIRED' });
    }
    if (data.studentProfile && data.role !== Roles.STUDENT) {
      throw new AppError('Student profile can only be used with Student accounts', 422, { code:'PROFILE_ROLE_MISMATCH' });
    }
    if (data.teacherProfile && data.role !== Roles.TEACHER) {
      throw new AppError('Teacher profile can only be used with Teacher accounts', 422, { code:'PROFILE_ROLE_MISMATCH' });
    }
    if (data.studentProfile) await this.ensureBranchExists(data.studentProfile.branchId);
    if (data.teacherProfile) await this.ensureBranchExists(data.teacherProfile.branchId);

    const temporaryPassword = generateTemporaryPassword();
    const mustChangePassword = true;
    const created = await this.inTransaction(async (db) => {
      if (await db.users.findBy('email', email)) throw new AppError('User already exists', 409);
      const user = await db.users.create({
        email,
        name:data.name,
        role:data.role,
        active:false,
        passwordHash:hashPassword(temporaryPassword),
        mustChangePassword,
        passwordChangedAt:null,
      });
      if (uniqueBranchIds.length) await db.userBranchAccess.replaceForUser(user.id, uniqueBranchIds);

      let profile = null;
      if (data.role === Roles.STUDENT) {
        profile = await db.students.create({
          userId:user.id,
          branchId:data.studentProfile.branchId,
          fullName:data.studentProfile.fullName || data.name,
          level:data.studentProfile.level || 'B1',
          active:false,
        });
      }
      if (data.role === Roles.TEACHER) {
        profile = await db.teachers.create({
          userId:user.id,
          branchId:data.teacherProfile.branchId,
          fullName:data.teacherProfile.fullName || data.name,
          hourlyRate:data.teacherProfile.hourlyRate ?? 12.5,
          active:false,
        });
      }
      await db.auditLogs.create({
        actorUserId:actor.id,
        action:'ACADEMIC_USER_CREATED',
        entity:'users',
        entityId:user.id,
        metadata:withRequestAuditContext({ role:data.role, email, invitationPending:true }),
      });
      return { user, profile };
    });

    let delivery;
    try {
      delivery = await this.sendInvitationEmail(created.user, temporaryPassword);
    } catch (error) {
      await this.db.auditLogs.create({
        actorUserId:actor.id,
        action:'USER_INVITATION_DELIVERY_FAILED',
        entity:'users',
        entityId:created.user.id,
        metadata:withRequestAuditContext({ role:data.role, email, accountActive:false }),
      });
      if (this.cacheService) this.cacheService.invalidateTags(['users', 'students', 'teachers']);
      throw error;
    }

    const activated = await this.inTransaction(async (db) => {
      const user = await db.users.update(created.user.id, { active:data.active ?? true });
      if (created.profile) {
        const repository = data.role === Roles.STUDENT ? db.students : db.teachers;
        await repository.update(created.profile.id, { active:data.role === Roles.STUDENT ? (data.studentProfile.active ?? true) : (data.teacherProfile.active ?? true) });
      }
      await db.auditLogs.create({
        actorUserId:actor.id,
        action:'USER_INVITATION_SENT',
        entity:'users',
        entityId:created.user.id,
        metadata:withRequestAuditContext({ role:data.role, email, messageId:delivery.messageId, accountActive:user.active !== false }),
      });
      return {
        user,
        profile:created.profile
          ? await (data.role === Roles.STUDENT ? db.students : db.teachers).findById(created.profile.id)
          : null,
      };
    });
    if (this.cacheService) this.cacheService.invalidateTags(['users', 'students', 'teachers', 'branches', 'reports', 'user-branch-access']);
    return {
      user:publicUser(activated.user),
      profile:activated.profile,
      invitation:delivery,
      message:`La cuenta fue registrada y la clave temporal se envió a ${email}.`,
    };
  }

  async listUserBranchAccess(userId) {
    const user = await this.db.users.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    return this.db.userBranchAccess.listByUser
      ? this.db.userBranchAccess.listByUser(userId)
      : (await this.db.userBranchAccess.all()).filter((row) => row.userId === userId);
  }

  async updateUserBranchAccess(actor, userId, branchIds) {
    const user = await this.db.users.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    if (user.role !== Roles.BRANCH_DIRECTOR) {
      throw new AppError('Branch access can only be assigned to BranchDirector accounts', 422, { code:'BRANCH_ACCESS_ROLE_MISMATCH' });
    }

    const uniqueBranchIds = [...new Set(branchIds)];
    for (const branchId of uniqueBranchIds) {
      if (!(await this.db.branches.findById(branchId))) throw new AppError('Branch not found', 404);
    }

    const rows = await this.inTransaction(async (db) => {
      const previous = db.userBranchAccess.listByUser
        ? await db.userBranchAccess.listByUser(userId)
        : (await db.userBranchAccess.all()).filter((row) => row.userId === userId);
      const next = await db.userBranchAccess.replaceForUser(userId, uniqueBranchIds);
      await db.auditLogs.create({
        actorUserId:actor.id,
        action:'USER_BRANCH_ACCESS_UPDATED',
        entity:'users',
        entityId:userId,
        metadata:withRequestAuditContext({ before:previous.map((row) => row.branchId), after:uniqueBranchIds }),
      });
      return next;
    });
    if (this.cacheService) this.cacheService.invalidateTags(['branches', 'reports', 'user-branch-access']);
    return rows;
  }

  async listAbsenceJustifications(actor) {
    const rows = await this.db.absenceJustifications.all();
    const visible = this.accessPolicy ? await this.accessPolicy.filterList(actor, 'absence-justifications', rows) : rows;
    return visible.map(publicJustification);
  }

  async createAbsenceJustification(actor, data, evidenceFile = null) {
    const attendanceRecord = await this.db.studentAttendance.findById(data.attendanceRecordId);
    if (!attendanceRecord) throw new AppError('Attendance record not found', 404);
    if (attendanceRecord.status !== 'absent') {
      throw new AppError('Only absent attendance records can be justified', 422, { code:'ABSENCE_REQUIRED' });
    }
    if (this.accessPolicy) await this.accessPolicy.assertCanCreate(actor, 'absence-justifications', data);

    const evidence = validatedEvidence(evidenceFile);
    const justification = await this.inTransaction(async (db) => {
        const currentAttendance = await db.studentAttendance.findById(data.attendanceRecordId);
        if (!currentAttendance || currentAttendance.status !== 'absent') throw new AppError('Only an existing absence can be justified', 422, { code:'ABSENCE_REQUIRED' });
        const active = (await db.absenceJustifications.all()).find((row) => (
          row.attendanceRecordId === data.attendanceRecordId && ['pending', 'approved'].includes(row.status)
        ));
        if (active) throw new AppError('This absence already has an active justification', 409, { code:'ACTIVE_JUSTIFICATION_EXISTS' });
        const row = await db.absenceJustifications.create({
          attendanceRecordId:data.attendanceRecordId,
          reason:data.reason,
          ...evidence,
          status:'pending',
        });
        await db.auditLogs.create({ actorUserId:actor.id, action:'ABSENCE_JUSTIFICATION_CREATED', entity:'absence_justifications', entityId:row.id, metadata:withRequestAuditContext({ hasEvidence:Boolean(evidenceFile) }) });
        return row;
      });
    if (this.cacheService) this.cacheService.invalidateTags(['absence-justifications', 'attendance', 'reports']);
    return publicJustification(justification);
  }

  async getAbsenceJustificationEvidence(actor, id) {
    const justification = await this.db.absenceJustifications.findById(id);
    if (!justification) throw new AppError('Absence justification not found', 404);
    if (this.accessPolicy) await this.accessPolicy.assertCanRead(actor, 'absence-justifications', justification);
    if (!justification.evidenceData || !justification.evidenceData.length) {
      throw new AppError('La justificacion no tiene una evidencia adjunta.', 404, { code:'EVIDENCE_NOT_FOUND' });
    }
    return {
      content:Buffer.from(justification.evidenceData),
      mimeType:justification.evidenceMimeType,
      originalName:safeEvidenceName(justification.evidenceFileName),
    };
  }

  async reviewAbsenceJustification(actor, id, data) {
    const justification = await this.db.absenceJustifications.findById(id);
    if (!justification) throw new AppError('Absence justification not found', 404);
    if (justification.status !== 'pending') throw new AppError('Absence justification was already reviewed', 409);
    if (this.accessPolicy) await this.accessPolicy.assertCanUpdate(actor, 'absence-justifications', justification, data);

    const attendanceRecord = await this.db.studentAttendance.findById(justification.attendanceRecordId);
    if (!attendanceRecord) throw new AppError('Attendance record not found', 404);
    if (data.status === 'approved' && attendanceRecord.status !== 'absent') {
      throw new AppError('Only an absence can receive an approved justification', 422, { code:'ABSENCE_REQUIRED' });
    }

    const updated = await this.inTransaction(async (db) => {
      const current = await db.absenceJustifications.findById(id);
      if (!current || current.status !== 'pending') throw new AppError('Absence justification was already reviewed', 409);
      const currentAttendance = await db.studentAttendance.findById(current.attendanceRecordId);
      if (data.status === 'approved' && currentAttendance?.status !== 'absent') throw new AppError('Only an absence can receive an approved justification', 422, { code:'ABSENCE_REQUIRED' });
      const row = await db.absenceJustifications.update(id, { ...data, reviewedBy:actor.id, reviewedAt:new Date().toISOString() });
      await db.auditLogs.create({ actorUserId:actor.id, action:'ABSENCE_JUSTIFICATION_REVIEWED', entity:'absence_justifications', entityId:id, metadata:withRequestAuditContext({ status:data.status }) });
      return row;
    });
    if (this.cacheService) this.cacheService.invalidateTags(['absence-justifications', 'attendance', 'reports']);
    return publicJustification(updated);
  }

  async listScholarshipEvaluations(actor) {
    const rows = await this.db.scholarshipEvaluations.all();
    return this.accessPolicy ? this.accessPolicy.filterList(actor, 'scholarship-evaluations', rows) : rows;
  }

  async createScholarshipEvaluation(actor, data) {
    const evaluation = await this.inTransaction(async (db) => {
      const policy = this.policyFor(db);
      if (policy) await policy.assertCanCreate(actor, 'scholarship-evaluations', data);
      const passesScores = data.theoryScore >= 70 && data.practiceScore >= 70;
      const candidate = await this.rules.scholarshipCandidate(data.studentId, data.from, data.to, db);
      if (data.approved && !candidate.candidate) throw new AppError('Student is not a scholarship candidate', 422);
      if (data.approved && candidate.candidate && passesScores) {
        const previousApproval = (await db.scholarshipEvaluations.all()).find((row) => (
          row.studentId === data.studentId
          && row.approved === true
          && sameInstant(row.evaluationFrom, candidate.from)
          && sameInstant(row.evaluationTo, candidate.to)
        ));
        if (previousApproval) {
          throw new AppError('Student already has an approved scholarship evaluation for this period', 409, {
            code:'SCHOLARSHIP_ALREADY_APPROVED',
            evaluationId:previousApproval.id,
          });
        }
      }
      const approved = Boolean(data.approved && candidate.candidate && passesScores);
      let row;
      try {
        row = await db.scholarshipEvaluations.create({
          studentId:data.studentId,
          percentage:data.percentage,
          evaluationFrom:candidate.from,
          evaluationTo:candidate.to,
          attendanceRate:Number((candidate.attendanceRate * 100).toFixed(2)),
          theoryScore:data.theoryScore,
          practiceScore:data.practiceScore,
          approved,
          evaluatedBy:actor.id,
          evaluatedAt:new Date().toISOString(),
        });
      } catch (error) {
        if (approved && error?.status === 409) {
          throw new AppError('Student already has an approved scholarship evaluation for this period', 409, {
            code:'SCHOLARSHIP_ALREADY_APPROVED',
          });
        }
        throw error;
      }
      await db.auditLogs.create({ actorUserId:actor.id, action:'SCHOLARSHIP_EVALUATION_REGISTERED', entity:'scholarship_evaluations', entityId:row.id, metadata:withRequestAuditContext({ approved, evaluationFrom:candidate.from, evaluationTo:candidate.to }) });
      return row;
    });
    if (this.cacheService) this.cacheService.invalidateTags(['scholarship-evaluations', 'reports']);
    return evaluation;
  }

  async listLevelPromotionEvaluations(actor) {
    const rows = await this.db.levelPromotionEvaluations.all();
    return this.accessPolicy ? this.accessPolicy.filterList(actor, 'level-promotion-evaluations', rows) : rows;
  }

  async createLevelPromotionEvaluation(actor, data) {
    const evaluation = await this.inTransaction(async (db) => {
      const policy = this.policyFor(db);
      if (policy) await policy.assertCanCreate(actor, 'level-promotion-evaluations', data);
      const passesScores = data.consistencyScore >= 70 && data.theoryScore >= 70 && data.practiceScore >= 70;
      if (data.approved && passesScores) {
        const previousApproval = (await db.levelPromotionEvaluations.all()).find((row) => (
          row.studentId === data.studentId
          && row.fromLevel === 'B1'
          && row.toLevel === 'B2'
          && row.approved === true
        ));
        if (previousApproval) {
          throw new AppError('Student already has an approved B1 to B2 promotion', 409, {
            code:'LEVEL_PROMOTION_ALREADY_APPROVED',
            evaluationId:previousApproval.id,
          });
        }
      }
      const candidate = await this.rules.promotionCandidate(data.studentId, data.from, data.to, db);
      if (data.approved && !candidate.candidate) throw new AppError('Student is not a level promotion candidate', 422);
      const approved = Boolean(data.approved && candidate.candidate && passesScores);
      let row;
      try {
        row = await db.levelPromotionEvaluations.create({
          studentId:data.studentId,
          fromLevel:'B1',
          toLevel:'B2',
          evaluationFrom:candidate.from,
          evaluationTo:candidate.to,
          attendanceRate:Number((candidate.attendanceRate * 100).toFixed(2)),
          consistencyScore:data.consistencyScore,
          theoryScore:data.theoryScore,
          practiceScore:data.practiceScore,
          approved,
          evaluatedBy:actor.id,
          evaluatedAt:new Date().toISOString(),
        });
      } catch (error) {
        if (approved && error?.status === 409) {
          throw new AppError('Student already has an approved B1 to B2 promotion', 409, {
            code:'LEVEL_PROMOTION_ALREADY_APPROVED',
          });
        }
        throw error;
      }
      if (approved) await db.students.update(data.studentId, { level:'B2' });
      await db.auditLogs.create({ actorUserId:actor.id, action:'LEVEL_PROMOTION_EVALUATION_REGISTERED', entity:'level_promotion_evaluations', entityId:row.id, metadata:withRequestAuditContext({ approved, evaluationFrom:candidate.from, evaluationTo:candidate.to }) });
      return row;
    });
    if (this.cacheService) this.cacheService.invalidateTags(['level-promotion-evaluations', 'students', 'reports']);
    return evaluation;
  }
}

module.exports = { AcademicService };
