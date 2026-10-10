import mongoose, { Schema, Document } from 'mongoose';

export interface IMedicine extends Document {
  slug: string;
  name: string;
  genericName: string;
  category: string;
  shortDescription?: string;
  description: string;
  commonUses: string[];
  uses?: string[];
  generalSafetyInformation: string;
  precautions?: string[];
  commonSideEffects: string[];
  sideEffects?: string[];
  warnings: string[];
  dosageInstructions?: string;
  forms: string[];
  requiresPrescription: boolean;
  lastReviewedAt?: string;
  bookmarked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MedicineSchema = new Schema<IMedicine>(
  {
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Medicine name is required'],
      trim: true,
    },
    genericName: {
      type: String,
      required: [true, 'Generic name is required'],
      trim: true,
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true,
    },
    shortDescription: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    commonUses: [{ type: String, trim: true }],
    uses: [{ type: String, trim: true }],
    generalSafetyInformation: {
      type: String,
      default: '',
      trim: true,
    },
    precautions: [{ type: String, trim: true }],
    commonSideEffects: [{ type: String, trim: true }],
    sideEffects: [{ type: String, trim: true }],
    warnings: [{ type: String, trim: true }],
    dosageInstructions: {
      type: String,
      default: 'Take strictly as prescribed by your doctor or as indicated on the product packaging.',
      trim: true,
    },
    forms: [{ type: String, trim: true }],
    requiresPrescription: {
      type: Boolean,
      default: false,
    },
    lastReviewedAt: {
      type: String,
      default: () => new Date().toISOString().split('T')[0],
    },
    bookmarked: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Synchronize commonUses/uses and commonSideEffects/sideEffects
MedicineSchema.pre('save', function (next) {
  if (!this.commonUses?.length && this.uses?.length) {
    this.commonUses = this.uses;
  }
  if (!this.uses?.length && this.commonUses?.length) {
    this.uses = this.commonUses;
  }
  if (!this.commonSideEffects?.length && this.sideEffects?.length) {
    this.commonSideEffects = this.sideEffects;
  }
  if (!this.sideEffects?.length && this.commonSideEffects?.length) {
    this.sideEffects = this.commonSideEffects;
  }
  if (!this.shortDescription && this.description) {
    this.shortDescription =
      this.description.length > 120 ? `${this.description.substring(0, 117)}...` : this.description;
  }
  next();
});

// Text index to support full-text search across medicine name, generic name, and description
MedicineSchema.index(
  { name: 'text', genericName: 'text', category: 'text', description: 'text' },
  { weights: { name: 10, genericName: 8, category: 5, description: 2 }, name: 'medicine_text_idx' }
);

export const Medicine =
  (mongoose.models.Medicine as mongoose.Model<IMedicine>) ||
  mongoose.model<IMedicine>('Medicine', MedicineSchema);
