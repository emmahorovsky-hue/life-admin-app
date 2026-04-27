import { Request, Response } from 'express';

// Hardcoded categories for MVP
const CATEGORIES = [
  { id: 'streaming', name: 'Streaming', description: 'Netflix, Hulu, Disney+, etc.' },
  { id: 'fitness', name: 'Fitness', description: 'Gym, ClassPass, Peloton, etc.' },
  { id: 'software', name: 'Software', description: 'Adobe, Figma, GitHub, etc.' },
  { id: 'music', name: 'Music', description: 'Spotify, Apple Music, etc.' },
  { id: 'cloud', name: 'Cloud Storage', description: 'Dropbox, iCloud, Google Drive, etc.' },
  { id: 'gaming', name: 'Gaming', description: 'Xbox Game Pass, PlayStation Plus, etc.' },
  { id: 'productivity', name: 'Productivity', description: 'Notion, Evernote, etc.' },
  { id: 'other', name: 'Other', description: 'Miscellaneous subscriptions' },
];

export const getCategories = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    res.status(200).json(CATEGORIES);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch categories',
        code: 'FETCH_CATEGORIES_FAILED',
      },
    });
  }
};
