CREATE TABLE "Schedule" (
  "scheduleId" TEXT NOT NULL PRIMARY KEY,
  "center" TEXT,
  "location" TEXT,
  "category" TEXT,
  "startDateTime" DATETIME,
  "endDateTime" DATETIME,
  "remainingCapacity" INTEGER,
  "maximumCapacity" INTEGER,
  "lastSeen" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Snapshot" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Change" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "scheduleId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "oldValue" TEXT,
  "newValue" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
