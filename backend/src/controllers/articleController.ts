import { Response, NextFunction } from 'express';
import { Article } from '../models/Article.js';
import { escapeRegex, parsePagination, buildPaginationMeta } from '../utils/queryHelper.js';
import { AuthRequest } from '../middleware/authMiddleware.js';

/**
 * GET /api/articles
 * List health articles with pagination, search query, and category filters.
 * When authenticated, personal bookmarks are reflected.
 */
export const getArticles = async (
  req: AuthRequest,
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
      if (req.user) {
        filter.slug = { $in: req.user.bookmarkedArticles || [] };
      } else {
        filter.bookmarked = true;
      }
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

    // Map personal bookmark status if user is authenticated
    const mappedArticles = articles.map((article) => {
      if (req.user) {
        return {
          ...article,
          bookmarked: (req.user.bookmarkedArticles || []).includes(article.slug),
        };
      }
      return article;
    });

    res.status(200).json({
      data: mappedArticles,
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
  req: AuthRequest,
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
    }).lean();

    if (!article) {
      res.status(404).json({
        status: 'error',
        message: `Article not found with identifier '${slug}'`,
      });
      return;
    }

    const isBookmarked = req.user
      ? (req.user.bookmarkedArticles || []).includes(article.slug)
      : article.bookmarked;

    res.status(200).json({
      ...article,
      bookmarked: isBookmarked,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/articles/:slug/bookmark
 * Toggle article bookmark state for the authenticated user.
 */
export const toggleArticleBookmark = async (
  req: AuthRequest,
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

    if (req.user) {
      const userBookmarks = req.user.bookmarkedArticles || [];
      const index = userBookmarks.indexOf(article.slug);
      let isBookmarked = false;

      if (index > -1) {
        userBookmarks.splice(index, 1);
        isBookmarked = false;
      } else {
        userBookmarks.push(article.slug);
        isBookmarked = true;
      }

      req.user.bookmarkedArticles = userBookmarks;
      await req.user.save();

      res.status(200).json({
        slug: article.slug,
        bookmarked: isBookmarked,
      });
      return;
    }

    // Fallback if accessed without user
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
