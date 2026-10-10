import mongoose, { Schema, Document } from 'mongoose';

export interface ICondition extends Document {
  slug: string;
  name: string;
  category: string;
  shortDescription: string;
  overview: string;
  description?: string;
  severity: 'mild' | 'moderate' | 'severe' | 'chronic';
  symptoms: string[];
  causes: string[];
  prevention: string[];
  whenToSeekMedicalHelp: string[];
  whenToSeeDoctor?: string[];
  lastReviewedAt?: string;
  tags: string[];
  bookmarked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ConditionSchema = new Schema<ICondition>(
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
      required: [true, 'Condition name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true,
    },
    shortDescription: {
      type: String,
      required: [true, 'Short description is required'],
      trim: true,
    },
    overview: {
      type: String,
      required: [true, 'Overview is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe', 'chronic'],
      default: 'moderate',
    },
    symptoms: [{ type: String, trim: true }],
    causes: [{ type: String, trim: true }],
    prevention: [{ type: String, trim: true }],
    whenToSeekMedicalHelp: [{ type: String, trim: true }],
    whenToSeeDoctor: [{ type: String, trim: true }],
    lastReviewedAt: {
      type: String,
      default: () => new Date().toISOString().split('T')[0],
    },
    tags: [{ type: String, trim: true }],
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

// Virtual to ensure `description` and `overview` can be used interchangeably
ConditionSchema.pre('save', function (next) {
  if (!this.description && this.overview) {
    this.description = this.overview;
  }
  if (!this.overview && this.description) {
    this.overview = this.description;
  }
  if (!this.whenToSeekMedicalHelp?.length && this.whenToSeeDoctor?.length) {
    this.whenToSeekMedicalHelp = this.whenToSeeDoctor;
  }
  if (!this.whenToSeeDoctor?.length && this.whenToSeekMedicalHelp?.length) {
    this.whenToSeeDoctor = this.whenToSeekMedicalHelp;
  }
  next();
});

// Text index to support full-text search
ConditionSchema.index(
  { name: 'text', shortDescription: 'text', category: 'text', overview: 'text' },
  { weights: { name: 10, category: 5, shortDescription: 3, overview: 1 }, name: 'condition_text_idx' }
);

export const Condition =
  (mongoose.models.Condition as mongoose.Model<ICondition>) ||
  mongoose.model<ICondition>('Condition', ConditionSchema);
