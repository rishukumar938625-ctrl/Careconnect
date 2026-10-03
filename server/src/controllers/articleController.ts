import { Request, Response, NextFunction } from 'express';
import { Article } from '../models/Article.js';
import { escapeRegex, parsePagination, buildPaginationMeta } from '../utils/queryHelper.js';

/**
 * GET /api/articles
 * List health articles with pagination, search query, and category filters.
 */
export const getArticles = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { q, category, bookmarked } = req.query;
    const { page, limit, skip } = parsePagination(req);
    const filter: Record<string, unknown> = {};

    if (category && typeof category === 'string' && category !== 'All') {
      filter.category = new RegExp(`^${escapeRegex(category.trim())}$`, 'i');
    }

    if (bookmarked === 'true') {
      filter.bookmarked = true;
    }

    if (q && typeof q === 'string' && q.trim()) {
      const searchRegex = new RegExp(escapeRegex(q.trim()), 'i');
      filter.$or = [
        { title: searchRegex },
        { summary: searchRegex },
        { shortDescription: searchRegex },
        { content: searchRegex },
        { category: searchRegex },
        { tags: searchRegex },
      ];
    }

    const [articles, total] = await Promise.all([
      Article.find(filter).sort({ publishedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Article.countDocuments(filter),
    ]);

    res.status(200).json({
      data: articles,
      pagination: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/articles/:slug
 * Retrieve a single article by unique slug (or ID fallback).
 */
export const getArticleBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug } = req.params;
    if (!slug || typeof slug !== 'string') {
      res.status(400).json({ status: 'error', message: 'Valid slug is required' });
      return;
    }

    const article = await Article.findOne({
      $or: [{ slug: slug.toLowerCase() }, { _id: slug.match(/^[0-9a-fA-F]{24}$/) ? slug : null }],
    });

    if (!article) {
      res.status(404).json({
        status: 'error',
        message: `Article not found with identifier '${slug}'`,
      });
      return;
    }

    res.status(200).json(article);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/articles/:slug/bookmark
 * Toggle article bookmark state.
 */
export const toggleArticleBookmark = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug } = req.params;
    const article = await Article.findOne({ slug: slug.toLowerCase() });

    if (!article) {
      res.status(404).json({
        status: 'error',
        message: `Article not found with slug '${slug}'`,
      });
      return;
    }

    article.bookmarked = !article.bookmarked;
    await article.save();

    res.status(200).json({
      slug: article.slug,
      bookmarked: article.bookmarked,
    });
  } catch (error) {
    next(error);
  }
};
