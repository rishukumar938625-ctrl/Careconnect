import { Request, Response, NextFunction } from 'express';
import { Condition } from '../models/Condition.js';
import { escapeRegex, parsePagination, buildPaginationMeta } from '../utils/queryHelper.js';

/**
 * GET /api/conditions
 * List conditions with pagination, optional search query, and category filters.
 */
export const getConditions = async (
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

    res.status(200).json({
      data: conditions,
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

    const condition = await Condition.findOne({
      $or: [{ slug: slug.toLowerCase() }, { _id: slug.match(/^[0-9a-fA-F]{24}$/) ? slug : null }],
    });

    if (!condition) {
      res.status(404).json({
        status: 'error',
        message: `Condition not found with identifier '${slug}'`,
      });
      return;
    }

    res.status(200).json(condition);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/conditions/:slug/bookmark
 * Toggle condition bookmark state.
 */
export const toggleConditionBookmark = async (
  req: Request,
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
