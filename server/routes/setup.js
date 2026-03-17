const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getSetupStatus,
  getSetupConfig,
  saveSetupConfig,
} = require('../controllers/setupController');
const { isConfigured } = require('../config/runtimeConfig');

const optionalAdminAuth = (req, res, next) => {
  if (!isConfigured()) return next();
  return protect(req, res, (protectError) => {
    if (protectError) return next(protectError);
    return authorize('admin')(req, res, next);
  });
};

router.get('/status', getSetupStatus);
router.get('/config', optionalAdminAuth, getSetupConfig);
router.put('/config', optionalAdminAuth, saveSetupConfig);

module.exports = router;
