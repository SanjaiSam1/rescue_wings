import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import { getHomeRouteByRole } from '../utils/roleRoutes';

const TEST_OTP = '123456';

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState(TEST_OTP);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const { data } = await authAPI.verifyOtp({ email, otp });
      if (data?.token && data?.user) {
        localStorage.setItem('rw_token', data.token);
        localStorage.setItem('rw_user', JSON.stringify(data.user));
        localStorage.setItem('rw_remember_me', 'false');
        setSuccess(data.message || 'OTP verified successfully. Redirecting to dashboard...');
        const homeRoute = getHomeRouteByRole(data.user.role);
        setTimeout(() => {
          window.location.href = homeRoute;
        }, 600);
        return;
      }

      setSuccess(data.message || 'OTP verified. You can login now.');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Email</h2>
        <p className="text-gray-500 mb-6">Enter the 6-digit OTP to continue.</p>

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
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">OTP</label>
            <input
              type="text"
              className="input-field tracking-[0.4em]"
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
            />
            <p className="text-xs text-gray-500 mt-2">Test OTP: 123456 (auto-filled for testing)</p>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>

        <div className="mt-4 flex items-end justify-end text-sm">
          <Link to="/login" className="text-gray-600 hover:underline">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
