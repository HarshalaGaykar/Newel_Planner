import { PrismaClient, TimesheetTaskType } from '@prisma/client';

const prisma = new PrismaClient();

const activityMasterData = [
  { taskType: TimesheetTaskType.OBSERVATION, activity: 'Incident Management', subActivity: 'Ticket Triage', meaning: 'Understand issue, set priority, assign owner' },
  { taskType: TimesheetTaskType.OBSERVATION, activity: 'Incident Management', subActivity: 'Issue Resolution', meaning: 'Find root cause, apply fix, validate' },
  { taskType: TimesheetTaskType.OBSERVATION, activity: 'Incident Management', subActivity: 'RCA Documentation', meaning: 'Prepare RCA and closure notes' },
  { taskType: TimesheetTaskType.OBSERVATION, activity: 'Fix Development', subActivity: 'Fix / Patch Development', meaning: 'Develop fix or hot patch' },
  { taskType: TimesheetTaskType.OBSERVATION, activity: 'Fix Development', subActivity: 'Code Review', meaning: 'Peer review of fix' },
  { taskType: TimesheetTaskType.OBSERVATION, activity: 'Testing', subActivity: 'Fix Testing', meaning: 'Test fix in lower environment' },
  { taskType: TimesheetTaskType.OBSERVATION, activity: 'Deployment', subActivity: 'Deploy to Production', meaning: 'Deploy fix to production' },
  { taskType: TimesheetTaskType.OBSERVATION, activity: 'Monitoring & Alerts', subActivity: 'Monitoring Review', meaning: 'Daily monitoring and alert checks' },
  { taskType: TimesheetTaskType.CHANGE_REQUEST, activity: 'Requirement Gathering', subActivity: 'Stakeholder Discussion', meaning: 'Requirement meetings and discussions' },
  { taskType: TimesheetTaskType.CHANGE_REQUEST, activity: 'Requirement Gathering', subActivity: 'Requirement Documentation', meaning: 'BRD, FRS, use cases' },
  { taskType: TimesheetTaskType.CHANGE_REQUEST, activity: 'Development', subActivity: 'Feature Development', meaning: 'Feature implementation' },
  { taskType: TimesheetTaskType.CHANGE_REQUEST, activity: 'Development', subActivity: 'Code Review', meaning: 'Review of new feature code' },
  { taskType: TimesheetTaskType.CHANGE_REQUEST, activity: 'Testing', subActivity: 'Unit Testing', meaning: 'Developer unit tests' },
  { taskType: TimesheetTaskType.CHANGE_REQUEST, activity: 'Testing', subActivity: 'UAT Support', meaning: 'Support user acceptance testing' },
  { taskType: TimesheetTaskType.CHANGE_REQUEST, activity: 'Deployment', subActivity: 'Release Preparation', meaning: 'Prepare release notes and deploy artifacts' },
];

async function main() {
  for (const activity of activityMasterData) {
    await prisma.timesheetActivityMaster.upsert({
      where: {
        taskType_activity_subActivity: {
          taskType: activity.taskType,
          activity: activity.activity,
          subActivity: activity.subActivity,
        },
      },
      update: { meaning: activity.meaning },
      create: activity,
    });
  }

  console.log('Seeded timesheet activity master.');
}

main()
  .catch((error) => {
    console.error('Timesheet activity master seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
