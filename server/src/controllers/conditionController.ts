import { Response, NextFunction } from 'express';
import { Condition } from '../models/Condition.js';
import { escapeRegex, parsePagination, buildPaginationMeta } from '../utils/queryHelper.js';
import { AuthRequest } from '../middleware/authMiddleware.js';

/**
 * GET /api/conditions
 * List conditions with pagination, optional search query, and category filters.
 */
export const getConditions = async (
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
        filter.slug = { $in: req.user.bookmarkedConditions || [] };
      } else {
        filter.bookmarked = true;
      }
    }

    if (q && typeof q === 'string' && q.trim()) {
      const searchRegex = new RegExp(escapeRegex(q.trim()), 'i');
      filter.$or = [
        { name: searchRegex },
        { shortDescription: searchRegex },
        { category: searchRegex },
        { symptoms: searchRegex },
        { overview: searchRegex },
        { tags: searchRegex },
      ];
    }

    const [conditions, total] = await Promise.all([
      Condition.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      Condition.countDocuments(filter),
    ]);

    const mappedConditions = conditions.map((cond) => {
      if (req.user) {
        return {
          ...cond,
          bookmarked: (req.user.bookmarkedConditions || []).includes(cond.slug),
        };
      }
      return cond;
    });

    res.status(200).json({
      data: mappedConditions,
      pagination: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/conditions/:slug
 * Retrieve a single condition by unique slug (or ID fallback).
 */
export const getConditionBySlug = async (
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

    const condition = await Condition.findOne({
      $or: [{ slug: slug.toLowerCase() }, { _id: slug.match(/^[0-9a-fA-F]{24}$/) ? slug : null }],
    }).lean();

    if (!condition) {
      res.status(404).json({
        status: 'error',
        message: `Condition not found with identifier '${slug}'`,
      });
      return;
    }

    const isBookmarked = req.user
      ? (req.user.bookmarkedConditions || []).includes(condition.slug)
      : condition.bookmarked;

    res.status(200).json({
      ...condition,
      bookmarked: isBookmarked,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/conditions/:slug/bookmark
 * Toggle condition bookmark state for the authenticated user.
 */
export const toggleConditionBookmark = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug } = req.params;
    const condition = await Condition.findOne({ slug: slug.toLowerCase() });

    if (!condition) {
      res.status(404).json({
        status: 'error',
        message: `Condition not found with slug '${slug}'`,
      });
      return;
    }

    if (req.user) {
      const userBookmarks = req.user.bookmarkedConditions || [];
      const index = userBookmarks.indexOf(condition.slug);
      let isBookmarked = false;

      if (index > -1) {
        userBookmarks.splice(index, 1);
        isBookmarked = false;
      } else {
        userBookmarks.push(condition.slug);
        isBookmarked = true;
      }

      req.user.bookmarkedConditions = userBookmarks;
      await req.user.save();

      res.status(200).json({
        slug: condition.slug,
        bookmarked: isBookmarked,
      });
      return;
    }

    condition.bookmarked = !condition.bookmarked;
    await condition.save();

    res.status(200).json({
      slug: condition.slug,
      bookmarked: condition.bookmarked,
    });
  } catch (error) {
    next(error);
  }
};
