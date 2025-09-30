import passport from 'passport';

const localAuth = passport.authenticate('local', { session: false });

const jwtAuth = passport.authenticate('jwt', { session: false });

const adminAuth = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (err || !user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    req.user = user;
    next();
  })(req, res, next);
};

export { localAuth, jwtAuth, adminAuth };