import { ApplicationStatus } from "@prisma/client";
import { forbidden } from "../http/errors.js";
import { prisma } from "./prisma.js";

export async function requireApprovedApplication(userId: string, cohortId: string) {
  const application = await prisma.application.findUnique({
    where: {
      userId_cohortId: {
        userId,
        cohortId
      }
    },
    include: {
      cohort: {
        select: {
          practiceStart: true,
          practiceEnd: true,
          completedAt: true
        }
      }
    }
  });

  if (!application || application.status !== ApplicationStatus.APPROVED) {
    throw forbidden("Для доступа нужна одобренная заявка в эту когорту");
  }

  return application;
}
