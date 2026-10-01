const fs = require('fs');
const path = require('path');

// Load DATABASE_URL from .env.development
const envPath = path.join(__dirname, '..', '.env.development');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'nandini@neweltechnologies.com';

  const users = await prisma.user.findMany({
    where: { email: { contains: 'nandini', mode: 'insensitive' } },
    select: { id: true, email: true, isActive: true, firstName: true, lastName: true },
  });
  console.log('\n=== Users matching "nandini" ===');
  console.table(users);

  const user = users.find((u) => u.email.toLowerCase() === email) || users[0];

  if (user) {
    const allocs = await prisma.allocation.findMany({
      where: { userId: user.id },
      select: { projectId: true, percentage: true, project: { select: { name: true, status: true } } },
    });
    console.log(`\n=== Allocations for ${user.email} (userId=${user.id}, active=${user.isActive}) ===`);
    console.table(allocs.map((a) => ({ project: a.project && a.project.name, status: a.project && a.project.status, projectId: a.projectId, pct: a.percentage })));
  }

  const projects = await prisma.project.findMany({ select: { name: true } });
  const byName = new Map();
  projects.forEach((p) => { const k = p.name.trim().toLowerCase(); byName.set(k, (byName.get(k) || 0) + 1); });
  const dupes = [...byName.entries()].filter(([, n]) => n > 1);
  console.log('\n=== Duplicate project names ===');
  console.table(dupes.map(([name, count]) => ({ name, count })));
}

main().catch((e) => console.error(e)).finally(() => prisma.$disconnect());
