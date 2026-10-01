-- CreateTable
CREATE TABLE "TaskRemark" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskRemark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDueDateRevision" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "revisedBy" TEXT NOT NULL,
    "revisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskDueDateRevision_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TaskRemark" ADD CONSTRAINT "TaskRemark_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDueDateRevision" ADD CONSTRAINT "TaskDueDateRevision_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
