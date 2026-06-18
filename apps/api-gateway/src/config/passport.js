const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'placeholder',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder',
    callbackURL: `${process.env.API_GATEWAY_URL || 'http://localhost:3000'}/v1/auth/oauth/google/callback`,
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      const name = profile.displayName || email.split('@')[0];
      const avatar = profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null;

      let user = await User.findOne({ email });

      if (user) {
        // If user exists but didn't have oauth linked, link it
        if (!user.oauthProvider) {
          user.oauthProvider = 'google';
          user.oauthId = profile.id;
          user.verified = true;
          if (!user.avatar) user.avatar = avatar;
          await user.save();
        }
        return done(null, user);
      } else {
        // New user
        // We'll let them create a team later or create a default team
        // Here we just create the user, teamId will be null initially, or we create a default team
        const Team = require('../models/Team');
        const team = new Team({ name: `${name}'s Team` });
        await team.save();

        user = new User({
          email,
          name,
          avatar,
          oauthProvider: 'google',
          oauthId: profile.id,
          verified: true,
          teamId: team._id,
          role: 'owner'
        });
        await user.save();

        team.owner = user._id;
        await team.save();

        return done(null, user);
      }
    } catch (error) {
      console.error('Google OAuth Error:', error);
      return done(error, null);
    }
  }
));

module.exports = passport;
