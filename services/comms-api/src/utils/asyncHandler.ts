// shared with crm-api + sales-api + finance-api — keep in sync (Phase 6 compliance-api extraction)
import { Request, Response, NextFunction } from 'express';

export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
