import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaturityDto } from './dto/create-maturity.dto';
import { UpdateMaturityDto } from './dto/update-maturity.dto';
import { QueryMaturityDto } from './dto/query-maturity.dto';
import { MaturityReportQueryDto } from './dto/maturity-report-query.dto';

export interface MaturityBulkUploadResult {
  created: number;
  updated: number;
  skipped: number;
  duplicates: number;
  unchanged: number;
  errors: { row: number; message: string }[];
}

const MONTH_ABBREVIATIONS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

function parseMonthYear(value: string): Date | null {
  const match = /^([A-Za-z]{3})-(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const monthIndex = MONTH_ABBREVIATIONS.indexOf(match[1].toLowerCase());
  if (monthIndex === -1) return null;
  return new Date(Number(match[2]), monthIndex, 1);
}

// Excel auto-converts "MMM-YYYY"-looking text into a real date cell, so exceljs may hand back
// a JS Date instead of a string for this column — handle both instead of only the string form.
function extractMonthYear(cellValue: unknown): Date | null {
  if (cellValue instanceof Date) {
    return new Date(cellValue.getFullYear(), cellValue.getMonth(), 1);
  }
  if (typeof cellValue === 'string' || typeof cellValue === 'number') {
    return parseMonthYear(cellValue.toString());
  }
  return null;
}

function displayCellValue(cellValue: unknown): string {
  if (cellValue instanceof Date) {
    return cellValue.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  }
  return (cellValue ?? '').toString();
}

// `forTheMonth` is built from local Y/M components (see extractMonthYear/parseMonthYear) to represent
// a calendar month, not an instant in time — never round-trip it through `.toISOString()`, which
// re-interprets it in UTC and can shift it onto the previous day (and, for the 1st, the previous
// month entirely) whenever the server runs ahead of UTC (e.g. IST, +5:30).
function toFirstOfMonthIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function normaliseHeader(s: string) {
  return (s ?? '').toString().toLowerCase().replace(/[\s/\-]/g, '');
}

@Injectable()
export class MaturityService {
  constructor(private readonly prisma: PrismaService) {}

  private async getUserName(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    return [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown';
  }

  async create(dto: CreateMaturityDto, actorId: string) {
    const existing = await this.prisma.employeeMaturity.findUnique({ where: { userId: dto.userId } });
    if (existing) {
      throw new ConflictException(`Maturity record already exists for user ${dto.userId}. Use PATCH to update it.`);
    }

    const userName = await this.getUserName(dto.userId);

    return this.prisma.$transaction(async (tx) => {
      const main = await tx.employeeMaturity.create({
        data: {
          userId: dto.userId,
          userName,
          currentMaturityValue: dto.currentMaturityValue,
          forTheMonth: new Date(dto.forTheMonth),
          isActive: dto.isActive ?? true,
          remarks: dto.remarks,
          createdById: actorId,
          updatedById: actorId,
        },
      });

      await tx.employeeMaturityHistory.create({
        data: {
          employeeMaturityId: main.id,
          userId: dto.userId,
          userName,
          maturityValue: dto.currentMaturityValue,
          forTheMonth: new Date(dto.forTheMonth),
          isActive: dto.isActive ?? true,
          remarks: dto.remarks,
          createdById: actorId,
        },
      });

      return main;
    });
  }

  async update(userId: string, dto: UpdateMaturityDto, actorId: string) {
    const main = await this.prisma.employeeMaturity.findUnique({ where: { userId } });
    if (!main) throw new NotFoundException(`Maturity record not found for user ${userId}`);

    const existingHistory = await this.prisma.employeeMaturityHistory.findUnique({
      where: { userId_forTheMonth: { userId, forTheMonth: new Date(dto.forTheMonth) } },
    });

    if (existingHistory) {
      await this.prisma.employeeMaturityHistory.update({
        where: { id: existingHistory.id },
        data: {
          maturityValue: dto.maturityValue ?? existingHistory.maturityValue,
          remarks: dto.remarks ?? existingHistory.remarks,
          isActive: dto.isActive ?? existingHistory.isActive,
          updatedById: actorId,
          updatedAt: new Date(),
        },
      });
    } else {
      if (dto.maturityValue === undefined) {
        throw new BadRequestException('maturityValue is required when recording a new month');
      }
      await this.prisma.employeeMaturityHistory.create({
        data: {
          employeeMaturityId: main.id,
          userId,
          userName: main.userName,
          maturityValue: dto.maturityValue,
          forTheMonth: new Date(dto.forTheMonth),
          isActive: dto.isActive ?? true,
          remarks: dto.remarks,
          createdById: actorId,
        },
      });
    }

    const latest = await this.prisma.employeeMaturityHistory.findFirst({
      where: { userId },
      orderBy: { forTheMonth: 'desc' },
    });

    return this.prisma.employeeMaturity.update({
      where: { id: main.id },
      data: {
        currentMaturityValue: latest!.maturityValue,
        forTheMonth: latest!.forTheMonth,
        remarks: latest!.remarks,
        isActive: latest!.isActive,
        updatedById: actorId,
      },
    });
  }

  async findAll(query: QueryMaturityDto) {
    const where: any = {};
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';
    if (query.search) {
      where.OR = [
        { userName: { contains: query.search, mode: 'insensitive' } },
        { remarks: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.employeeMaturity.findMany({
      where,
      include: {
        user: { select: { id: true, departmentId: true, roleId: true } },
      },
      orderBy: { userName: 'asc' },
    });
  }

  async findOne(userId: string) {
    const record = await this.prisma.employeeMaturity.findUnique({
      where: { userId },
      include: { user: { select: { id: true, departmentId: true, roleId: true } } },
    });
    if (!record) throw new NotFoundException(`Maturity record not found for user ${userId}`);
    return record;
  }

  // Full month-by-month history for one employee, newest month first — powers the
  // expandable history row on the /maturity page.
  async getHistory(userId: string) {
    return this.prisma.employeeMaturityHistory.findMany({
      where: { userId },
      orderBy: { forTheMonth: 'desc' },
    });
  }

  async getReport(query: MaturityReportQueryDto) {
    const year = query.year ?? new Date().getFullYear();
    const startMonth = query.startMonth ? new Date(query.startMonth) : new Date(`${year}-01-01`);
    const endMonth = query.endMonth ? new Date(query.endMonth) : new Date(`${year}-12-31`);

    const where: any = {
      forTheMonth: { gte: startMonth, lte: endMonth },
    };
    if (query.userId) where.userId = query.userId;
    if (query.search) where.userName = { contains: query.search, mode: 'insensitive' };
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';

    const userFilter: any = {};
    if (query.departmentId) userFilter.departmentId = query.departmentId;
    if (query.roleId) userFilter.roleId = query.roleId;
    if (Object.keys(userFilter).length) where.user = userFilter;

    if (query.projectId) {
      const allocations = await this.prisma.allocation.findMany({
        where: {
          projectId: query.projectId,
          startDate: { lte: endMonth },
          endDate: { gte: startMonth },
        },
        select: { userId: true },
      });
      const allocatedUserIds = allocations.map((a) => a.userId).filter((id): id is string => !!id);
      where.userId = where.userId
        ? (allocatedUserIds.includes(where.userId) ? where.userId : '__none__')
        : { in: allocatedUserIds };
    }

    const rows = await this.prisma.employeeMaturityHistory.findMany({
      where,
      include: {
        user: { select: { id: true, departmentId: true, roleId: true } },
      },
      orderBy: [{ userName: 'asc' }, { forTheMonth: 'asc' }],
    });

    const grouped = new Map<string, { userId: string; userName: string; points: { forTheMonth: Date; maturityValue: number }[] }>();
    for (const row of rows) {
      if (!grouped.has(row.userId)) {
        grouped.set(row.userId, { userId: row.userId, userName: row.userName, points: [] });
      }
      grouped.get(row.userId)!.points.push({ forTheMonth: row.forTheMonth, maturityValue: row.maturityValue });
    }

    return { rows, grouped: Array.from(grouped.values()) };
  }

  async buildTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    const templateSheet = workbook.addWorksheet('Template');
    const headerRow = templateSheet.addRow(['Employee Email', 'For The Month', 'Maturity Value', 'Remarks', 'Is Active']);
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B579A' } };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    templateSheet.addRow(['jane.doe@company.com', 'Jun-2026', 0.7, 'Fair, completing tasks steadily', 'TRUE']);
    templateSheet.columns.forEach((col) => {
      const lengths = (col.values as any[]).filter((v) => v != null).map((v) => String(v).length);
      // Plain loop, not Math.max(...lengths) — spreading a large array into a
      // function call blows V8's call-stack limit on wide sheets.
      col.width = lengths.reduce((max, len) => (len > max ? len : max), 10) + 2;
    });

    const employeesSheet = workbook.addWorksheet('Employees');
    const empHeaderRow = employeesSheet.addRow(['Email', 'Full Name', 'Department']);
    empHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B579A' } };
    empHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    const employees = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { email: true, firstName: true, lastName: true, department: { select: { name: true } } },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    for (const emp of employees) {
      employeesSheet.addRow([emp.email, [emp.firstName, emp.lastName].filter(Boolean).join(' '), emp.department?.name ?? '']);
    }
    employeesSheet.columns.forEach((col) => {
      const lengths = (col.values as any[]).filter((v) => v != null).map((v) => String(v).length);
      // Plain loop, not Math.max(...lengths) — spreading a large array into a
      // function call blows V8's call-stack limit on wide sheets.
      col.width = lengths.reduce((max, len) => (len > max ? len : max), 10) + 2;
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async bulkUpload(file: Express.Multer.File, actorId: string): Promise<MaturityBulkUploadResult> {
    const workbook = new ExcelJS.Workbook();

    try {
      if (file.originalname.endsWith('.csv')) {
        const stream = new Readable();
        stream.push(file.buffer);
        stream.push(null);
        await workbook.csv.read(stream);
      } else {
        await (workbook.xlsx as any).load(file.buffer);
      }
    } catch {
      throw new BadRequestException('Could not parse file. Please upload a valid .xlsx or .csv file.');
    }

    const worksheet = workbook.getWorksheet('Template') ?? workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException('File contains no worksheets.');

    const headerRow = worksheet.getRow(1).values as string[];
    const colIndex: Record<string, number> = {};
    (headerRow as any[]).forEach((h, i) => {
      if (h) colIndex[normaliseHeader(h)] = i;
    });

    const emailCol = colIndex['employeeemail'];
    const monthCol = colIndex['forthemonth'];
    const valueCol = colIndex['maturityvalue'];
    const remarksCol = colIndex['remarks'];
    const activeCol = colIndex['isactive'];

    if (emailCol === undefined || monthCol === undefined || valueCol === undefined) {
      throw new BadRequestException(
        'Missing required columns. Expected: "Employee Email", "For The Month", "Maturity Value".',
      );
    }

    const totalRows = worksheet.rowCount;
    if (totalRows - 1 > 2000) {
      throw new BadRequestException('File contains too many rows. Please upload at most 2000 rows at a time.');
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let duplicates = 0;
    let unchanged = 0;
    const errors: { row: number; message: string }[] = [];
    // Tracks fully-identical rows already processed in THIS file (userId + month + value + remarks + isActive),
    // so a repeated row is ignored rather than silently re-applied as a no-op "update".
    const seenRowSignatures = new Set<string>();

    // Pre-fetch distinct emails referenced in the file to avoid N+1 lookups
    const distinctEmails = new Set<string>();
    for (let rowNum = 2; rowNum <= totalRows; rowNum++) {
      const raw = (worksheet.getRow(rowNum).getCell(emailCol).value ?? '').toString().trim();
      if (raw) distinctEmails.add(raw.toLowerCase());
    }
    const matchingUsers = await this.prisma.user.findMany({
      where: { email: { in: Array.from(distinctEmails) } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    const userByEmail = new Map(matchingUsers.map((u) => [u.email.toLowerCase(), u]));
    const existingMainRows = await this.prisma.employeeMaturity.findMany({
      where: { userId: { in: matchingUsers.map((u) => u.id) } },
      select: { userId: true },
    });
    const knownUserIds = new Set(existingMainRows.map((r) => r.userId));

    // Pre-fetch existing history rows so we can skip rows that already match the DB exactly
    // (no pointless write / audit noise on re-uploads). Keyed by `${userId}::${monthIso}`.
    const existingHistory = await this.prisma.employeeMaturityHistory.findMany({
      where: { userId: { in: matchingUsers.map((u) => u.id) } },
      select: { userId: true, forTheMonth: true, maturityValue: true, remarks: true, isActive: true },
    });
    const historyByKey = new Map<string, { maturityValue: number; remarks: string | null; isActive: boolean }>();
    for (const h of existingHistory) {
      historyByKey.set(`${h.userId}::${toFirstOfMonthIso(h.forTheMonth)}`, {
        maturityValue: h.maturityValue,
        remarks: h.remarks,
        isActive: h.isActive,
      });
    }

    for (let rowNum = 2; rowNum <= totalRows; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const rawEmail = (row.getCell(emailCol).value ?? '').toString().trim();
      const monthCellValue = row.getCell(monthCol).value;
      const monthCellEmpty = monthCellValue === null || monthCellValue === undefined || monthCellValue === '';
      const rawValue = (row.getCell(valueCol).value ?? '').toString().trim();
      const rawRemarks = remarksCol ? (row.getCell(remarksCol).value ?? '').toString().trim() : '';
      const rawActive = activeCol ? (row.getCell(activeCol).value ?? '').toString().trim() : '';

      if (!rawEmail && monthCellEmpty && !rawValue) {
        skipped++;
        continue;
      }

      if (!rawEmail || monthCellEmpty || !rawValue) {
        errors.push({ row: rowNum, message: 'Employee Email, For The Month and Maturity Value are all required.' });
        continue;
      }

      const forTheMonth = extractMonthYear(monthCellValue);
      if (!forTheMonth) {
        errors.push({
          row: rowNum,
          message: `Invalid "For The Month" value "${displayCellValue(monthCellValue)}". Expected format: MMM-YYYY (e.g. Jun-2026).`,
        });
        continue;
      }

      const maturityValue = Number(rawValue);
      if (Number.isNaN(maturityValue)) {
        errors.push({ row: rowNum, message: `Invalid "Maturity Value" value "${rawValue}". Expected a number.` });
        continue;
      }

      const user = userByEmail.get(rawEmail.toLowerCase());
      if (!user) {
        errors.push({ row: rowNum, message: `No employee found with email "${rawEmail}".` });
        continue;
      }

      const isActive = rawActive ? rawActive.toLowerCase() === 'true' : true;
      const forTheMonthIso = toFirstOfMonthIso(forTheMonth);

      const signature = `${user.id}::${forTheMonthIso}::${maturityValue}::${rawRemarks.toLowerCase()}::${isActive}`;
      if (seenRowSignatures.has(signature)) {
        duplicates++;
        continue;
      }
      seenRowSignatures.add(signature);

      const historyKey = `${user.id}::${forTheMonthIso}`;
      const existing = historyByKey.get(historyKey);

      try {
        if (!knownUserIds.has(user.id)) {
          await this.create(
            {
              userId: user.id,
              currentMaturityValue: maturityValue,
              forTheMonth: forTheMonthIso,
              remarks: rawRemarks || undefined,
              isActive,
            },
            actorId,
          );
          knownUserIds.add(user.id);
          historyByKey.set(historyKey, { maturityValue, remarks: rawRemarks || null, isActive });
          created++;
        } else if (
          existing &&
          existing.maturityValue === maturityValue &&
          (existing.remarks ?? '') === rawRemarks &&
          existing.isActive === isActive
        ) {
          // Month already present in the DB with identical values — leave it untouched.
          unchanged++;
        } else {
          await this.update(
            user.id,
            {
              forTheMonth: forTheMonthIso,
              maturityValue,
              remarks: rawRemarks || undefined,
              isActive,
            },
            actorId,
          );
          historyByKey.set(historyKey, { maturityValue, remarks: rawRemarks || null, isActive });
          updated++;
        }
      } catch (err: any) {
        errors.push({ row: rowNum, message: err?.message ?? 'Unknown error' });
      }
    }

    return { created, updated, skipped, duplicates, unchanged, errors };
  }
}
