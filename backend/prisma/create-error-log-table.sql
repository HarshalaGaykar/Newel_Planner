CREATE TABLE IF NOT EXISTS "ErrorLog" (
  "id"            TEXT NOT NULL,
  "method"        TEXT NOT NULL,
  "url"           TEXT NOT NULL,
  "module"        TEXT NOT NULL,
  "statusCode"    INTEGER NOT NULL,
  "errorMessage"  TEXT NOT NULL,
  "errorStack"    TEXT,
  "userId"        TEXT,
  "ipAddress"     TEXT,
  "requestBody"   JSONB,
  "requestQuery"  JSONB,
  "requestParams" JSONB,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ErrorLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ErrorLog_module_idx"     ON "ErrorLog"("module");
CREATE INDEX IF NOT EXISTS "ErrorLog_statusCode_idx" ON "ErrorLog"("statusCode");
CREATE INDEX IF NOT EXISTS "ErrorLog_userId_idx"     ON "ErrorLog"("userId");
CREATE INDEX IF NOT EXISTS "ErrorLog_createdAt_idx"  ON "ErrorLog"("createdAt");
CREATE INDEX IF NOT EXISTS "ErrorLog_method_idx"     ON "ErrorLog"("method");
