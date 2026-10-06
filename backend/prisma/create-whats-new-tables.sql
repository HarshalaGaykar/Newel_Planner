CREATE TABLE IF NOT EXISTS "AppFeature" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "shortDescription" TEXT NOT NULL,
  "fullDescription" TEXT,
  "iconName" TEXT,
  "featureUrl" TEXT,
  "demoVideoUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppFeature_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AppFeatureRole" (
  "id" TEXT NOT NULL,
  "featureId" TEXT NOT NULL,
  "roleName" TEXT NOT NULL,
  CONSTRAINT "AppFeatureRole_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AppFeatureRole_featureId_roleName_key" UNIQUE ("featureId", "roleName"),
  CONSTRAINT "AppFeatureRole_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "AppFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AppFeatureInteraction" (
  "id" TEXT NOT NULL,
  "featureId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppFeatureInteraction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AppFeatureInteraction_featureId_userId_key" UNIQUE ("featureId", "userId"),
  CONSTRAINT "AppFeatureInteraction_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "AppFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AppFeatureInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AppFeatureRole_roleName_idx" ON "AppFeatureRole"("roleName");
CREATE INDEX IF NOT EXISTS "AppFeatureInteraction_userId_idx" ON "AppFeatureInteraction"("userId");
