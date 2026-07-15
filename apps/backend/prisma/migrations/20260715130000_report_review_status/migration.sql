CREATE TYPE "ReportReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED');

ALTER TABLE "student_document_data"
ADD COLUMN "report_review_status" "ReportReviewStatus",
ADD COLUMN "report_review_comment" TEXT;

UPDATE "student_document_data"
SET "report_review_status" = CASE
  WHEN "report_file_url" IS NULL THEN NULL
  WHEN "report_admin_approved" = TRUE THEN 'APPROVED'::"ReportReviewStatus"
  ELSE 'PENDING'::"ReportReviewStatus"
END;

ALTER TABLE "student_document_data"
DROP COLUMN "report_admin_approved";
