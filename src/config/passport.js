import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import authService from '../utils/authService.js';

export default (passport) => {
  // Local Strategy
  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      const user = await authService.validateCustomer(username, password);
      if (!user) {
        return done(null, false);
      }
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }));

  // JWT Strategy
  passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET || 'secretKey',
  }, async (payload, done) => {
    try {
      return done(null, { userId: payload.sub, username: payload.username, role: payload.role });
    } catch (error) {
      return done(error);
    }
  }));
};