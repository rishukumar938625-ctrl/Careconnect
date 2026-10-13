import { Notification } from '../../models/Notification.js';
import {
  IDeliveryProvider,
  DeliveryPayload,
  DeliveryResult,
} from './deliveryProvider.js';

export class InAppDeliveryProvider implements IDeliveryProvider {
  public readonly name = 'in_app';
  public readonly isSimulated = false;

  async send(payload: DeliveryPayload): Promise<DeliveryResult> {
    try {
      const doc = await Notification.create({
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        channel: 'in_app',
        read: false,
        data: {
          medicationId: payload.referenceType === 'medication' ? payload.referenceId : undefined,
          doseId: payload.referenceType === 'dose' ? payload.referenceId : undefined,
          appointmentId: payload.referenceType === 'appointment' ? payload.referenceId : undefined,
          ...payload.meta,
        },
      });

      return {
        success: true,
        provider: this.name,
        simulated: false,
        messageId: doc._id.toString(),
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        simulated: false,
        error: err?.message || 'Failed to create in-app notification',
      };
    }
  }
}
