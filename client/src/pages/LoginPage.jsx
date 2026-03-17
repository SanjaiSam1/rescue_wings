import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getHomeRouteByRole } from '../utils/roleRoutes';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryRole = String(searchParams.get('role') || '').toLowerCase();
  const initialRole = ['citizen', 'volunteer', 'admin'].includes(queryRole) ? queryRole : 'citizen';
  const [form, setForm] = useState({ email: '', password: '', role: initialRole, rememberMe: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(form.email, form.password, form.role, form.rememberMe);
      navigate(getHomeRouteByRole(data.user.role));
    } catch (err) {
      const payload = err.response?.data;
      if (payload?.requiresVerification && payload?.email) {
        navigate(`/verify-otp?email=${encodeURIComponent(payload.email)}`);
        return;
      }
      setError(payload?.error || payload?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8 text-white">
          <span className="text-4xl">🚁</span>
          <span className="font-display text-3xl tracking-widest">RESCUE WINGS</span>
        </Link>
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h2>
          <p className="text-gray-500 mb-8">Sign in to access your rescue dashboard</p>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">{error}</div>}

          <div className="grid grid-cols-3 gap-2 mb-5">
            {[
              { value: 'citizen', label: '👤 Citizen' },
              { value: 'volunteer', label: '🦺 Volunteer' },
              { value: 'admin', label: '🛡️ Admin' },
            ].map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => setForm({ ...form, role: r.value })}
                className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  form.role === r.value
                    ? 'border-primary bg-red-50 text-primary'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
              <input type="email" required value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                className="input-field" placeholder="your@email.com" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
              <input type="password" required value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                className="input-field" placeholder="••••••••" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={form.rememberMe}
                  onChange={(e) => setForm({ ...form, rememberMe: e.target.checked })}
                />
                Remember me for longer session
              </label>
              <Link to="/forgot-password" className="text-sm text-primary font-semibold hover:underline">
                Forgot Password?
              </Link>
            </div>
            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"/><span>Signing in...</span></> : 'Sign In'}
            </button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-gray-500">Don't have an account? <Link to="/register" className="text-primary font-semibold hover:underline">Register</Link></p>
          </div>
          {/* Demo credentials */}
          <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <div className="font-bold mb-2">Demo Login Credentials</div>
            <div className="space-y-1">
              <div><span className="font-semibold">Citizen:</span> citizen.demo@rescue.com / Citizen@123</div>
              <div><span className="font-semibold">Volunteer:</span> volunteer.demo@rescue.com / Volunteer@123</div>
              <div><span className="font-semibold">Admin:</span> admin.demo@rescue.com / Admin@123</div>
            </div>
            <div className="mt-2 text-xs text-blue-600">Select the matching role button above before signing in.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
