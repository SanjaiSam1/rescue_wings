const nodemailer = require('nodemailer');

let transporter = null;

const resetTransporter = () => {
  transporter = null;
};

const isPlaceholderValue = (value = '') => {
  const normalized = String(value).trim().toLowerCase();
  return (
    !normalized
    || normalized.includes('your_email@gmail.com')
    || normalized.includes('your_16_char_app_password')
    || normalized.includes('your_smtp_user')
    || normalized.includes('your_smtp_password')
    || normalized.includes('smtp.example.com')
  );
};

class MailConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MailConfigurationError';
    this.code = 'MAIL_NOT_CONFIGURED';
  }
}

const hasSmtpConfig = () => {
  return Boolean(
    process.env.SMTP_HOST
    && process.env.SMTP_PORT
    && process.env.SMTP_USER
    && process.env.SMTP_PASS
    && !isPlaceholderValue(process.env.SMTP_HOST)
    && !isPlaceholderValue(process.env.SMTP_USER)
    && !isPlaceholderValue(process.env.SMTP_PASS)
  );
};

const hasGmailConfig = () => {
  return Boolean(
    process.env.GMAIL_USER
    && process.env.GMAIL_APP_PASSWORD
    && !isPlaceholderValue(process.env.GMAIL_USER)
    && !isPlaceholderValue(process.env.GMAIL_APP_PASSWORD)
  );
};

const getTransporter = () => {
  if (transporter) return transporter;

  if (hasGmailConfig()) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
    return transporter;
  }

  if (!hasSmtpConfig()) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

const sendMail = async ({ to, subject, text, html }) => {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || process.env.GMAIL_USER || 'no-reply@rescuewings.local';
  const tx = getTransporter();

  if (!tx) {
    throw new MailConfigurationError(
      'Email service is not configured. Set either GMAIL_USER and GMAIL_APP_PASSWORD, or SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS in server/.env.'
    );
  }

  await tx.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return { sent: true };
};

module.exports = { sendMail, MailConfigurationError, resetTransporter };