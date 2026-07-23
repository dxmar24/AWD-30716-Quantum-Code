const { AppError } = require('../exceptions/AppError');
const { withRequestAuditContext } = require('../utils/requestAuditContext');

const TERMINAL_STATUSES = new Set(['paid', 'cancelled']);

function normalizedConcept(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function assertCalendarPeriod(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || ''));
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) {
    throw new AppError('Payment period must be a valid calendar month in YYYY-MM format', 422, {
      code:'INVALID_PAYMENT_PERIOD',
    });
  }
}

function dateOrNull(value, field) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError(`Invalid ${field}`, 422);
  return date;
}

function effectiveStatus(payment, now = new Date()) {
  if (TERMINAL_STATUSES.has(payment.status)) return payment.status;
  const dueAt = dateOrNull(payment.dueAt, 'due date');
  return dueAt && dueAt < now ? 'overdue' : 'pending';
}

class FinancialService {
  constructor(db, auditService, accessPolicy = null, cacheService = null) {
    this.db = db;
    this.audit = auditService;
    this.accessPolicy = accessPolicy;
    this.cacheService = cacheService;
  }

  async inTransaction(work) {
    return this.db.transaction ? this.db.transaction(work) : work(this.db);
  }

  invalidate() {
    if (this.cacheService) this.cacheService.invalidateTags(['student-payments', 'reports']);
  }

  present(payment, now = new Date()) {
    return { ...payment, status:effectiveStatus(payment, now) };
  }

  async list(actor) {
    const rows = await this.db.studentPayments.all();
    const visible = this.accessPolicy
      ? await this.accessPolicy.filterList(actor, 'student-payments', rows)
      : rows;
    return visible.map((item) => this.present(item));
  }

  async show(actor, id) {
    const payment = await this.db.studentPayments.findById(id);
    if (!payment) throw new AppError('Student payment not found', 404);
    if (this.accessPolicy) await this.accessPolicy.assertCanRead(actor, 'student-payments', payment);
    return this.present(payment);
  }

  async assertStudent(data, existing = null, db = this.db) {
    const studentId = existing?.studentId || data.studentId;
    const student = await db.students.findById(studentId);
    if (!student) throw new AppError('Student not found', 404);
    if (!existing && student.active === false) {
      throw new AppError('Cannot create a new charge for an inactive student', 422, {
        code:'INACTIVE_STUDENT',
      });
    }
    if (data.studentId && existing && data.studentId !== existing.studentId) {
      throw new AppError('A financial record cannot be transferred to another student', 409, {
        code:'PAYMENT_STUDENT_IMMUTABLE',
      });
    }
    const changesRecordedBranch = !existing || data.branchId !== existing.branchId;
    if (data.branchId && changesRecordedBranch && data.branchId !== student.branchId) {
      throw new AppError('Payment branch must match the student branch', 422, {
        code:'PAYMENT_BRANCH_MISMATCH',
      });
    }
    return student;
  }

  async assertNoDuplicate(studentId, period, concept, ignoredId = null, db = this.db) {
    const key = normalizedConcept(concept).toLocaleLowerCase('es');
    const duplicate = (await db.studentPayments.all()).find((item) => (
      item.id !== ignoredId
      && item.studentId === studentId
      && item.period === period
      && normalizedConcept(item.concept).toLocaleLowerCase('es') === key
      && item.status !== 'cancelled'
    ));
    if (duplicate) {
      throw new AppError('A charge with this concept already exists for the student and period', 409, {
        code:'DUPLICATE_STUDENT_CHARGE',
      });
    }
  }

  normalizeDraft(data, student, existing = null) {
    const amount = data.amount === undefined && existing ? Number(existing.amount) : Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('Payment amount must be greater than zero', 422, { code:'INVALID_PAYMENT_AMOUNT' });
    }
    const period = data.period || existing?.period;
    assertCalendarPeriod(period);
    const concept = normalizedConcept(data.concept || existing?.concept);
    if (concept.length < 3) throw new AppError('Payment concept is required', 422);
    const dueAt = data.dueAt === undefined ? existing?.dueAt || null : data.dueAt;
    dateOrNull(dueAt, 'due date');
    const requestedStatus = data.status || existing?.status || 'pending';
    if (!['pending', 'overdue', 'paid', 'cancelled'].includes(requestedStatus)) {
      throw new AppError('Invalid payment status', 422);
    }
    const now = new Date();
    const paidAtInput = data.paidAt === undefined ? existing?.paidAt || null : data.paidAt;
    let paidAt = null;
    if (requestedStatus === 'paid') {
      const paidDate = paidAtInput ? dateOrNull(paidAtInput, 'payment date') : now;
      if (paidDate > new Date(now.getTime() + 5 * 60000)) {
        throw new AppError('Payment date cannot be in the future', 422, { code:'FUTURE_PAYMENT_DATE' });
      }
      paidAt = paidDate.toISOString();
    } else if (paidAtInput) {
      throw new AppError('Only paid records can have a payment date', 422, {
        code:'PAYMENT_DATE_STATUS_MISMATCH',
      });
    }

    const normalized = {
      studentId:student.id,
      // The branch on a financial movement is historical accounting data. A
      // later student transfer must not silently reattribute an existing
      // charge when it is edited or posted. Branch corrections remain
      // possible only when branchId is sent explicitly (and update() requires
      // a correction reason for that change).
      branchId:existing
        ? (data.branchId === undefined ? existing.branchId : data.branchId)
        : student.branchId,
      amount:Number(amount.toFixed(2)),
      concept,
      period,
      status:requestedStatus === 'paid' || requestedStatus === 'cancelled'
        ? requestedStatus
        : effectiveStatus({ status:'pending', dueAt }, now),
      paidAt,
      dueAt:dueAt || null,
      notes:data.notes === undefined ? existing?.notes : data.notes,
    };
    return normalized;
  }

  async create(actor, data) {
    const student = await this.assertStudent(data);
    if (this.accessPolicy) {
      await this.accessPolicy.assertCanCreate(actor, 'student-payments', {
        ...data,
        branchId:student.branchId,
      });
    }
    const normalized = this.normalizeDraft(data, student);
    if (normalized.status === 'cancelled') {
      throw new AppError('A new financial record cannot start as cancelled', 422);
    }
    const created = await this.inTransaction(async (db) => {
      await this.assertNoDuplicate(student.id, normalized.period, normalized.concept, null, db);
      const row = await db.studentPayments.create({
        ...normalized,
        transactionType:'charge',
        reversalOfId:null,
        reversalReason:null,
        createdBy:actor.id,
        updatedBy:actor.id,
        updatedAt:new Date().toISOString(),
      });
      await db.auditLogs.create({
        actorUserId:actor.id,
        action:'STUDENT_CHARGE_CREATED',
        entity:'student_payments',
        entityId:row.id,
        metadata:withRequestAuditContext({ after:this.present(row) }),
      });
      return row;
    });
    this.invalidate();
    return this.present(created);
  }

  async update(actor, id, data) {
    const existing = await this.db.studentPayments.findById(id);
    if (!existing) throw new AppError('Student payment not found', 404);
    if (this.accessPolicy) await this.accessPolicy.assertCanUpdate(actor, 'student-payments', existing, data);
    if (TERMINAL_STATUSES.has(existing.status)) {
      throw new AppError('Posted or cancelled financial records are immutable; create a reversal instead', 409, {
        code:'FINANCIAL_RECORD_IMMUTABLE',
      });
    }
    if (data.status === 'cancelled' && String(data.correctionReason || '').trim().length < 5) {
      throw new AppError('A cancellation reason of at least five characters is required', 422, {
        code:'FINANCIAL_CANCELLATION_REASON_REQUIRED',
      });
    }
    const changesFinancialTerms = ['amount', 'concept', 'period', 'studentId', 'branchId']
      .some((field) => data[field] !== undefined && String(data[field]) !== String(existing[field]));
    if (changesFinancialTerms && String(data.correctionReason || '').trim().length < 5) {
      throw new AppError('A correction reason is required when financial terms change', 422, {
        code:'FINANCIAL_CORRECTION_REASON_REQUIRED',
      });
    }
    const updated = await this.inTransaction(async (db) => {
      const current = await db.studentPayments.findById(id);
      if (!current) throw new AppError('Student payment not found', 404);
      if (TERMINAL_STATUSES.has(current.status)) throw new AppError('Posted or cancelled financial records are immutable; create a reversal instead', 409, { code:'FINANCIAL_RECORD_IMMUTABLE' });
      const student = await this.assertStudent(data, current, db);
      const normalized = this.normalizeDraft(data, student, current);
      await this.assertNoDuplicate(student.id, normalized.period, normalized.concept, current.id, db);
      const row = await db.studentPayments.update(id, {
        ...normalized,
        updatedBy:actor.id,
        updatedAt:new Date().toISOString(),
      });
      await db.auditLogs.create({
        actorUserId:actor.id,
        action:'STUDENT_CHARGE_UPDATED',
        entity:'student_payments',
        entityId:id,
        metadata:withRequestAuditContext({ before:this.present(current), after:this.present(row), reason:data.correctionReason || null }),
      });
      return row;
    });
    this.invalidate();
    return this.present(updated);
  }

  async reverse(actor, id, reason) {
    const original = await this.db.studentPayments.findById(id);
    if (!original) throw new AppError('Student payment not found', 404);
    if (this.accessPolicy) await this.accessPolicy.assertCanUpdate(actor, 'student-payments', original, {});
    if (original.transactionType === 'reversal') {
      throw new AppError('A reversal cannot itself be reversed', 409, { code:'REVERSAL_OF_REVERSAL' });
    }
    if (original.status !== 'paid') {
      throw new AppError('Only a posted paid charge can be reversed', 409, { code:'PAYMENT_NOT_POSTED' });
    }
    const reversal = await this.inTransaction(async (db) => {
      const current = await db.studentPayments.findById(id);
      if (!current || current.status !== 'paid' || current.transactionType === 'reversal') {
        throw new AppError('Only a posted paid charge can be reversed', 409, { code:'PAYMENT_NOT_POSTED' });
      }
      const duplicate = (await db.studentPayments.all()).find((row) => row.reversalOfId === current.id);
      if (duplicate) throw new AppError('This payment has already been reversed', 409, { code:'PAYMENT_ALREADY_REVERSED' });
      const now = new Date().toISOString();
      const row = await db.studentPayments.create({
        studentId:current.studentId,
        branchId:current.branchId,
        amount:-Math.abs(Number(current.amount)),
        concept:`Reversal: ${normalizedConcept(current.concept)}`.slice(0, 100),
        period:current.period,
        status:'paid',
        paidAt:now,
        dueAt:null,
        notes:String(reason).trim(),
        transactionType:'reversal',
        reversalOfId:current.id,
        reversalReason:String(reason).trim(),
        createdBy:actor.id,
        updatedBy:actor.id,
        updatedAt:now,
      });
      await db.auditLogs.create({
        actorUserId:actor.id,
        action:'STUDENT_PAYMENT_REVERSED',
        entity:'student_payments',
        entityId:row.id,
        metadata:withRequestAuditContext({ originalPaymentId:current.id, amount:row.amount, reason:String(reason).trim() }),
      });
      return row;
    });
    this.invalidate();
    return this.present(reversal);
  }
}

module.exports = {
  FinancialService,
  assertCalendarPeriod,
  effectiveStatus,
  normalizedConcept,
};
