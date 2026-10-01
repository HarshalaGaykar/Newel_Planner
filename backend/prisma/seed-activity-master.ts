import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const masterData = [
  // Observation (Incident Management)
  { taskType: 'OBSERVATION', activity: 'Incident Management', subActivity: 'Ticket Triage', meaning: 'Understand issue, set priority, assign owner' },
  { taskType: 'OBSERVATION', activity: 'Incident Management', subActivity: 'Issue Resolution', meaning: 'Find root cause, apply fix, validate' },
  { taskType: 'OBSERVATION', activity: 'Incident Management', subActivity: 'RCA Documentation', meaning: 'Prepare RCA and closure notes' },
  { taskType: 'OBSERVATION', activity: 'Access Management', subActivity: 'Access Grant / Change', meaning: 'Give, modify, or revoke access' },
  { taskType: 'OBSERVATION', activity: 'Configuration Change', subActivity: 'Config / Parameter Change', meaning: 'Feature toggle or configuration update' },
  { taskType: 'OBSERVATION', activity: 'Data Fix / Correction', subActivity: 'Data Analysis', meaning: 'Identify incorrect or missing data' },
  { taskType: 'OBSERVATION', activity: 'Data Fix / Correction', subActivity: 'Data Fix Execution', meaning: 'SQL script or data correction' },
  { taskType: 'OBSERVATION', activity: 'Data Fix / Correction', subActivity: 'Data Validation', meaning: 'Verify data after fix' },
  { taskType: 'OBSERVATION', activity: 'Issue Analysis', subActivity: 'Log Analysis', meaning: 'Review application/system logs' },
  { taskType: 'OBSERVATION', activity: 'Issue Analysis', subActivity: 'Code Debugging', meaning: 'Debug code to find issue' },
  { taskType: 'OBSERVATION', activity: 'Fix Development', subActivity: 'Fix / Patch Development', meaning: 'Develop fix or hot patch' },
  { taskType: 'OBSERVATION', activity: 'Fix Development', subActivity: 'Code Review', meaning: 'Peer review of fix' },
  { taskType: 'OBSERVATION', activity: 'Testing', subActivity: 'Fix Testing', meaning: 'Test fix in lower environment' },
  { taskType: 'OBSERVATION', activity: 'Deployment', subActivity: 'Patch Preparation', meaning: 'Prepare patch for deployment' },
  { taskType: 'OBSERVATION', activity: 'Deployment', subActivity: 'Deploy to QA', meaning: 'Deploy fix to QA environment' },
  { taskType: 'OBSERVATION', activity: 'Deployment', subActivity: 'Deploy to Production', meaning: 'Deploy fix to production' },
  { taskType: 'OBSERVATION', activity: 'Deployment', subActivity: 'Post-Deployment Check', meaning: 'Health check and log verification' },
  { taskType: 'OBSERVATION', activity: 'Deployment', subActivity: 'Rollback', meaning: 'Rollback if issue occurs' },
  { taskType: 'OBSERVATION', activity: 'Monitoring & Alerts', subActivity: 'Monitoring Review', meaning: 'Daily monitoring and alert checks' },
  { taskType: 'OBSERVATION', activity: 'Monitoring & Alerts', subActivity: 'Preventive Improvement', meaning: 'Improve alerts, scripts, monitoring' },
  
  // Change Request
  { taskType: 'CHANGE_REQUEST', activity: 'Requirement Gathering', subActivity: 'Stakeholder Discussion', meaning: 'Requirement meetings and discussions' },
  { taskType: 'CHANGE_REQUEST', activity: 'Requirement Gathering', subActivity: 'Requirement Documentation', meaning: 'BRD, FRS, use cases' },
  { taskType: 'CHANGE_REQUEST', activity: 'Design', subActivity: 'Solution Design', meaning: 'Architecture, DB, API design' },
  { taskType: 'CHANGE_REQUEST', activity: 'Design', subActivity: 'Design Review', meaning: 'Design walkthrough and approval' },
  { taskType: 'CHANGE_REQUEST', activity: 'Development', subActivity: 'Feature Development', meaning: 'Backend / frontend code' },
  { taskType: 'CHANGE_REQUEST', activity: 'Development', subActivity: 'Code Refactoring', meaning: 'Improve or optimize existing code' },
  { taskType: 'CHANGE_REQUEST', activity: 'Development', subActivity: 'Unit Testing', meaning: 'Write and run unit tests' },
  { taskType: 'CHANGE_REQUEST', activity: 'Code Review', subActivity: 'Peer Code Review', meaning: 'Review code quality' },
  { taskType: 'CHANGE_REQUEST', activity: 'Testing', subActivity: 'Integration Testing', meaning: 'End-to-end flow testing' },
  { taskType: 'CHANGE_REQUEST', activity: 'Testing', subActivity: 'UAT Support', meaning: 'Fix UAT issues, data setup' },
  { taskType: 'CHANGE_REQUEST', activity: 'Testing', subActivity: 'Regression Testing', meaning: 'Validate existing functionality' },
  { taskType: 'CHANGE_REQUEST', activity: 'Deployment', subActivity: 'Deployment Planning', meaning: 'Release plan and rollback plan' },
  { taskType: 'CHANGE_REQUEST', activity: 'Deployment', subActivity: 'Environment Setup', meaning: 'Prepare DEV / QA / UAT' },
  { taskType: 'CHANGE_REQUEST', activity: 'Deployment', subActivity: 'Build Creation', meaning: 'Create build or artifact' },
  { taskType: 'CHANGE_REQUEST', activity: 'Deployment', subActivity: 'CI/CD Execution', meaning: 'Run Jenkins / pipeline' },
  { taskType: 'CHANGE_REQUEST', activity: 'Deployment', subActivity: 'Deploy to DEV', meaning: 'Deployment to DEV' },
  { taskType: 'CHANGE_REQUEST', activity: 'Deployment', subActivity: 'Deploy to QA', meaning: 'Deployment to QA' },
  { taskType: 'CHANGE_REQUEST', activity: 'Deployment', subActivity: 'Deploy to UAT', meaning: 'Deployment to UAT' },
  { taskType: 'CHANGE_REQUEST', activity: 'Deployment', subActivity: 'Deploy to Production', meaning: 'Production release' },
  { taskType: 'CHANGE_REQUEST', activity: 'Deployment', subActivity: 'Post-Deployment Validation', meaning: 'Smoke and sanity testing' },
  { taskType: 'CHANGE_REQUEST', activity: 'Deployment', subActivity: 'Rollback / Hotfix', meaning: 'Emergency fix or rollback' },
  { taskType: 'CHANGE_REQUEST', activity: 'Deployment', subActivity: 'Deployment Sign-off', meaning: 'Final release approval' },
  { taskType: 'CHANGE_REQUEST', activity: 'Documentation', subActivity: 'Technical Documentation', meaning: 'Tech and API documents' },
  { taskType: 'CHANGE_REQUEST', activity: 'Documentation', subActivity: 'User Documentation', meaning: 'User guide, FAQs, release notes' },
  { taskType: 'CHANGE_REQUEST', activity: 'Project Management', subActivity: 'Planning & Estimation', meaning: 'Effort estimation and planning' },
  { taskType: 'CHANGE_REQUEST', activity: 'Project Management', subActivity: 'Review & Retrospective', meaning: 'Demo, review, RCA' },
  { taskType: 'CHANGE_REQUEST', activity: 'Reporting & Audit', subActivity: 'Status / SLA Reporting', meaning: 'Daily or weekly reports' },
  { taskType: 'CHANGE_REQUEST', activity: 'Reporting & Audit', subActivity: 'SOP / KT Update', meaning: 'SOP and knowledge updates' },
  { taskType: 'CHANGE_REQUEST', activity: 'Coordination', subActivity: 'CAB / Change Approval', meaning: 'Change approval meetings' },
  { taskType: 'CHANGE_REQUEST', activity: 'Coordination', subActivity: 'Daily Sync & Escalation', meaning: 'Stand-ups and escalation handling' },
];

async function main() {
  console.log('Seeding TimesheetActivityMaster...');
  for (const item of masterData) {
    await prisma.timesheetActivityMaster.upsert({
      where: {
        taskType_activity_subActivity: {
          taskType: item.taskType as any,
          activity: item.activity,
          subActivity: item.subActivity,
        },
      },
      update: { meaning: item.meaning },
      create: {
        taskType: item.taskType as any,
        activity: item.activity,
        subActivity: item.subActivity,
        meaning: item.meaning,
      },
    });
  }
  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
