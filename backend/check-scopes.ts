import { PrismaClient } from '@prisma/client';

async function check() {
  const p = new PrismaClient();
  const rps = await p.rolePermission.findMany({
    where: { role: { name: { in: ['TL', 'PM'] } } },
    include: { permission: true, role: true }
  });
  
  const out = rps
    .filter(r => r.permission.name.includes('APPROVE') || r.permission.name.includes('MANAGE') || r.permission.name.includes('VIEW'))
    .map(r => `${r.role.name} - ${r.permission.name}: ${r.dataScope}`);
    
  console.log(out.sort().join('\n'));
}

check().catch(console.error).finally(() => process.exit(0));
