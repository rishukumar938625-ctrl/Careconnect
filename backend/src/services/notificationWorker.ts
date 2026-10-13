import { NotificationJob, INotificationJob } from '../models/NotificationJob.js';
import { DoseRecord } from '../models/DoseRecord.js';
import { Medication } from '../models/Medication.js';
import { Appointment } from '../models/Appointment.js';
import { User } from '../models/User.js';
import { IDeliveryProvider, DeliveryPayload, DeliveryResult } from './providers/deliveryProvider.js';
import { InAppDeliveryProvider } from './providers/inAppProvider.js';
import { SimulatedEmailProvider } from './providers/simulatedEmailProvider.js';
import {
  isCurrentlyQuietHours,
  isValidTimeStr,
} from '../utils/userValidation.js';
import { calculateQuietHoursEnd } from './notificationScheduler.js';

export interface NotificationWorkerOptions {
  workerId?: string;
  pollIntervalMs?: number;
  batchSize?: number;
  leaseDurationMs?: number;
}

export class NotificationWorker {
  public readonly workerId: string;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private readonly leaseDurationMs: number;

  private isRunning = false;
  private isProcessing = false;
  private timer: NodeJS.Timeout | null = null;

  private providers: Map<string, IDeliveryProvider> = new Map();
  public readonly inAppProvider: InAppDeliveryProvider;
  public readonly simulatedEmailProvider: SimulatedEmailProvider;

  constructor(options: NotificationWorkerOptions = {}) {
    this.workerId = options.workerId || `worker-${process.pid}-${Math.random().toString(36).slice(2, 7)}`;
    this.pollIntervalMs = options.pollIntervalMs || 5000;
    this.batchSize = options.batchSize || 10;
    this.leaseDurationMs = options.leaseDurationMs || 60000; // 1 minute lease

    this.inAppProvider = new InAppDeliveryProvider();
    this.simulatedEmailProvider = new SimulatedEmailProvider();

    this.providers.set('in_app', this.inAppProvider);
    this.providers.set('email', this.simulatedEmailProvider);
  }

  /**
   * Registers or overrides a delivery provider for a specific channel
   */
  public registerProvider(channel: string, provider: IDeliveryProvider): void {
    this.providers.set(channel, provider);
  }

  /**
   * Retrieves provider for channel
   */
  public getProvider(channel: string): IDeliveryProvider | undefined {
    return this.providers.get(channel);
  }

  /**
   * Starts the worker background loop
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    if (process.env.NODE_ENV !== 'test') {
      console.log(`👷 [NotificationWorker] Started (ID: ${this.workerId}, poll: ${this.pollIntervalMs}ms)`);
    }

    const poll = async () => {
      if (!this.isRunning) return;
      try {
        await this.processBatch();
      } catch (err: any) {
        console.error(`⚠️ [NotificationWorker] Error in poll loop: ${err?.message}`);
      } finally {
        if (this.isRunning) {
          this.timer = setTimeout(poll, this.pollIntervalMs);
        }
      }
    };

    this.timer = setTimeout(poll, 100);
  }

  /**
   * Gracefully stops the worker
   */
  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Wait if a batch is currently mid-flight
    while (this.isProcessing) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    if (process.env.NODE_ENV !== 'test') {
      console.log(`🛑 [NotificationWorker] Stopped cleanly (ID: ${this.workerId})`);
    }
  }

  /**
   * Atomically claims the next eligible job from MongoDB.
   * Concurrency-safe across multiple worker instances.
   * Recovers crashed/abandoned jobs where lease has expired.
   */
  public async claimNextJob(now = new Date()): Promise<INotificationJob | null> {
    const job = await NotificationJob.findOneAndUpdate(
      {
        attempts: { $lt: 3 },
        scheduledFor: { $lte: now },
        $or: [
          {
            status: { $in: ['pending', 'failed'] },
            $or: [
              { lockedUntil: { $exists: false } },
              { lockedUntil: null },
              { lockedUntil: { $lte: now } },
            ],
          },
          {
            status: 'processing',
            lockedUntil: { $lte: now },
          },
        ],
      },
      {
        $set: {
          status: 'processing',
          lockedUntil: new Date(now.getTime() + this.leaseDurationMs),
          lockedBy: this.workerId,
          lastAttemptAt: now,
        },
        $inc: { attempts: 1 },
      },
      {
        new: true,
        sort: { scheduledFor: 1 },
      }
    );

    return job;
  }

  /**
   * Verifies current eligibility immediately before delivery.
   * If an event is cancelled, taken, or preferences changed, aborts cleanly.
   */
  public async checkEligibility(
    job: INotificationJob,
    now = new Date()
  ): Promise<{ eligible: boolean; cancelReason?: string; deferUntil?: Date }> {
    const user = await User.findById(job.userId);
    if (!user || !user.isActive) {
      return { eligible: false, cancelReason: 'User inactive or deleted' };
    }

    // Check notification channel preferences
    const prefs = user.notificationPreferences;
    if (prefs) {
      if (job.jobType === 'medication_reminder' && prefs.medicationReminders === false) {
        return { eligible: false, cancelReason: 'User disabled medication reminders' };
      }
      if (
        ['appointment_24h', 'appointment_1h'].includes(job.jobType) &&
        prefs.appointmentAlerts === false
      ) {
        return { eligible: false, cancelReason: 'User disabled appointment alerts' };
      }

      // Check quiet hours right now: defer if quiet hours are currently in effect
      if (prefs.quietHoursEnabled && isValidTimeStr(prefs.quietHoursStart) && isValidTimeStr(prefs.quietHoursEnd)) {
        const inQuietHours = isCurrentlyQuietHours(
          now,
          prefs.quietHoursStart,
          prefs.quietHoursEnd,
          prefs.timeZone
        );
        if (inQuietHours) {
          const nextAllowed = calculateQuietHoursEnd(
            now,
            prefs.quietHoursStart,
            prefs.quietHoursEnd,
            prefs.timeZone
          );
          return { eligible: false, deferUntil: nextAllowed };
        }
      }
    }

    // Reference checks
    if (job.payload.referenceType === 'dose' && job.payload.referenceId) {
      const dose = await DoseRecord.findById(job.payload.referenceId);
      if (!dose) {
        return { eligible: false, cancelReason: 'Dose record no longer exists' };
      }
      if (['taken', 'skipped'].includes(dose.status)) {
        return { eligible: false, cancelReason: `Dose already marked ${dose.status}` };
      }

      const med = await Medication.findById(dose.medicationId);
      if (!med || !med.isActive) {
        return { eligible: false, cancelReason: 'Medication is inactive or deleted' };
      }
    }

    if (job.payload.referenceType === 'appointment' && job.payload.referenceId) {
      const appointment = await Appointment.findById(job.payload.referenceId);
      if (!appointment) {
        return { eligible: false, cancelReason: 'Appointment no longer exists' };
      }
      if (['cancelled', 'completed'].includes(appointment.status)) {
        return { eligible: false, cancelReason: `Appointment is ${appointment.status}` };
      }
    }

    return { eligible: true };
  }

  /**
   * Processes a single claimed job.
   */
  public async processJob(job: INotificationJob, now = new Date()): Promise<void> {
    const { eligible, cancelReason, deferUntil } = await this.checkEligibility(job, now);

    if (deferUntil) {
      // Re-defer due to quiet hours currently active
      job.status = 'pending';
      job.scheduledFor = deferUntil;
      job.deferredReason = 'quiet_hours';
      job.lockedUntil = undefined;
      job.lockedBy = undefined;
      // Decrement attempts counter since it was deferred, not failed
      job.attempts = Math.max(0, job.attempts - 1);
      await job.save();
      return;
    }

    if (!eligible) {
      job.status = 'cancelled';
      job.error = cancelReason;
      job.lockedUntil = undefined;
      job.lockedBy = undefined;
      await job.save();
      return;
    }

    const provider = this.providers.get(job.channel);
    if (!provider) {
      job.status = 'failed';
      job.error = `No delivery provider registered for channel "${job.channel}"`;
      job.lockedUntil = undefined;
      job.lockedBy = undefined;
      await job.save();
      return;
    }

    const deliveryPayload: DeliveryPayload = {
      userId: job.userId.toString(),
      recipientEmail: job.payload.recipientEmail,
      recipientName: job.payload.recipientName,
      title: job.payload.title,
      message: job.payload.message,
      type: job.jobType === 'medication_reminder' ? 'medication_reminder' : 'appointment_reminder',
      referenceId: job.payload.referenceId,
      referenceType: job.payload.referenceType,
      meta: job.payload.meta,
    };

    let result: DeliveryResult;
    try {
      result = await provider.send(deliveryPayload);
    } catch (sendErr: any) {
      result = {
        success: false,
        provider: provider.name,
        simulated: provider.isSimulated,
        error: sendErr?.message || 'Unexpected provider exception',
      };
    }

    if (result.success) {
      job.status = 'delivered';
      job.deliveredAt = new Date();
      job.deliveryResult = {
        simulated: result.simulated,
        provider: result.provider,
        messageId: result.messageId,
      };
      job.error = undefined;
      job.lockedUntil = undefined;
      job.lockedBy = undefined;
      await job.save();
    } else {
      // Transient vs permanent failure handling
      job.error = result.error;
      job.lockedUntil = undefined;
      job.lockedBy = undefined;

      if (job.attempts >= job.maxAttempts) {
        job.status = 'failed';
      } else {
        // Exponential backoff for retry: 1st retry 1 min, 2nd retry 5 mins
        const backoffMs = job.attempts === 1 ? 60 * 1000 : 5 * 60 * 1000;
        job.status = 'pending';
        job.scheduledFor = new Date(now.getTime() + backoffMs);
      }
      await job.save();
    }
  }

  /**
   * Processes a batch of eligible jobs.
   */
  public async processBatch(limit = this.batchSize): Promise<number> {
    this.isProcessing = true;
    let processedCount = 0;

    try {
      for (let i = 0; i < limit; i++) {
        const job = await this.claimNextJob();
        if (!job) break; // No more eligible jobs to claim right now

        await this.processJob(job);
        processedCount++;
      }
    } finally {
      this.isProcessing = false;
    }

    return processedCount;
  }
}

// Global default worker instance
export const defaultWorker = new NotificationWorker();
