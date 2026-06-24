function normalizeValue(value) {
  if (value && typeof value === 'object' && typeof value.toNumber === 'function') return value.toNumber();
  return value;
}

function normalizeRow(row) {
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeValue(value)]));
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
    return normalizeRow(await this.model.create({ data }));
  }

  async update(id, data) {
    return normalizeRow(await this.model.update({ where:{ id }, data }));
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

  async create(data) {
    return this.toUser(await this.prisma.user.create({
      data:{
        googleSub:data.googleSub || null,
        email:data.email,
        name:data.name,
        active:data.active ?? true,
        role:{ connect:{ id:await this.roleId(data.role) } },
      },
      include:{ role:true },
    }));
  }

  async update(id, data) {
    const updateData = { ...data };
    if (data.role) {
      updateData.role = { connect:{ id:await this.roleId(data.role) } };
    }
    return this.toUser(await this.prisma.user.update({ where:{ id }, data:updateData, include:{ role:true } }));
  }
}

module.exports = { PrismaRepository, PrismaUserRepository };
