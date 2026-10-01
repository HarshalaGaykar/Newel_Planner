import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const configs = [
  { key: 'timesheet.max_daily_hours', value: '24', label: 'Max Daily Hours', group: 'TIMESHEET' },
  { key: 'timesheet.backdated_days_limit', value: '7', label: 'Timesheet Creation Window (past days)', group: 'TIMESHEET' },
  // Working days logging fewer than this are highlighted as a shortfall in the
  // timesheet calendar. Weekends, public holidays and full-day leave are exempt.
  { key: 'timesheet.min_daily_hours', value: '7', label: 'Min Daily Hours', group: 'TIMESHEET' },
  { key: 'allocation.max_percentage', value: '100', label: 'Max Allocation %', group: 'ALLOCATION' },
  { key: 'leave.advance_days_required', value: '1', label: 'Advance Days Required', group: 'LEAVE' },
  { key: 'notification.approval_overdue_hours', value: '48', label: 'Approval Overdue Hours', group: 'NOTIFICATION' },
  { key: 'budget.alert_threshold_pct', value: '90', label: 'Budget Alert Threshold %', group: 'BUDGET' },
  // Project auto-dormancy cron. `enabled` and `threshold_months` are read live on each run;
  // schedule (`cron` wins if non-empty, else built from `run_time`) is read at app startup.
  { key: 'project.dormancy.enabled', value: 'true', label: 'Project Dormancy: Enabled', group: 'PROJECT' },
  { key: 'project.dormancy.run_time', value: '12:59', label: 'Project Dormancy: Run Time (HH:mm)', group: 'PROJECT' },
  { key: 'project.dormancy.threshold_months', value: '2', label: 'Project Dormancy: Inactivity Threshold (months)', group: 'PROJECT' },
  { key: 'project.dormancy.cron', value: '', label: 'Project Dormancy: Cron Expression (overrides Run Time)', group: 'PROJECT' },
  // Missing check-in reminder cron. `enabled` is read live on each run; schedule
  // (`cron` wins if non-empty, else built from `run_time`) and `time_zone` are read
  // at app startup / per run. Runs the next morning for the previous working day.
  { key: 'attendance.checkin_reminder.enabled', value: 'true', label: 'Check-in Reminder: Enabled', group: 'ATTENDANCE' },
  { key: 'attendance.checkin_reminder.run_time', value: '09:00', label: 'Check-in Reminder: Run Time (HH:mm)', group: 'ATTENDANCE' },
  { key: 'attendance.checkin_reminder.cron', value: '', label: 'Check-in Reminder: Cron Expression (overrides Run Time)', group: 'ATTENDANCE' },
  { key: 'attendance.checkin_reminder.time_zone', value: 'Asia/Kolkata', label: 'Check-in Reminder: Time Zone', group: 'ATTENDANCE' },
  // Monthly asset-allocation confirmation escalation. `enabled` is read live per run;
  // schedule (`cron` wins if set, else `run_time`) and `time_zone` set when the daily
  // job fires; the day_* values decide which stage runs on a given day of the month.
  // cc_email (Yogesh) is copied on the 7th-day reminder; escalation_email (Pravin) is
  // added on the 10th-day reminder. Leave the two emails blank to disable that copy.
  { key: 'asset.allocation_confirmation.enabled', value: 'true', label: 'Asset Confirmation: Enabled', group: 'ASSET' },
  { key: 'asset.allocation_confirmation.run_time', value: '09:00', label: 'Asset Confirmation: Run Time (HH:mm)', group: 'ASSET' },
  { key: 'asset.allocation_confirmation.cron', value: '', label: 'Asset Confirmation: Cron Expression (overrides Run Time)', group: 'ASSET' },
  { key: 'asset.allocation_confirmation.time_zone', value: 'Asia/Kolkata', label: 'Asset Confirmation: Time Zone', group: 'ASSET' },
  { key: 'asset.allocation_confirmation.day_initial', value: '1', label: 'Asset Confirmation: Initial Day', group: 'ASSET' },
  { key: 'asset.allocation_confirmation.day_reminder1', value: '5', label: 'Asset Confirmation: Reminder 1 Day', group: 'ASSET' },
  { key: 'asset.allocation_confirmation.day_reminder2', value: '7', label: 'Asset Confirmation: Reminder 2 Day (cc head)', group: 'ASSET' },
  { key: 'asset.allocation_confirmation.day_final', value: '10', label: 'Asset Confirmation: Final Day (escalate)', group: 'ASSET' },
  { key: 'asset.allocation_confirmation.cc_email', value: '', label: 'Asset Confirmation: CC Email (7th onward, e.g. Yogesh)', group: 'ASSET' },
  { key: 'asset.allocation_confirmation.escalation_email', value: '', label: 'Asset Confirmation: Escalation Email (10th, e.g. Pravin)', group: 'ASSET' },
];

export const numberSeries = [
  { module: 'PROJECT', prefix: 'PRJ', padding: 4, separator: '-' },
  { module: 'EMPLOYEE', prefix: 'EMP', padding: 4, separator: '-' },
  { module: 'FREELANCER', prefix: 'FRL', padding: 4, separator: '-' },
  { module: 'VENDOR', prefix: 'VND', padding: 4, separator: '-' },
  { module: 'CLIENT', prefix: 'CLT', padding: 4, separator: '-' },
  { module: 'INVOICE', prefix: 'INV', padding: 6, separator: '-' },
  { module: 'DEMAND', prefix: 'DEM', padding: 4, separator: '-' },
  { module: 'CR', prefix: 'CR', padding: 4, separator: '-' },
];

async function main() {
  for (const config of configs) {
    await prisma.adminConfig.upsert({
      where: { key: config.key },
      update: { label: config.label, group: config.group },
      create: config,
    });
  }

  for (const series of numberSeries) {
    await prisma.numberSeries.upsert({
      where: { module: series.module },
      update: {
        prefix: series.prefix,
        padding: series.padding,
        separator: series.separator,
      },
      create: series,
    });
  }

  await prisma.financialYear.upsert({
    where: { id: 'fy-2025-26' },
    update: {
      label: 'FY 2025-26',
      startMonth: 4,
      startYear: 2025,
      endMonth: 3,
      endYear: 2026,
      isCurrent: true,
    },
    create: {
      id: 'fy-2025-26',
      label: 'FY 2025-26',
      startMonth: 4,
      startYear: 2025,
      endMonth: 3,
      endYear: 2026,
      isCurrent: true,
    },
  });

  console.log('Seeded admin configuration, number series, and financial year.');
}

main()
  .catch((error) => {
    console.error('Admin configuration seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
