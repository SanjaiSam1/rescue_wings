import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const { data } = await authAPI.forgotPassword({ email });
      setSuccess(data.message || 'If that email exists, a reset link has been sent.');
    } catch (err) {
      setError(err.response?.data?.error || 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Forgot Password</h2>
        <p className="text-gray-500 mb-6">Enter your account email and we will send a reset link.</p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 mb-4 text-sm">{success}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
            <input
              type="email"
              className="input-field"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-4 text-sm">
          <Link to="/login" className="text-primary font-semibold hover:underline">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
