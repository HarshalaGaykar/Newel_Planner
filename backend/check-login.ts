// backend/check-login.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const EMAIL = 'chavan.soham@neweltechnologies.com';
const PASSWORD = 'James@2710';
const prisma = new PrismaClient();

(async () => {
  const url = process.env.DATABASE_URL || '(not set)';
  console.log('DB in use:', url.replace(/:\/\/[^@]*@/, '://***:***@'));

  const user = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { email: true, password: true, failedAttempts: true, isActive: true, employmentStatus: true },
  });

  if (!user) {
    console.log('RESULT: user NOT found by lowercase email in THIS db.');
    console.log('-> App is pointed at a DB without this row, OR stored email differs. (Hypothesis B)');
    return prisma.$disconnect();
  }

  console.log('Found:', {
    email: user.email,
    failedAttempts: user.failedAttempts,
    isActive: user.isActive,
    status: user.employmentStatus,
    hashPrefix: user.password.slice(0, 4),
    hashLen: user.password.length,
  });

  const match = await bcrypt.compare(PASSWORD, user.password);
  console.log(`bcrypt.compare("${PASSWORD}", storedHash) ->`, match);
  console.log(match
    ? '-> Password MATCHES here. If login still 401s, the app uses a different DATABASE_URL than this script.'
    : '-> Password does NOT match. Stored hash is for a different password. Fix = re-hash.');

  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });