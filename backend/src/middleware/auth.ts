import type { NextFunction, Request, Response } from 'express';
import { authenticateToken } from '../services/authService.js';
import type { AuthUser, UserRole } from '../types.js';
import { CORPUS_OPERATOR_ROLES, PLATFORM_OWNER_ROLES } from '../permissions.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      authToken?: string;
    }
  }
}

function bearerToken(req: Request): string | null {
  const header = req.get('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const user = authenticateToken(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  req.user = user;
  req.authToken = token;
  next();
}

export function requireRole(...allowed: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowed.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient role for this operation' });
      return;
    }

    next();
  };
}

export const requirePlatformOwner = requireRole(...PLATFORM_OWNER_ROLES);
export const requireCorpusOperator = requireRole(...CORPUS_OPERATOR_ROLES);
