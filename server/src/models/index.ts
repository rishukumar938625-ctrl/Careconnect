/**
 * CareConnect Mongoose Models Central Export
 * Provides a clean, unified location for all database models with reload safety.
 */

export { Condition, Condition as HealthCondition, type ICondition } from './Condition.js';
export { Medicine, type IMedicine } from './Medicine.js';
export { Article, Article as HealthArticle, type IArticle } from './Article.js';
export { Medication, type IMedication, type IAdherenceLog } from './Medication.js';
export { Doctor, type IDoctor } from './Doctor.js';
export { Appointment, type IAppointment } from './Appointment.js';
export { User, User as UserProfile, type IUser } from './User.js';
