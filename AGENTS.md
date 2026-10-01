# AGENTS.md — Newel Planner Revamp

## Stack

**Backend** — NestJS 11, TypeScript 5.7, Prisma 6.2 (PostgreSQL), Passport-JWT, class-validator, exceljs, nodemailer, @nestjs/schedule  
**Frontend** — Next.js 16.2, React 19, TypeScript 5, Tailwind CSS 4, shadcn/radix-ui, react-hook-form + zod, zustand, axios, recharts

## Folder Map

```
backend/src/<module>/          # NestJS modules — each has controller, service, module, dto/
backend/src/auth/              # JWT auth, RBAC guards, decorators, role/permission constants
backend/src/common/            # Shared guards, interceptors, pipes, decorators
backend/src/prisma/            # PrismaService singleton
backend/prisma/schema.prisma   # Single schema file — all models here
backend/prisma/seed*.ts        # Targeted seed scripts (permissions, menus, shifts, etc.)
frontend/app/(dashboard)/      # All authenticated pages — one folder per domain
frontend/app/login/            # Public auth page
frontend/components/           # Reusable UI components (shadcn wrappers + domain components)
frontend/lib/                  # API clients — one file per domain (tasks-api.ts, leaves-api.ts…)
frontend/lib/api.ts            # Axios instance base (imported by all lib/*-api.ts files)
```

## Conventions

**Imports (backend):** Path aliases via tsconfig-paths. Services import `PrismaService` from `'../prisma/prisma.service'`. DTOs import Prisma enums directly from `'@prisma/client'`.

**Naming:** Modules follow `<domain>.controller.ts / <domain>.service.ts / <domain>.module.ts`. DTOs are `create-<entity>.dto.ts` / `update-<entity>.dto.ts`. Frontend API files are `<domain>-api.ts`.

**Validation (backend):** All DTO fields decorated with `class-validator` — `@IsString`, `@IsOptional`, `@IsIn([...])`, `@IsUUID`, etc. `ValidationPipe` applied globally.

**Auth:** Every controller gets `@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)`. Individual endpoints use `@Permissions(Permission.SOME_PERM)` decorator. Current user injected via `@CurrentUser() actor: { userId, role }`.

**RBAC roles:** `ADMIN | PM | TL | USER | HR | FREELANCER` — defined in `backend/src/auth/constants/rbac.constants.ts`. Service-level role checks throw `ForbiddenException`.

**Error handling (backend):** Throw NestJS built-ins — `NotFoundException`, `BadRequestException`, `ForbiddenException`. No custom error classes.

**Frontend API calls:** All go through `lib/api.ts` (axios instance). Domain API files export a plain object of typed async functions, e.g. `tasksApi.createTask(data)`.

## Agent Efficiency

- Start with `rg` / `rg --files`, then open only files relevant to the task.
- Do not scan `node_modules`, generated clients, lockfiles, build output, or unrelated domains unless required.
- Read target files before editing; inspect the nearest existing implementation before creating a new pattern.
- Keep changes narrowly scoped; do not perform unrelated refactors or formatting.
- Do not repeat file reads or commands unless the file or relevant state changed.
- Run the narrowest relevant test, lint, or build first. Run full-project checks only for shared or cross-app changes.
- Summarize long logs and command output; keep progress updates and final responses concise.
- Use web search only for current/external facts or when explicitly requested.
- Use subagents or agent teams only for independent, substantial work that benefits from parallelism.

## CRUD Pattern

**Backend controller endpoint:**
```ts
@Post()
@Permissions(Permission.WORK_TASK_UPDATE)
create(@Body() dto: CreateTaskDto, @CurrentUser() actor: any) {
  return this.tasksService.create(dto, { id: actor.userId, role: actor.role });
}
```

**Backend service create:**
```ts
async create(dto: CreateTaskDto, user: { id: string; role: string }) {
  if (!['ADMIN', 'PM', 'TL'].includes(user.role))
    throw new ForbiddenException('...');
  const entity = await this.prisma.task.findUnique({ where: { id: dto.parentId } });
  if (!entity) throw new NotFoundException('...');
  return this.prisma.task.create({ data: { ...dto }, include: { skills: true } });
}
```

**Frontend API call:**
```ts
// lib/tasks-api.ts
createTask: (data: Partial<Task>) =>
  api.post<Task>('/tasks', data).then((res) => res.data),
```

## Commands

```bash
# Backend
cd backend
npm run start:dev                              # dev server (NODE_ENV=development)
npm run build                                  # compile to dist/
npm run prisma:migrate:dev                     # run migrations against dev DB
npm run prisma:seed:dev                        # full seed
npm run prisma:seed:permissions:dev            # seed roles/permissions only
npm run prisma:seed:menus:dev                  # seed nav menus

# Frontend
cd frontend
npm run dev                                    # Next.js dev on localhost
npm run build                                  # production build
npm run lint                                   # eslint
```

## Do Not Touch

- `backend/prisma/schema.prisma` — modify only via `prisma migrate dev`; never hand-edit generated client
- `backend/src/auth/constants/rbac.constants.ts` — adding permissions here requires a matching DB seed run
- `frontend/app/(dashboard)/layout.tsx` — shared auth wrapper; breaking this kills all protected pages
- `.env.development` / `.env.production` — never commit; all secrets loaded via `dotenv-cli`
