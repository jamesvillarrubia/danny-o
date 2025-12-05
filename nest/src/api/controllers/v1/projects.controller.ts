/**
 * Projects Controller (v1)
 * 
 * RESTful project management API following Google API Design Guide.
 * Projects are read-only as they're managed in Todoist.
 * 
 * Standard Methods:
 * - GET    /v1/projects              - List projects
 * - GET    /v1/projects/:projectId   - Get a project
 */

import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { IStorageAdapter, Project } from '../../../common/interfaces';
import { PaginationQueryDto } from '../../dto';

/**
 * Project response DTO
 */
interface ProjectResponseDto {
  id: string;
  name: string;
  color?: string;
  parentId?: string | null;
  order?: number;
  isInboxProject?: boolean;
  isFavorite?: boolean;
}

/**
 * List projects response
 */
interface ListProjectsResponseDto {
  projects: ProjectResponseDto[];
  totalCount: number;
  nextPageToken?: string;
}

@Controller('v1/projects')
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name);

  constructor(
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
  ) {}

  /**
   * List all projects
   * GET /v1/projects
   */
  @Get()
  async listProjects(@Query() query: PaginationQueryDto): Promise<ListProjectsResponseDto> {
    this.logger.log('Listing projects');

    const projects = await this.storage.getProjects();
    const pageSize = query.pageSize ?? 20;
    const offset = query.pageToken ? parseInt(query.pageToken, 10) : 0;

    const paginatedProjects = projects.slice(offset, offset + pageSize);

    return {
      projects: paginatedProjects.map(this.mapProjectToResponse),
      totalCount: projects.length,
      nextPageToken: offset + paginatedProjects.length < projects.length
        ? String(offset + paginatedProjects.length)
        : undefined,
    };
  }

  /**
   * Get a single project by ID
   * GET /v1/projects/:projectId
   */
  @Get(':projectId')
  async getProject(@Param('projectId') projectId: string): Promise<ProjectResponseDto> {
    this.logger.log(`Getting project: ${projectId}`);

    const projects = await this.storage.getProjects();
    const project = projects.find((p) => p.id === projectId);

    if (!project) {
      throw new NotFoundException({
        error: {
          code: 404,
          message: `Project ${projectId} not found`,
          status: 'NOT_FOUND',
        },
      });
    }

    return this.mapProjectToResponse(project);
  }

  /**
   * Map internal project to response DTO
   */
  private mapProjectToResponse(project: Project): ProjectResponseDto {
    return {
      id: project.id,
      name: project.name,
      color: project.color,
      parentId: project.parentId,
      order: project.order,
      isInboxProject: project.isInboxProject,
      isFavorite: project.isFavorite,
    };
  }
}

