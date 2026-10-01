import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DemandsService } from './demands.service';

@Injectable()
export class DemandsListener {
  private readonly logger = new Logger(DemandsListener.name);

  constructor(private readonly demandsService: DemandsService) {}

  @OnEvent('workflow.approved')
  async handleWorkflowApproved(payload: any) {
    if (payload.entityType === 'DEMAND') {
      this.logger.log(`Handling workflow approval for Demand: ${payload.entityId}`);
      await this.demandsService.handleWorkflowApproved(payload.entityId);
    }
  }

  @OnEvent('workflow.rejected')
  async handleWorkflowRejected(payload: any) {
    if (payload.entityType === 'DEMAND') {
      this.logger.log(`Handling workflow rejection for Demand: ${payload.entityId}`);
      await this.demandsService.handleWorkflowRejected(payload.entityId, payload.remarks);
    }
  }
}
