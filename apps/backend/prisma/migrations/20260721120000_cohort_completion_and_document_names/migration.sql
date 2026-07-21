ALTER TYPE "ApplicationStatus" ADD VALUE 'REMOVED';

ALTER TABLE "cohorts"
ADD COLUMN "completed_at" TIMESTAMP(3);

ALTER TABLE "student_document_data"
ADD COLUMN "student_fio_genitive" TEXT;
