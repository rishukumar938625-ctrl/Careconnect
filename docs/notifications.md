# CareConnect — Notification Delivery & Background Jobs Architecture (Phase 7)

This document details the architectural design, lifecycle, concurrency control, delivery channels, and operational procedures for CareConnect's Phase 7 background notification system.

---

## 1. Architectural Overview

The notification subsystem provides a clean separation of concerns across six distinct operational layers:

```
┌────────────────────────────────────────────────────────┐
│ 1. Event Triggers                                      │
│    - Dose schedule generation (scheduler.ts)          │
│    - Appointment booking, rescheduling, cancellation   │
│    - Dose status updates (taken, skipped, snoozed)     │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 2. Notification Scheduling (notificationScheduler.ts)   │
│    - Compute effective times (quiet hours deferral)    │
│    - Generate deterministic idempotency keys           │
│    - Upsert durable queue jobs (NotificationJob model) │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 3. Background Queue & Worker (notificationWorker.ts)   │
│    - Atomic job claiming with time-bounded leases      │
│    - Crashed worker lease recovery                     │
│    - Immediate pre-delivery eligibility re-checks      │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 4. Delivery Channel Providers (services/providers/)    │
│    - InAppDeliveryProvider (persists to Notification)  │
│    - SimulatedEmailProvider (development & testing)    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 5. Delivery Tracking & Bounded Retries                 │
│    - Success: status -> 'delivered', deliveredAt       │
│    - Transient failure: backoff retry (attempts < 3)   │
│    - Permanent failure: status -> 'failed' (attempts=3)│
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 6. User-Facing Inbox & Notification Center             │
│    - Paginated inbox API (/api/notifications)          │
│    - Unread counters, mark as read, mark all read      │
│    - Frontend Notification Center (/notifications)     │
└────────────────────────────────────────────────────────┘
```

---

## 2. Queue Model & Concurrency Protection

### Data Model (`NotificationJob`)
Background jobs are stored durably in the MongoDB `notificationjobs` collection:
- `userId`: Reference to the recipient user.
- `jobType`: `medication_reminder` | `appointment_24h` | `appointment_1h` | `health_tip`.
- `channel`: `in_app` | `email` | `sms`.
- `idempotencyKey`: Unique compound string (e.g. `med_${doseId}_in_app`, `appt_24h_${appointmentId}_${startAtTime}_in_app`).
- `status`: `pending` | `processing` | `delivered` | `failed` | `cancelled`.
- `scheduledFor`: Target UTC execution timestamp.
- `lockedUntil`: Date representing worker lease expiration.
- `lockedBy`: Worker instance identifier.
- `attempts`: Integer tracking execution attempts.
- `maxAttempts`: Bounded limit (default 3).
- `payload`: Structured event payload (title, message, reference IDs, metadata).

### Atomic Claiming & Lease Mechanism
To support multiple concurrent application instances or workers without race conditions, jobs are claimed atomically using MongoDB's `findOneAndUpdate`:
```typescript
const claimedJob = await NotificationJob.findOneAndUpdate(
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
        lockedUntil: { $lte: now }, // Recovers abandoned lease from crashed worker
      },
    ],
  },
  {
    $set: {
      status: 'processing',
      lockedUntil: new Date(now.getTime() + leaseDurationMs), // default 60s
      lockedBy: workerId,
      lastAttemptAt: now,
    },
    $inc: { attempts: 1 },
  },
  {
    new: true,
    sort: { scheduledFor: 1 },
  }
);
```

### Abandoned Job Recovery
If a worker crashes while processing a job, `lockedUntil` automatically expires after 60 seconds. Any active worker scanning for work will discover the expired lease and claim the job safely.

### Bounded Retries & Exponential Backoff
- When a transient delivery failure occurs, `attempts` is incremented.
- If `attempts < maxAttempts`, the job is scheduled with exponential backoff:
  - Attempt 1: retry in +1 minute.
  - Attempt 2: retry in +5 minutes.
- If `attempts >= maxAttempts` (3), the job transitions permanently to `status = 'failed'` with the exact error message recorded. It will not be retried indefinitely.

---

## 3. Notification Types & Rules

### A. Medication Reminders
- Scheduled based on active doses in `DoseRecord`.
- Only generated for active medications (`isActive: true`, not archived, `reminderEnabled !== false`).
- Does not generate reminders if `user.notificationPreferences.medicationReminders === false`.
- If a dose is marked `taken` or `skipped`, any pending reminder jobs are transitioned to `status = 'cancelled'`.
- If a dose is `snoozed`, the old reminder job is cancelled and a new job is scheduled targeting the snooze timestamp.
- **Safety Guarantee:** Delivering a notification **never** changes dose status to "taken".
- **Stale Reminder Expiration:** If a medication reminder is deferred past a 14-hour horizon (e.g. from overnight quiet hours), it is expired rather than delivered excessively late.

### B. Appointment Reminders
- **24-Hour Reminder:** Scheduled for `appointment.startAt - 24 hours`.
- **1-Hour Reminder:** Scheduled for `appointment.startAt - 1 hour`.
- **Deterministic Policy for Near-Term Bookings:**
  - If booked `< 24 hours` before the appointment, the 24h reminder is deterministically skipped.
  - If booked `< 1 hour` before the appointment, the 1h reminder is deterministically skipped.
- **Rescheduling:** Obsolete pending reminder jobs are marked `cancelled`, and fresh reminder jobs are scheduled targeting the new appointment time.
- **Cancellation:** All pending reminder jobs for the appointment are immediately marked `cancelled`.
- **Pre-delivery Recheck:** If the appointment is cancelled or completed before the worker fires, delivery is aborted and the job is marked `cancelled`.

---

## 4. Quiet Hours & Time-Zone Handling

1. All scheduled timestamps are calculated and stored in **authoritative UTC**.
2. When quiet hours are enabled for a user:
   - Quiet hours window (e.g. `22:00` to `07:00`) is evaluated in the user's configured IANA timezone using `Intl.DateTimeFormat`.
   - Both normal windows (e.g. `13:00` to `15:00`) and cross-midnight windows (e.g. `22:00` to `07:00`) are supported.
   - If an event's intended scheduled time falls within quiet hours, `scheduledFor` is deferred to the quiet hours end time (e.g. 07:00 next morning).
   - If deferred time for an appointment reminder extends past the appointment start time, the reminder is safely discarded.

---

## 5. Delivery Channels

### 1. In-App Notifications (Fully Functional)
- Persisted to MongoDB `Notification` collection.
- Enforces strict user session ownership and pagination.
- Includes unread count indicator and mark-as-read endpoints.
- Title and message are sanitised to prevent exposing sensitive clinical health data.

### 2. Email Delivery (Simulated Adapter)
- Implemented through `SimulatedEmailProvider`.
- Clearly reports delivery with `[SIMULATED EMAIL DELIVERY]` logs and returns `simulated: true`.
- Never misrepresents simulated delivery as real delivery.
- Supports switching to real SMTP via `EMAIL_PROVIDER=smtp` and environment variables.

### 3. Push Notifications (Follow-Up Architecture)
- Push delivery is intentionally decoupled. Standard Web Push (VAPID) can be added as a delivery provider without modifying the scheduling queue or existing routes.

---

## 6. How to Run & Verify

### Running the Background Worker
#### Option A: Embedded in the API Server (Development Default)
Set `WORKER_ENABLED=true` in `.env`. The worker will start and stop alongside Express.

#### Option B: Standalone Process (Production Recommended)
Set `WORKER_ENABLED=false` in the API server `.env`, and run the dedicated worker process:
```bash
npm run worker
# or directly in backend workspace:
npm --prefix backend run worker
```

### Running Automated Tests
```bash
# Run Phase 7 notification & background worker tests
npm run test:notifications

# Run entire full test suite (Phases 3, 4, 5, 6, 7 — 73 tests)
npm run test
```

---

## 7. Operational Implications of Database Queue

Running a database-backed queue on MongoDB Atlas provides durability and zero external infrastructure dependencies (no Redis/BullMQ required). However, operators should be aware of:
1. **Polling Frequency:** Keep `WORKER_POLL_INTERVAL_MS` at 5–10 seconds to avoid excessive MongoDB query traffic.
2. **Horizontal Scaling:** When running multiple API/worker replicas, atomic claims via `findOneAndUpdate` prevent double-processing. Ensure database clocks are NTP-synchronized.
3. **Queue Compaction:** Over long periods, completed and cancelled jobs can be periodically pruned via a TTL index or maintenance script.
