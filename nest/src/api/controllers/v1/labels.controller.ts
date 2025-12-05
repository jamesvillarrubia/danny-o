/**
 * Labels Controller (v1)
 * 
 * RESTful label management API following Google API Design Guide.
 * Labels are read-only as they're managed in Todoist.
 * 
 * Standard Methods:
 * - GET    /v1/labels            - List labels
 * - GET    /v1/labels/:labelId   - Get a label
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
import { IStorageAdapter, Label } from '../../../common/interfaces';
import { PaginationQueryDto } from '../../dto';

/**
 * Label response DTO
 */
interface LabelResponseDto {
  id: string;
  name: string;
  color?: string;
  order?: number;
  isFavorite?: boolean;
}

/**
 * List labels response
 */
interface ListLabelsResponseDto {
  labels: LabelResponseDto[];
  totalCount: number;
  nextPageToken?: string;
}

@Controller('v1/labels')
export class LabelsController {
  private readonly logger = new Logger(LabelsController.name);

  constructor(
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
  ) {}

  /**
   * List all labels
   * GET /v1/labels
   */
  @Get()
  async listLabels(@Query() query: PaginationQueryDto): Promise<ListLabelsResponseDto> {
    this.logger.log('Listing labels');

    const labels = await this.storage.getLabels();
    const pageSize = query.pageSize ?? 20;
    const offset = query.pageToken ? parseInt(query.pageToken, 10) : 0;

    const paginatedLabels = labels.slice(offset, offset + pageSize);

    return {
      labels: paginatedLabels.map(this.mapLabelToResponse),
      totalCount: labels.length,
      nextPageToken: offset + paginatedLabels.length < labels.length
        ? String(offset + paginatedLabels.length)
        : undefined,
    };
  }

  /**
   * Get a single label by ID
   * GET /v1/labels/:labelId
   */
  @Get(':labelId')
  async getLabel(@Param('labelId') labelId: string): Promise<LabelResponseDto> {
    this.logger.log(`Getting label: ${labelId}`);

    const labels = await this.storage.getLabels();
    const label = labels.find((l) => l.id === labelId);

    if (!label) {
      throw new NotFoundException({
        error: {
          code: 404,
          message: `Label ${labelId} not found`,
          status: 'NOT_FOUND',
        },
      });
    }

    return this.mapLabelToResponse(label);
  }

  /**
   * Map internal label to response DTO
   */
  private mapLabelToResponse(label: Label): LabelResponseDto {
    return {
      id: label.id,
      name: label.name,
      color: label.color,
      order: label.order,
      isFavorite: label.isFavorite,
    };
  }
}

