import mongoose, { Schema, Document } from 'mongoose';

export interface IArticle extends Document {
  slug: string;
  title: string;
  category: string;
  summary: string;
  shortDescription?: string;
  content: string;
  tags: string[];
  readingTimeMinutes: number;
  readTimeMinutes?: number;
  author: {
    name: string;
    role: string;
    avatarUrl?: string;
  };
  lastReviewedAt?: string;
  publishedAt: string;
  bookmarked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ArticleSchema = new Schema<IArticle>(
  {
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Article title is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true,
    },
    summary: {
      type: String,
      required: [true, 'Summary is required'],
      trim: true,
    },
    shortDescription: {
      type: String,
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
    },
    tags: [{ type: String, trim: true }],
    readingTimeMinutes: {
      type: Number,
      default: 5,
      min: 1,
    },
    readTimeMinutes: {
      type: Number,
      default: 5,
    },
    author: {
      name: { type: String, default: 'CareConnect Health Editorial Team', trim: true },
      role: { type: String, default: 'Medical Content Reviewer', trim: true },
      avatarUrl: { type: String },
    },
    lastReviewedAt: {
      type: String,
      default: () => new Date().toISOString().split('T')[0],
    },
    publishedAt: {
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

// Synchronize summary/shortDescription and readingTimeMinutes/readTimeMinutes
ArticleSchema.pre('save', function (next) {
  if (!this.shortDescription && this.summary) {
    this.shortDescription = this.summary;
  }
  if (!this.summary && this.shortDescription) {
    this.summary = this.shortDescription;
  }
  if (!this.readTimeMinutes && this.readingTimeMinutes) {
    this.readTimeMinutes = this.readingTimeMinutes;
  }
  if (!this.readingTimeMinutes && this.readTimeMinutes) {
    this.readingTimeMinutes = this.readTimeMinutes;
  }
  next();
});

// Text index to support full-text search across article title, summary, content, and tags
ArticleSchema.index(
  { title: 'text', summary: 'text', tags: 'text' },
  { weights: { title: 10, tags: 5, summary: 3 }, name: 'article_text_idx' }
);

export const Article =
  (mongoose.models.Article as mongoose.Model<IArticle>) ||
  mongoose.model<IArticle>('Article', ArticleSchema);
