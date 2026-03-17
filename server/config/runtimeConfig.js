const fs = require('fs');
const path = require('path');

const resolveConfigDirectory = () => {
  const explicitDir = String(process.env.RUNTIME_CONFIG_DIR || '').trim();
  if (explicitDir) return explicitDir;

  if (process.pkg) {
    return path.join(path.dirname(process.execPath), 'config');
  }

  return __dirname;
};

const runtimeConfigPath = path.join(resolveConfigDirectory(), 'runtime-config.json');

const CONFIG_KEYS = [
  'MONGODB_URI',
  'CLIENT_URL',
  'APP_BASE_URL',
  'JWT_SECRET',
  'JWT_EXPIRE',
  'JWT_REMEMBER_EXPIRE',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'MAIL_FROM',
  'GMAIL_USER',
  'GMAIL_APP_PASSWORD',
];

const SENSITIVE_KEYS = ['SMTP_PASS', 'GMAIL_APP_PASSWORD', 'JWT_SECRET'];

const ensureConfigFileExists = () => {
  const configDir = path.dirname(runtimeConfigPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  if (!fs.existsSync(runtimeConfigPath)) {
    fs.writeFileSync(runtimeConfigPath, JSON.stringify({}, null, 2), 'utf8');
  }
};

const readRuntimeConfig = () => {
  ensureConfigFileExists();
  const raw = fs.readFileSync(runtimeConfigPath, 'utf8');
  const parsed = JSON.parse(raw || '{}');
  return Object.keys(parsed).reduce((acc, key) => {
    if (CONFIG_KEYS.includes(key)) {
      acc[key] = parsed[key];
    }
    return acc;
  }, {});
};

const applyRuntimeConfigToEnv = (config = {}) => {
  CONFIG_KEYS.forEach((key) => {
    const value = config[key];
    if (value === undefined || value === null || value === '') return;
    process.env[key] = String(value);
  });
};

const loadRuntimeConfig = () => {
  const config = readRuntimeConfig();
  applyRuntimeConfigToEnv(config);
  return config;
};

const saveRuntimeConfig = (updates = {}) => {
  const previous = readRuntimeConfig();
  const next = { ...previous };

  CONFIG_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      const value = updates[key];
      if (value === null || value === undefined) {
        delete next[key];
      } else {
        next[key] = String(value).trim();
      }
    }
  });

  fs.writeFileSync(runtimeConfigPath, JSON.stringify(next, null, 2), 'utf8');
  applyRuntimeConfigToEnv(next);
  return next;
};

const getConfigForClient = ({ includeSensitive = false } = {}) => {
  const config = readRuntimeConfig();
  if (includeSensitive) return config;

  return Object.keys(config).reduce((acc, key) => {
    if (SENSITIVE_KEYS.includes(key)) {
      acc[key] = config[key] ? '********' : '';
      return acc;
    }
    acc[key] = config[key];
    return acc;
  }, {});
};

const isConfigured = () => {
  const mongo = String(process.env.MONGODB_URI || '').trim();
  const clientUrl = String(process.env.CLIENT_URL || '').trim();
  const appBaseUrl = String(process.env.APP_BASE_URL || '').trim();
  const hasSmtp = Boolean(
    String(process.env.SMTP_HOST || '').trim()
    && String(process.env.SMTP_PORT || '').trim()
    && String(process.env.SMTP_USER || '').trim()
    && String(process.env.SMTP_PASS || '').trim()
  );
  const hasGmail = Boolean(
    String(process.env.GMAIL_USER || '').trim()
    && String(process.env.GMAIL_APP_PASSWORD || '').trim()
  );

  return Boolean(mongo && clientUrl && appBaseUrl && (hasSmtp || hasGmail));
};

module.exports = {
  CONFIG_KEYS,
  runtimeConfigPath,
  loadRuntimeConfig,
  saveRuntimeConfig,
  getConfigForClient,
  isConfigured,
};
