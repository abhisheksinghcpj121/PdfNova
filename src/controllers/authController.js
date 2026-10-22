const authService = require('../services/authService');

class AuthController {
  /**
   * POST /api/auth/signup
   */
  async signup(req, res, next) {
    try {
      const { name, email, password } = req.body;
      const result = await authService.register({ name, email, password });

      return res.status(201).json({
        success: true,
        message: 'Account created successfully!',
        user: result.user,
        token: result.token
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: { code: 'REGISTRATION_FAILED', message: err.message }
      });
    }
  }

  /**
   * POST /api/auth/login
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authService.login({ email, password });

      return res.status(200).json({
        success: true,
        message: 'Signed in successfully!',
        user: result.user,
        token: result.token
      });
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTHENTICATION_FAILED', message: err.message }
      });
    }
  }

  /**
   * GET /api/auth/me
   */
  async me(req, res, next) {
    try {
      return res.status(200).json({
        success: true,
        user: req.user
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/logout
   */
  async logout(req, res, next) {
    try {
      if (req.authToken) {
        authService.logout(req.authToken);
      }
      return res.status(200).json({
        success: true,
        message: 'Signed out successfully.'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/auth/history
   */
  async history(req, res, next) {
    try {
      const history = authService.getUserHistory(req.user.id);
      return res.status(200).json({
        success: true,
        history
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
