import { IUser } from '../models/user.model';
declare global {
  namespace Express {
    interface Request {
      auth?: { user: IUser; permissions: Set<string> };
    }
  }
}
export {};
