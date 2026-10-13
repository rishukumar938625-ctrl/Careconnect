import {
  IDeliveryProvider,
  DeliveryPayload,
  DeliveryResult,
} from './deliveryProvider.js';

export interface SimulatedEmailLog {
  recipient: string;
  subject: string;
  timestamp: Date;
  referenceId?: string;
  referenceType?: string;
}

export class SimulatedEmailProvider implements IDeliveryProvider {
  public readonly name = 'simulated_email';
  public readonly isSimulated = true;

  private simulateFailure = false;
  private failureErrorMessage = 'Simulated email provider network failure';
  private sentHistory: SimulatedEmailLog[] = [];

  /**
   * For testing: force next send calls to fail or succeed
   */
  public setSimulateFailure(fail: boolean, errorMessage?: string): void {
    this.simulateFailure = fail;
    if (errorMessage) {
      this.failureErrorMessage = errorMessage;
    }
  }

  /**
   * For testing: get record of simulated emails sent
   */
  public getSentHistory(): SimulatedEmailLog[] {
    return [...this.sentHistory];
  }

  /**
   * For testing: clear history
   */
  public clearHistory(): void {
    this.sentHistory = [];
  }

  async send(payload: DeliveryPayload): Promise<DeliveryResult> {
    const recipient = payload.recipientEmail || 'unspecified@user.careconnect.app';

    if (this.simulateFailure) {
      return {
        success: false,
        provider: this.name,
        simulated: true,
        error: this.failureErrorMessage,
      };
    }

    const logEntry: SimulatedEmailLog = {
      recipient,
      subject: payload.title,
      timestamp: new Date(),
      referenceId: payload.referenceId,
      referenceType: payload.referenceType,
    };
    this.sentHistory.push(logEntry);

    const messageId = `sim_em_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Controlled structured console log for dev environment
    if (process.env.NODE_ENV !== 'test') {
      console.log(`📨 [SIMULATED EMAIL DELIVERY] To: ${recipient} | Subject: "${payload.title}" | ID: ${messageId}`);
    }

    return {
      success: true,
      provider: this.name,
      simulated: true,
      messageId,
    };
  }
}
