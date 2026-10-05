import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { UsersModule } from './users/users.module';
import { MenuModule } from './menu/menu.module';
import { PermissionsModule } from './permissions/permissions.module';
import { DepartmentsModule } from './departments/departments.module';
import { SkillsModule } from './skills/skills.module';
import { SkillCategoryModule } from './skill-category/skill-category.module';
import { RolesModule } from './roles/roles.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { TicketsModule } from './tickets/tickets.module';
import { TimesheetsModule } from './timesheets/timesheets.module';
import { MilestonesModule } from './milestones/milestones.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { LeavesModule } from './leaves/leaves.module';
import { AllocationsModule } from './allocations/allocations.module';
import { ReportsModule } from './reports/reports.module';
import { EstimationModule } from './estimation/estimation.module';
import { AllocationInsightsModule } from './allocation-insights/allocation-insights.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { AnomaliesModule } from './anomalies/anomalies.module';
import { FinanceModule } from './finance/finance.module';
import { PublicHolidaysModule } from './public-holidays/public-holidays.module';
import { CompOffModule } from './comp-off/comp-off.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { FreelancersModule } from './freelancers/freelancers.module';
// Org Masters
import { CompanyModule } from './company/company.module';
import { BusinessUnitModule } from './business-unit/business-unit.module';
import { LocationModule } from './location/location.module';
import { ShiftModule } from './shift/shift.module';
import { CurrencyModule } from './currency/currency.module';
import { CostCenterModule } from './cost-center/cost-center.module';
import { ProfitCenterModule } from './profit-center/profit-center.module';
import { LeaveTypeMasterModule } from './leave-type-master/leave-type-master.module';
import { PriorityMasterModule } from './priority-master/priority-master.module';
import { ClientsModule } from './clients/clients.module';
import { VendorsModule } from './vendors/vendors.module';
import { WorkflowModule } from './workflow/workflow.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminConfigModule } from './admin-config/admin-config.module';
import { DemandsModule } from './demands/demands.module';
import { ChangeRequestsModule } from './change-requests/change-requests.module';
import { DocumentsModule } from './documents/documents.module';
import { SprintsModule } from './sprints/sprints.module';
import { RisksModule } from './risks/risks.module';
import { IssuesModule } from './issues/issues.module';
import { DependenciesModule } from './dependencies/dependencies.module';
import { CapacityModule } from './capacity/capacity.module';
import { BaselinesModule } from './baselines/baselines.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { TrainingModule } from './training/training.module';
import { DeliveryTrackerModule } from './delivery-tracker/delivery-tracker.module';
import { DeliveryStageMasterModule } from './delivery-stage-master/delivery-stage-master.module';
import { ProjectRecipientsModule } from './project-recipients/project-recipients.module';
import { QuestionBanksModule } from './question-banks/question-banks.module';
import { QuestionsModule } from './questions/questions.module';
import { TestsModule } from './tests/tests.module';
import { TestAttemptsModule } from './test-attempts/test-attempts.module';
import { TestManagementModule } from './test-management/test-management.module';
import { DeploymentsModule } from './deployments/deployments.module';
import { AssetsModule } from './assets/assets.module';
import { SpokespersonsModule } from './spokespersons/spokespersons.module';
import { AssetConfirmationsModule } from './asset-confirmations/asset-confirmations.module';
import { ActivitiesModule } from './activities/activities.module';
import { TaskTypeMasterModule } from './task-type-master/task-type-master.module';
import { AdvancedAnalyticsModule } from './advanced-analytics/advanced-analytics.module';
import { MaturityModule } from './maturity/maturity.module';
import { TlDashboardModule } from './tl-dashboard/tl-dashboard.module';
import { WhatsNewModule } from './whats-new/whats-new.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}`,
        '.env',
      ],
      expandVariables: true,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    MenuModule,
    PermissionsModule,
    DepartmentsModule,
    SkillsModule,
    SkillCategoryModule,
    RolesModule,
    ProjectsModule,
    TasksModule,
    TicketsModule,
    TimesheetsModule,
    MilestonesModule,
    DashboardModule,
    TlDashboardModule,
    LeavesModule,
    AllocationsModule,
    ReportsModule,
    EstimationModule,
    AllocationInsightsModule,
    RecommendationsModule,
    AnomaliesModule,
    FinanceModule,
    PublicHolidaysModule,
    CompOffModule,
    AttendanceModule,
    // Org Masters
    CompanyModule,
    BusinessUnitModule,
    LocationModule,
    ShiftModule,
    CurrencyModule,
    CostCenterModule,
    ProfitCenterModule,
    LeaveTypeMasterModule,
    PriorityMasterModule,
    ClientsModule,
    FreelancersModule,
    VendorsModule,
    WorkflowModule,
    NotificationsModule,
    AdminConfigModule,
    DemandsModule,
    ChangeRequestsModule,
    DocumentsModule,
    SprintsModule,
    RisksModule,
    IssuesModule,
    DependenciesModule,
    CapacityModule,
    BaselinesModule,
    AuditLogsModule,
    TrainingModule,
    DeliveryTrackerModule,
    DeliveryStageMasterModule,
    ProjectRecipientsModule,
    QuestionBanksModule,
    QuestionsModule,
    TestsModule,
    TestAttemptsModule,
    TestManagementModule,
    DeploymentsModule,
    AssetsModule,
    SpokespersonsModule,
    AssetConfirmationsModule,
    ActivitiesModule,
    AdvancedAnalyticsModule,
    TaskTypeMasterModule,
    MaturityModule,
    WhatsNewModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
