/**
 * Recurrence Service
 * 
 * Handles recurring task logic using RRULE (RFC 5545).
 * Generates task instances from recurring patterns.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { RRule, rrulestr } from 'rrule';
import { v4 as uuidv4 } from 'uuid';
import { IStorageAdapter } from '../../common/interfaces/storage-adapter.interface';
import { Task, CreateTaskDto, UpdateTaskDto } from '../../common/interfaces';

@Injectable()
export class RecurrenceService {
  private readonly logger = new Logger(RecurrenceService.name);

  constructor(
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
  ) {}

  /**
   * Creates a new recurring task and generates initial instances.
   * 
   * @param taskData Task data including recurringRule (RRULE string)
   * @returns The parent recurring task
   */
  async createRecurringTask(taskData: CreateTaskDto): Promise<Task> {
    if (!taskData.recurringRule) {
      throw new Error('Recurring rule is required to create a recurring task.');
    }

    this.logger.log(`Creating recurring task: ${taskData.content}`);

    // Create the parent recurring task
    const parentTask = await this.storage.createTask({
      ...taskData,
      recurringRule: taskData.recurringRule,
    });

    // Update to mark as parent recurring task
    await this.storage.updateTask(parentTask.id, {
      isRecurringInstance: false,
      recurringParentId: undefined,
    });

    // Generate and save initial instances
    const instances = await this.generateInstances(
      parentTask.id,
      taskData.recurringRule,
      taskData,
    );

    this.logger.log(`Generated ${instances.length} instances for recurring task ${parentTask.id}`);

    return parentTask;
  }

  /**
   * Generates task instances from a recurring pattern.
   * 
   * @param parentTaskId ID of the parent recurring task
   * @param rruleString RRULE string defining the recurrence pattern
   * @param baseTaskData Base task data to use for instances
   * @param untilDate Optional end date for generation (defaults to 1 year from now)
   * @returns Array of generated task instances
   */
  async generateInstances(
    parentTaskId: string,
    rruleString: string,
    baseTaskData: Partial<CreateTaskDto>,
    untilDate?: Date,
  ): Promise<Task[]> {
    try {
      // Parse RRULE
      const rrule = rrulestr(rruleString);
      const now = new Date();
      const endDate = untilDate || new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

      // Get existing instances to avoid duplicates
      const existingInstances = await this.storage.getRecurringTaskInstances(parentTaskId);
      const existingDueDates = new Set(
        existingInstances.map(t => t.due?.date).filter(Boolean)
      );

      // Generate dates based on RRULE
      const dates = rrule.between(now, endDate, true);
      const instances: Task[] = [];

      for (const date of dates) {
        const dueDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Skip if instance already exists
        if (existingDueDates.has(dueDate)) {
          continue;
        }

        // Create instance task data
        const instanceTaskData: CreateTaskDto = {
          ...baseTaskData,
          content: baseTaskData.content || 'Recurring Task Instance',
          dueString: dueDate,
          dueDate: dueDate,
          recurringRule: undefined, // Instances don't have their own rule
        };

        // Create instance
        const instance = await this.storage.createTask(instanceTaskData);
        
        // Mark as recurring instance
        await this.storage.updateTask(instance.id, {
          isRecurringInstance: true,
          recurringParentId: parentTaskId,
        });

        instances.push(instance);
      }

      this.logger.log(`Generated ${instances.length} new instances for recurring task ${parentTaskId}`);
      return instances;
    } catch (error: any) {
      this.logger.error(`Failed to generate instances: ${error.message}`);
      throw error;
    }
  }

  /**
   * Updates a recurring task and optionally regenerates instances.
   * 
   * @param parentTaskId ID of the parent recurring task
   * @param updates Updates to apply
   * @param regenerateInstances Whether to regenerate future instances
   * @returns Updated parent task
   */
  async updateRecurringTask(
    parentTaskId: string,
    updates: UpdateTaskDto,
    regenerateInstances: boolean = false,
  ): Promise<Task> {
    this.logger.log(`Updating recurring task: ${parentTaskId}`);

    // Get parent task
    const parentTask = await this.storage.getTask(parentTaskId);
    if (!parentTask || !parentTask.recurringRule) {
      throw new Error('Task is not a recurring task');
    }

    // Update parent task
    await this.storage.updateTask(parentTaskId, updates);

    // If RRULE changed, regenerate instances
    if (updates.recurringRule && updates.recurringRule !== parentTask.recurringRule) {
      // Delete old future instances
      const instances = await this.storage.getRecurringTaskInstances(parentTaskId);
      const now = new Date();
      
      for (const instance of instances) {
        if (instance.due && new Date(instance.due.date) > now && !instance.isCompleted) {
          await this.storage.deleteTask(instance.id);
        }
      }

      // Generate new instances with updated rule
      await this.generateInstances(parentTaskId, updates.recurringRule, {
        content: updates.content || parentTask.content,
        description: updates.description || parentTask.description,
        priority: updates.priority || parentTask.priority,
        labels: updates.labels || parentTask.labels,
      });
    } else if (regenerateInstances) {
      // Just generate more instances with existing rule
      await this.generateInstances(parentTaskId, parentTask.recurringRule, {
        content: updates.content || parentTask.content,
        description: updates.description || parentTask.description,
        priority: updates.priority || parentTask.priority,
        labels: updates.labels || parentTask.labels,
      });
    }

    return await this.storage.getTask(parentTaskId);
  }

  /**
   * Deletes a recurring task and all its instances.
   * 
   * @param parentTaskId ID of the parent recurring task
   */
  async deleteRecurringTask(parentTaskId: string): Promise<void> {
    this.logger.log(`Deleting recurring task and instances: ${parentTaskId}`);

    // Get all instances
    const instances = await this.storage.getRecurringTaskInstances(parentTaskId);

    // Delete all instances
    for (const instance of instances) {
      await this.storage.deleteTask(instance.id);
    }

    // Delete parent task
    await this.storage.deleteTask(parentTaskId);

    this.logger.log(`Deleted recurring task ${parentTaskId} and ${instances.length} instances`);
  }

  /**
   * Completes a recurring task instance and optionally generates the next instance.
   * 
   * @param instanceId ID of the instance to complete
   * @returns The completed instance
   */
  async completeRecurringInstance(instanceId: string): Promise<Task> {
    this.logger.log(`Completing recurring instance: ${instanceId}`);

    // Get instance
    const instance = await this.storage.getTask(instanceId);
    if (!instance || !instance.isRecurringInstance || !instance.recurringParentId) {
      throw new Error('Task is not a recurring instance');
    }

    // Complete the instance
    await this.storage.updateTask(instanceId, {
      isCompleted: true,
      completedAt: new Date().toISOString(),
    });

    // Get parent task
    const parentTask = await this.storage.getTask(instance.recurringParentId);
    if (parentTask && parentTask.recurringRule) {
      // Generate next instance(s) if needed
      await this.generateInstances(
        parentTask.id,
        parentTask.recurringRule,
        {
          content: parentTask.content,
          description: parentTask.description,
          priority: parentTask.priority,
          labels: parentTask.labels,
        },
      );
    }

    return await this.storage.getTask(instanceId);
  }
}

