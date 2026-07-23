ALTER TABLE "applications"
ADD COLUMN "test_task_answer" TEXT,
ADD COLUMN "test_task_artifact_link" TEXT,
ADD COLUMN "test_task_file_url" TEXT,
ADD COLUMN "test_task_file_name" TEXT,
ADD COLUMN "test_task_submitted_at" TIMESTAMP(3),
ADD COLUMN "test_task_review_status" "ReportReviewStatus",
ADD COLUMN "test_task_review_comment" TEXT;
