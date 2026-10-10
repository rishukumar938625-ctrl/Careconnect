import { Response, NextFunction } from 'express';
import { Medicine } from '../models/Medicine.js';
import { escapeRegex, parsePagination, buildPaginationMeta } from '../utils/queryHelper.js';
import { AuthRequest } from '../middleware/authMiddleware.js';

/**
 * GET /api/medicines
 * List medicines with pagination, optional search query, and category filters.
 */
export const getMedicines = async (
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
        filter.slug = { $in: req.user.bookmarkedMedicines || [] };
      } else {
        filter.bookmarked = true;
      }
    }

    if (q && typeof q === 'string' && q.trim()) {
      const searchRegex = new RegExp(escapeRegex(q.trim()), 'i');
      filter.$or = [
        { name: searchRegex },
        { genericName: searchRegex },
        { shortDescription: searchRegex },
        { uses: searchRegex },
        { category: searchRegex },
        { tags: searchRegex },
      ];
    }

    const [medicines, total] = await Promise.all([
      Medicine.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      Medicine.countDocuments(filter),
    ]);

    const mappedMedicines = medicines.map((med) => {
      if (req.user) {
        return {
          ...med,
          bookmarked: (req.user.bookmarkedMedicines || []).includes(med.slug),
        };
      }
      return med;
    });

    res.status(200).json({
      data: mappedMedicines,
      pagination: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/medicines/:slug
 * Retrieve a single medicine by unique slug (or ID fallback).
 */
export const getMedicineBySlug = async (
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

    const medicine = await Medicine.findOne({
      $or: [{ slug: slug.toLowerCase() }, { _id: slug.match(/^[0-9a-fA-F]{24}$/) ? slug : null }],
    }).lean();

    if (!medicine) {
      res.status(404).json({
        status: 'error',
        message: `Medicine not found with identifier '${slug}'`,
      });
      return;
    }

    const isBookmarked = req.user
      ? (req.user.bookmarkedMedicines || []).includes(medicine.slug)
      : medicine.bookmarked;

    res.status(200).json({
      ...medicine,
      bookmarked: isBookmarked,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/medicines/:slug/bookmark
 * Toggle medicine bookmark state for the authenticated user.
 */
export const toggleMedicineBookmark = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug } = req.params;
    const medicine = await Medicine.findOne({ slug: slug.toLowerCase() });

    if (!medicine) {
      res.status(404).json({
        status: 'error',
        message: `Medicine not found with slug '${slug}'`,
      });
      return;
    }

    if (req.user) {
      const userBookmarks = req.user.bookmarkedMedicines || [];
      const index = userBookmarks.indexOf(medicine.slug);
      let isBookmarked = false;

      if (index > -1) {
        userBookmarks.splice(index, 1);
        isBookmarked = false;
      } else {
        userBookmarks.push(medicine.slug);
        isBookmarked = true;
      }

      req.user.bookmarkedMedicines = userBookmarks;
      await req.user.save();

      res.status(200).json({
        slug: medicine.slug,
        bookmarked: isBookmarked,
      });
      return;
    }

    medicine.bookmarked = !medicine.bookmarked;
    await medicine.save();

    res.status(200).json({
      slug: medicine.slug,
      bookmarked: medicine.bookmarked,
    });
  } catch (error) {
    next(error);
  }
};
