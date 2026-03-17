const mongoose = require('mongoose');
const {
  CONFIG_KEYS,
  getConfigForClient,
  isConfigured,
  saveRuntimeConfig,
} = require('../config/runtimeConfig');
const { resetTransporter } = require('../utils/mailer');

const trimValue = (value) => (value === undefined || value === null ? '' : String(value).trim());

const canAccessSetupConfig = (req) => {
  if (!isConfigured()) return true;
  return Boolean(req.user && req.user.role === 'admin');
};

const buildConfigPayload = (body = {}) => {
  const payload = {};
  CONFIG_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      payload[key] = trimValue(body[key]);
    }
  });
  return payload;
};

const validatePayload = (payload) => {
  const mongo = trimValue(payload.MONGODB_URI ?? process.env.MONGODB_URI);
  const clientUrl = trimValue(payload.CLIENT_URL ?? process.env.CLIENT_URL);
  const appBaseUrl = trimValue(payload.APP_BASE_URL ?? process.env.APP_BASE_URL);

  const smtpHost = trimValue(payload.SMTP_HOST ?? process.env.SMTP_HOST);
  const smtpPort = trimValue(payload.SMTP_PORT ?? process.env.SMTP_PORT);
  const smtpUser = trimValue(payload.SMTP_USER ?? process.env.SMTP_USER);
  const smtpPass = trimValue(payload.SMTP_PASS ?? process.env.SMTP_PASS);
  const gmailUser = trimValue(payload.GMAIL_USER ?? process.env.GMAIL_USER);
  const gmailPass = trimValue(payload.GMAIL_APP_PASSWORD ?? process.env.GMAIL_APP_PASSWORD);

  if (!mongo) return 'Database connection string is required.';
  if (!clientUrl) return 'Client URL is required.';
  if (!appBaseUrl) return 'App base URL is required.';

  const hasSmtp = Boolean(smtpHost && smtpPort && smtpUser && smtpPass);
  const hasGmail = Boolean(gmailUser && gmailPass);
  if (!hasSmtp && !hasGmail) {
    return 'Provide either SMTP credentials or Gmail credentials for email delivery.';
  }

  return null;
};

const tryReconnectDatabase = async () => {
  const mongoUri = String(process.env.MONGODB_URI || '').trim();
  if (!mongoUri) return { dbConnected: false, dbError: 'MONGODB_URI is missing.' };

  try {
    if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
      await mongoose.disconnect();
    }

    await mongoose.connect(mongoUri);
    return { dbConnected: true, dbError: null };
  } catch (error) {
    return { dbConnected: false, dbError: error.message };
  }
};

exports.getSetupStatus = async (req, res) => {
  const status = {
    configured: isConfigured(),
    dbConnected: mongoose.connection.readyState === 1,
  };
  res.json(status);
};

exports.getSetupConfig = async (req, res) => {
  if (!canAccessSetupConfig(req)) {
    return res.status(403).json({ error: 'Only admin can access setup configuration after initial setup.' });
  }

  res.json({
    configured: isConfigured(),
    config: getConfigForClient({ includeSensitive: true }),
  });
};

exports.saveSetupConfig = async (req, res) => {
  if (!canAccessSetupConfig(req)) {
    return res.status(403).json({ error: 'Only admin can update setup configuration after initial setup.' });
  }

  const payload = buildConfigPayload(req.body || {});
  const validationError = validatePayload(payload);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  saveRuntimeConfig(payload);
  resetTransporter();

  const dbResult = await tryReconnectDatabase();

  return res.json({
    message: 'Setup configuration saved successfully.',
    configured: isConfigured(),
    ...dbResult,
  });
};
