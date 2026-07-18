/**
 * Auth Helper - Adapter for Next.js App Router API Routes
 * Extracts and validates JWT from request headers/cookies
 */

import { NextApiRequest } from 'next';
import { verifyAuthToken } from '@/server/middleware/auth.middleware';
import { ApiError } from '@/server/utils/api-error';

export interface User {
  userId: string;
  account?: string;
  role?: string;
  [key: string]: any;
}

/**
 * Validate JWT from request
 * Extracts token from Authorization header or cookies and verifies it
 */
export async function validateJWT(req: NextApiRequest): Promise<User> {
  try {
    const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      throw new ApiError(500, 'JWT secret not configured');
    }

    // Extract token from Authorization header or cookies
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || (req.cookies as any).accessToken;

    if (!token) {
      throw new ApiError(401, 'Missing authorization token');
    }

    const payload = verifyAuthToken(token, secret);
    if (!payload) {
      throw new ApiError(401, 'Invalid or expired token');
    }

    const userId = (payload.userId || payload.user_id || payload.sub) as string;
    if (!userId) {
      throw new ApiError(401, 'Token missing user identifier');
    }

    return {
      userId,
      account: payload.account || payload.userId,
      role: payload.role,
      ...payload,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'Authentication failed');
  }
}
