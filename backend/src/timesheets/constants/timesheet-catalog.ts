import { TimesheetTaskType } from '@prisma/client';

export interface CatalogStructure {
  [key: string]: {
    [subKey: string]: string;
  };
}

export const TIMESHEET_CATALOG: Record<TimesheetTaskType, CatalogStructure> = {
  [TimesheetTaskType.OBSERVATION]: {
    'Incident Management': {
      'Ticket Triage': 'Understand issue, set priority, assign owner',
      'Issue Resolution': 'Find root cause, apply fix, validate',
      'RCA Documentation': 'Prepare RCA and closure notes',
    },
    'Access Management': {
      'Access Grant / Change': 'Give, modify, or revoke access',
    },
    'Configuration Change': {
      'Config / Parameter Change': 'Feature toggle or configuration update',
    },
    'Data Fix / Correction': {
      'Data Analysis': 'Identify incorrect or missing data',
      'Data Fix Execution': 'SQL script or data correction',
      'Data Validation': 'Verify data after fix',
    },
    'Issue Analysis': {
      'Log Analysis': 'Review application/system logs',
      'Code Debugging': 'Debug code to find issue',
    },
    'Fix Development': {
      'Fix / Patch Development': 'Develop fix or hot patch',
      'Code Review': 'Peer review of fix',
    },
    'Testing': {
      'Fix Testing': 'Test fix in lower environment',
    },
    'Deployment': {
      'Patch Preparation': 'Prepare patch for deployment',
      'Deploy to QA': 'Deploy fix to QA environment',
      'Deploy to Production': 'Deploy fix to production',
      'Post-Deployment Check': 'Health check and log verification',
      'Rollback': 'Rollback if issue occurs',
    },
    'Monitoring & Alerts': {
      'Monitoring Review': 'Daily monitoring and alert checks',
      'Preventive Improvement': 'Improve alerts, scripts, monitoring',
    },
  },
  [TimesheetTaskType.CHANGE_REQUEST]: {
    'Requirement Gathering': {
      'Stakeholder Discussion': 'Requirement meetings and discussions',
      'Requirement Documentation': 'BRD, FRS, use cases',
    },
    'Design': {
      'Solution Design': 'Architecture, DB, API design',
      'Design Review': 'Design walkthrough and approval',
    },
    'Development': {
      'Feature Development': 'Backend / frontend code',
      'Code Refactoring': 'Improve or optimize existing code',
      'Unit Testing': 'Write and run unit tests',
    },
    'Code Review': {
      'Peer Code Review': 'Review code quality',
    },
    'Testing': {
      'Integration Testing': 'End-to-end flow testing',
      'UAT Support': 'Fix UAT issues, data setup',
      'Regression Testing': 'Validate existing functionality',
    },
    'Deployment': {
      'Deployment Planning': 'Release plan and rollback plan',
      'Environment Setup': 'Prepare DEV / QA / UAT',
      'Build Creation': 'Create build or artifact',
      'CI/CD Execution': 'Run Jenkins / pipeline',
      'Deploy to DEV': 'Deployment to DEV',
      'Deploy to QA': 'Deployment to QA',
      'Deploy to UAT': 'Deployment to UAT',
      'Deploy to Production': 'Production release',
      'Post-Deployment Validation': 'Smoke and sanity testing',
      'Rollback / Hotfix': 'Emergency fix or rollback',
      'Deployment Sign-off': 'Final release approval',
    },
    'Documentation': {
      'Technical Documentation': 'Tech and API documents',
      'User Documentation': 'User guide, FAQs, release notes',
    },
    'Project Management': {
      'Planning & Estimation': 'Effort estimation and planning',
      'Review & Retrospective': 'Demo, review, RCA',
    },
    'Reporting & Audit': {
      'Status / SLA Reporting': 'Daily or weekly reports',
      'SOP / KT Update': 'SOP and knowledge updates',
    },
    'Coordination': {
      'CAB / Change Approval': 'Change approval meetings',
      'Daily Sync & Escalation': 'Stand-ups and escalation handling',
    },
  },
};
