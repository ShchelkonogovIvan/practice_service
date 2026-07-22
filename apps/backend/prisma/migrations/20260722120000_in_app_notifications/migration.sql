CREATE TYPE "NotificationType" AS ENUM ('APPLICATION_DECISION', 'APPLICATION_SUBMITTED', 'TEST_TASK', 'REPORT_REVIEW', 'REPORT_UPLOADED');
CREATE TYPE "NotificationSection" AS ENUM ('APPLICATIONS', 'DOCUMENTS', 'TASKS');

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "section" "NotificationSection" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
