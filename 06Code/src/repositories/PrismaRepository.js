const { Prisma } = require('@prisma/client');
const { AppError } = require('../exceptions/AppError');

function normalizeValue(value) {
  if (value && typeof value === 'object' && typeof value.toNumber === 'function') return value.toNumber();
  return value;
}

function normalizeRow(row) {
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeValue(value)]));
}

function mapPrismaError(error, entityName = 'record') {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) throw error;
  if (error.code === 'P2002') throw new AppError(`${entityName} already exists`, 409, { target:error.meta?.target || null });
  if (error.code === 'P2003') throw new AppError('Related record not found', 422, { field:error.meta?.field_name || null });
  if (error.code === 'P2025') return null;
  throw error;
}

class PrismaRepository {
  constructor(model) {
    this.model = model;
  }

  async all() {
    const rows = await this.model.findMany();
    return rows.map(normalizeRow);
  }

  async findById(id) {
    return normalizeRow(await this.model.findUnique({ where:{ id } }));
  }

  async findBy(field, value) {
    return normalizeRow(await this.model.findFirst({ where:{ [field]:value } }));
  }

  async create(data) {
    try {
      return normalizeRow(await this.model.create({ data }));
    } catch (error) {
      return mapPrismaError(error);
    }
  }

  async update(id, data) {
    try {
      return normalizeRow(await this.model.update({ where:{ id }, data }));
    } catch (error) {
      return mapPrismaError(error);
    }
  }
}

class PrismaUserRepository extends PrismaRepository {
  constructor(prisma) {
    super(prisma.user);
    this.prisma = prisma;
  }

  toUser(row) {
    if (!row) return null;
    return {
      id:row.id,
      googleSub:row.googleSub,
      email:row.email,
      name:row.name,
      role:row.role?.name || row.role,
      active:row.active,
      mustChangePassword:row.mustChangePassword,
      passwordChangedAt:row.passwordChangedAt,
      createdAt:row.createdAt,
    };
  }

  async roleId(roleName) {
    const role = await this.prisma.role.findUnique({ where:{ name:roleName } });
    if (!role) throw new Error(`Role not found: ${roleName}`);
    return role.id;
  }

  async all() {
    const rows = await this.prisma.user.findMany({ include:{ role:true } });
    return rows.map((row) => this.toUser(row));
  }

  async findById(id) {
    return this.toUser(await this.prisma.user.findUnique({ where:{ id }, include:{ role:true } }));
  }

  async findBy(field, value) {
    return this.toUser(await this.prisma.user.findFirst({ where:{ [field]:value }, include:{ role:true } }));
  }

  async findAuthByEmail(email) {
    const row = await this.prisma.user.findFirst({ where:{ email }, include:{ role:true } });
    const user = this.toUser(row);
    return user ? { ...user, passwordHash:row.passwordHash } : null;
  }

  async create(data) {
    try {
      return this.toUser(await this.prisma.user.create({
        data:{
          googleSub:data.googleSub || null,
          email:data.email,
          name:data.name,
          passwordHash:data.passwordHash || null,
          mustChangePassword:data.mustChangePassword ?? false,
          passwordChangedAt:data.passwordChangedAt || null,
          active:data.active ?? true,
          role:{ connect:{ id:await this.roleId(data.role) } },
        },
        include:{ role:true },
      }));
    } catch (error) {
      return mapPrismaError(error, 'User');
    }
  }

  async update(id, data) {
    const updateData = { ...data };
    if (data.role) {
      updateData.role = { connect:{ id:await this.roleId(data.role) } };
    }
    try {
      return this.toUser(await this.prisma.user.update({ where:{ id }, data:updateData, include:{ role:true } }));
    } catch (error) {
      return mapPrismaError(error, 'User');
    }
  }
}

class PrismaUserBranchAccessRepository extends PrismaRepository {
  constructor(prisma) {
    super(prisma.userBranchAccess);
    this.prisma = prisma;
  }

  async listByUser(userId) {
    const rows = await this.prisma.userBranchAccess.findMany({ where:{ userId } });
    return rows.map(normalizeRow);
  }

  async replaceForUser(userId, branchIds) {
    try {
      await this.prisma.userBranchAccess.deleteMany({ where:{ userId } });
      if (!branchIds.length) return [];
      const rows = await Promise.all(branchIds.map((branchId) => (
        this.prisma.userBranchAccess.create({ data:{ userId, branchId } })
      )));
      return rows.map(normalizeRow);
    } catch (error) {
      return mapPrismaError(error, 'Branch access');
    }
  }
}

module.exports = { PrismaRepository, PrismaUserRepository, PrismaUserBranchAccessRepository, mapPrismaError };
