import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CreateProjectInput, Project, UpdateProjectInput } from '@noto/shared';

import { ApiErrors } from '../lib/errors';
import { toPublicProject } from '../lib/utils';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateProjectInput): Promise<Project> {
    const project = await this.prisma.$transaction(async (tx) =>
      tx.project.create({
        data: {
          name: input.name,
          members: {
            create: { userId, role: 'owner' },
          },
        },
      }),
    );

    return toPublicProject(project);
  }

  async listForUser(userId: string): Promise<Project[]> {
    const memberships = await this.prisma.projectMember.findMany({
      where: {
        userId,
        project: { deletedAt: null },
      },
      include: { project: true },
      orderBy: { project: { createdAt: 'asc' } },
    });

    return memberships.map((membership) => toPublicProject(membership.project));
  }

  async getById(projectId: string): Promise<Project> {
    const project = await this.findActiveProject(projectId);
    return toPublicProject(project);
  }

  async update(projectId: string, input: UpdateProjectInput): Promise<Project> {
    try {
      const project = await this.prisma.project.update({
        where: { id: projectId, deletedAt: null },
        data: { name: input.name },
      });

      return toPublicProject(project);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw ApiErrors.notFound('Project not found');
      }

      throw error;
    }
  }

  async softDelete(projectId: string): Promise<void> {
    try {
      await this.prisma.project.update({
        where: { id: projectId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw ApiErrors.notFound('Project not found');
      }

      throw error;
    }
  }

  private async findActiveProject(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });

    if (!project) {
      throw ApiErrors.notFound('Project not found');
    }

    return project;
  }
}
