
const { PrismaClient } = require('@prisma/client');

async function check() {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    });
    
    for (const u of users) {
      const perms = u.role.permissions.map(p => p.permission.name);
      console.log(`User: ${u.firstName} ${u.lastName} (${u.email}) - Role: ${u.role.name}`);
      console.log(`Permissions: ${perms.join(', ')}`);
      console.log('---');
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
