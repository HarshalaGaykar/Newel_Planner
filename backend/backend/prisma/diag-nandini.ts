import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const email = 'nandini@neweltechnologies.com';

  // 1. Resolve the user the way the importer does (case-insensitive, active only)
  const users = await prisma.user.findMany({
    where: { email: { contains: 'nandini', mode: 'insensitive' } },
    select: { id: true, email: true, isActive: true, firstName: true, lastName: true },
  });
  console.log('\n=== Users matching "nandini" ===');
  console.table(users);

  const user = users.find((u) => u.email.toLowerCase() === email);
  if (!user) {
    console.log(`No user with exact email ${email}`);
  }

  // 2. All allocations for that user (any project)
  if (user) {
    const allocs = await prisma.allocation.findMany({
      where: { userId: user.id },
      select: { projectId: true, startDate: true, endDate: true, project: { select: { name: true, status: true } } },
    });
    console.log(`\n=== Allocations for ${user.email} (userId=${user.id}) ===`);
    console.table(allocs.map((a) => ({ project: a.project?.name, status: a.project?.status, projectId: a.projectId })));
  }

  // 3. Duplicate project names (importer resolves name -> last id wins)
  const projects = await prisma.project.findMany({ select: { id: true, name: true, status: true }, orderBy: { name: 'asc' } });
  const byName = new Map<string, number>();
  projects.forEach((p) => byName.set(p.name.trim().toLowerCase(), (byName.get(p.name.trim().toLowerCase()) ?? 0) + 1));
  const dupes = [...byName.entries()].filter(([, n]) => n > 1);
  console.log('\n=== Duplicate project names ===');
  console.table(dupes.map(([name, count]) => ({ name, count })));
}

main().finally(() => prisma.$disconnect());
