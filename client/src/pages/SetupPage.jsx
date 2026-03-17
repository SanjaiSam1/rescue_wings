import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setupAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const DEFAULT_FORM = {
  MONGODB_URI: '',
  CLIENT_URL: '',
  APP_BASE_URL: '',
  JWT_SECRET: '',
  JWT_EXPIRE: '7d',
  JWT_REMEMBER_EXPIRE: '30d',
  SMTP_HOST: '',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  SMTP_USER: '',
  SMTP_PASS: '',
  MAIL_FROM: '',
  GMAIL_USER: '',
  GMAIL_APP_PASSWORD: '',
};

const needsMaskReplace = (value) => typeof value === 'string' && value.includes('*');

export default function SetupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ configured: false, dbConnected: false });
  const [form, setForm] = useState(DEFAULT_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isAdmin = user?.role === 'admin';

  const title = useMemo(() => {
    if (!status.configured) return 'First-Time Setup';
    return 'System Configuration';
  }, [status.configured]);

  const loadConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data: statusData }, { data: configData }] = await Promise.all([
        setupAPI.getStatus(),
        setupAPI.getConfig(),
      ]);

      setStatus(statusData || { configured: false, dbConnected: false });
      setForm((prev) => ({
        ...prev,
        ...(configData?.config || {}),
      }));
    } catch (err) {
      const message = err.response?.data?.error || 'Unable to load setup configuration.';
      setError(message);
      const { data: statusData } = await setupAPI.getStatus();
      setStatus(statusData || { configured: false, dbConnected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig().catch(() => {});
  }, []);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    const payload = { ...form };
    Object.keys(payload).forEach((key) => {
      if (needsMaskReplace(payload[key])) {
        delete payload[key];
      }
    });

    try {
      const { data } = await setupAPI.saveConfig(payload);
      setStatus((prev) => ({ ...prev, configured: Boolean(data.configured), dbConnected: Boolean(data.dbConnected) }));
      setSuccess(data.message || 'Configuration saved successfully.');

      if (data.dbError) {
        setError(`Configuration saved, but database reconnection failed: ${data.dbError}`);
      }

      if (!isAdmin) {
        setTimeout(() => navigate('/login'), 900);
      } else {
        loadConfig().catch(() => {});
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl p-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Configure database, app URLs, and email credentials directly in-app. Manual .env edits are not required.
            </p>
          </div>
          {status.configured && isAdmin && (
            <Link to="/admin" className="text-sm text-primary font-semibold hover:underline">Back to Admin</Link>
          )}
        </div>

        {!status.configured && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Initial setup is required before users can register and login.
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-5 text-sm">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 mb-5 text-sm">{success}</div>}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Core App</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Database URL</label>
                  <input className="input-field" value={form.MONGODB_URI} onChange={(e) => handleChange('MONGODB_URI', e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Client URL</label>
                  <input className="input-field" value={form.CLIENT_URL} onChange={(e) => handleChange('CLIENT_URL', e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">App Base URL</label>
                  <input className="input-field" value={form.APP_BASE_URL} onChange={(e) => handleChange('APP_BASE_URL', e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">JWT Secret</label>
                  <input className="input-field" value={form.JWT_SECRET} onChange={(e) => handleChange('JWT_SECRET', e.target.value)} placeholder="Optional override" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">JWT Expiry</label>
                  <input className="input-field" value={form.JWT_EXPIRE} onChange={(e) => handleChange('JWT_EXPIRE', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Remember Me Expiry</label>
                  <input className="input-field" value={form.JWT_REMEMBER_EXPIRE} onChange={(e) => handleChange('JWT_REMEMBER_EXPIRE', e.target.value)} />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">SMTP Settings</h2>
              <p className="text-xs text-gray-500 mb-3">Fill SMTP or Gmail fields. At least one email method is required.</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">SMTP Host</label>
                  <input className="input-field" value={form.SMTP_HOST} onChange={(e) => handleChange('SMTP_HOST', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">SMTP Port</label>
                  <input className="input-field" value={form.SMTP_PORT} onChange={(e) => handleChange('SMTP_PORT', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">SMTP Secure</label>
                  <select className="input-field" value={form.SMTP_SECURE} onChange={(e) => handleChange('SMTP_SECURE', e.target.value)}>
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">SMTP Email/User</label>
                  <input className="input-field" value={form.SMTP_USER} onChange={(e) => handleChange('SMTP_USER', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">SMTP Password</label>
                  <input className="input-field" type="password" value={form.SMTP_PASS} onChange={(e) => handleChange('SMTP_PASS', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Mail From</label>
                  <input className="input-field" value={form.MAIL_FROM} onChange={(e) => handleChange('MAIL_FROM', e.target.value)} />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Gmail Alternative</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Gmail Address</label>
                  <input className="input-field" value={form.GMAIL_USER} onChange={(e) => handleChange('GMAIL_USER', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Gmail App Password</label>
                  <input className="input-field" type="password" value={form.GMAIL_APP_PASSWORD} onChange={(e) => handleChange('GMAIL_APP_PASSWORD', e.target.value)} />
                </div>
              </div>
            </section>

            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                DB connection: {status.dbConnected ? 'Connected' : 'Not connected'}
              </div>
              <button type="submit" disabled={saving} className="btn-primary px-6 disabled:opacity-60">
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
