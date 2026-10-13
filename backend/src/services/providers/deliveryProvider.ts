/**
 * Common Delivery Provider Interface for CareConnect Notification System
 */

export interface DeliveryPayload {
  userId: string;
  recipientEmail?: string;
  recipientName?: string;
  title: string;
  message: string;
  type: 'medication_reminder' | 'appointment_reminder' | 'health_tip' | 'system';
  referenceId?: string;
  referenceType?: 'dose' | 'appointment' | 'medication';
  meta?: Record<string, unknown>;
}

export interface DeliveryResult {
  success: boolean;
  provider: string;
  simulated: boolean;
  messageId?: string;
  error?: string;
}

export interface IDeliveryProvider {
  readonly name: string;
  readonly isSimulated: boolean;
  send(payload: DeliveryPayload): Promise<DeliveryResult>;
}
