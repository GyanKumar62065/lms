import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { signupDto, loginDto } from './auth.dto';
import * as c from './auth.controller';

export const authRouter = Router();
authRouter.post('/signup', validate({ body: signupDto }), asyncHandler(c.signup));
authRouter.post('/login', validate({ body: loginDto }), asyncHandler(c.login));
authRouter.post('/refresh', asyncHandler(c.refresh));
authRouter.post('/logout', asyncHandler(c.logout));
authRouter.get('/captcha', asyncHandler(c.getCaptcha));
authRouter.get('/me', authenticate, asyncHandler(c.me));
