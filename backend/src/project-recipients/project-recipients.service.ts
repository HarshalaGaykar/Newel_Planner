import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SetProjectRecipientsDto } from './dto/set-project-recipients.dto';

@Injectable()
export class ProjectRecipientsService {
  constructor(private prisma: PrismaService) {}

  async getOptionsAndMapping(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, clientId: true, client: { select: { id: true, name: true } } },
    });
    if (!project) throw new NotFoundException(`Project "${projectId}" not found`);

    const [clientContacts, internalUsers, mappedContacts, mappedUsers] = await Promise.all([
      project.clientId
        ? this.prisma.clientContact.findMany({
            where: { clientId: project.clientId, isActive: true },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve([]),
      this.prisma.user.findMany({
        where: { employmentStatus: 'ACTIVE' },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      this.prisma.projectClientContact.findMany({ where: { projectId } }),
      this.prisma.projectStatusCcUser.findMany({ where: { projectId } }),
    ]);

    return {
      client: project.client,
      clientContacts,
      internalUsers: internalUsers.map((u) => ({
        userId: u.id,
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
        email: u.email,
      })),
      mappedClientContacts: mappedContacts.map((m) => ({ clientContactId: m.clientContactId, role: m.role })),
      mappedInternalUsers: mappedUsers.map((m) => ({ userId: m.userId, role: m.role })),
    };
  }

  /** Resolves the saved recipient mapping into actual To/CC email addresses. */
  async resolveRecipients(projectId: string): Promise<{ to: string[]; cc: string[] }> {
    const [mappedContacts, mappedUsers] = await Promise.all([
      this.prisma.projectClientContact.findMany({
        where: { projectId },
        include: { clientContact: { select: { email: true } } },
      }),
      this.prisma.projectStatusCcUser.findMany({
        where: { projectId },
        include: { user: { select: { email: true } } },
      }),
    ]);

    const to = new Set<string>();
    const cc = new Set<string>();
    for (const m of mappedContacts) (m.role === 'TO' ? to : cc).add(m.clientContact.email);
    for (const m of mappedUsers) (m.role === 'TO' ? to : cc).add(m.user.email);

    return { to: [...to], cc: [...cc] };
  }

  async setRecipients(projectId: string, dto: SetProjectRecipientsDto) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project "${projectId}" not found`);

    const clientContacts = dto.clientContacts ?? [];
    const internalUsers = dto.internalUsers ?? [];

    await this.prisma.$transaction(async (tx) => {
      await tx.projectClientContact.deleteMany({ where: { projectId } });
      if (clientContacts.length) {
        await tx.projectClientContact.createMany({
          data: clientContacts.map((c) => ({ projectId, clientContactId: c.id, role: c.role })),
        });
      }

      await tx.projectStatusCcUser.deleteMany({ where: { projectId } });
      if (internalUsers.length) {
        await tx.projectStatusCcUser.createMany({
          data: internalUsers.map((u) => ({ projectId, userId: u.id, role: u.role })),
        });
      }
    });

    return this.getOptionsAndMapping(projectId);
  }
}
