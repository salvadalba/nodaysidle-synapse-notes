import { Request, Response, NextFunction } from 'express';

export interface AuthRequest<P = {}, ResBody = any, ReqBody = any, ReqQuery = any> extends Request<P, ResBody, ReqBody, ReqQuery> {
    user_id?: string;
    file?: Express.Multer.File;
}

export const authenticateToken = (
    req: AuthRequest,
    _res: Response,
    next: NextFunction
): void => {
    // Bypass authentication for local single-user mode
    req.user_id = '00000000-0000-0000-0000-000000000000';
    next();

    /* Original auth logic preserved in comments
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    ...
    */
};
