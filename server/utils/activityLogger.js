const ActivityLog = require('../models/ActivityLog');

exports.logActivity = async ({ user, action, entityType, entityId, details, req }) => {
  try {
    if (!user?._id) return;
    await ActivityLog.create({
      userId: user._id,
      role: user.role,
      action,
      entityType,
      entityId: entityId ? String(entityId) : undefined,
      details: details ? String(details) : undefined,
      ip: req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '',
      userAgent: req?.headers?.['user-agent'] || '',
    });
  } catch {
    // Logging must never break main request flow.
  }
};
