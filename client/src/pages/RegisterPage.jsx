import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getHomeRouteByRole } from '../utils/roleRoutes';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role') === 'volunteer' ? 'volunteer' : 'citizen';
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    age: '',
    address: '',
    idNumber: '',
    specificationType: '',
    role: initialRole,
  });
  const [proofDocument, setProofDocument] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value));
      if (proofDocument) {
        payload.append('proofDocument', proofDocument);
      }

      const data = await register(payload);
      const successMessage = [data.message, data.warning].filter(Boolean).join(' ') || 'Registration submitted.';
      setSuccess(successMessage);

      if (data?.token && data?.user) {
        const onboardingKey = data.user._id || data.user.email || data.user.role;
        localStorage.setItem(`rw_onboarded_${onboardingKey}`, 'true');
        const homeRoute = getHomeRouteByRole(data.user.role);
        setTimeout(() => navigate(homeRoute), 600);
        return;
      }

      if (data?.requiresApproval) {
        setTimeout(() => navigate(`/pending-approval?email=${encodeURIComponent(form.email)}`), 900);
        return;
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8 text-white">
          <span className="text-4xl">🚁</span>
          <span className="font-display text-3xl tracking-widest">RESCUE WINGS</span>
        </Link>
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Create an account</h2>
          <p className="text-gray-500 mb-8">Join the rescue network and make a difference</p>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 mb-6 text-sm">{success}</div>}

          {/* Role Selector */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[{ value: 'citizen', label: '👤 Citizen', desc: 'Request help' },
              { value: 'volunteer', label: '🦺 Volunteer', desc: 'Provide help' }].map(r => (
              <button key={r.value} type="button" onClick={() => setForm({...form, role: r.value})}
                className={`p-4 rounded-xl border-2 text-left transition-all ${form.role === r.value ? 'border-primary bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="font-semibold text-sm">{r.label}</div>
                <div className="text-xs text-gray-500">{r.desc}</div>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
              <input type="text" required value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                className="input-field" placeholder="John Doe" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
              <input type="email" required value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                className="input-field" placeholder="your@email.com" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
              <input type="tel" required value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value})}
                className="input-field" placeholder="+91 9876543210" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Age</label>
              <input type="number" required min={1} max={120} value={form.age}
                onChange={e => setForm({...form, age: e.target.value})}
                className="input-field" placeholder="e.g. 27" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
              <input type="text" required value={form.address}
                onChange={e => setForm({...form, address: e.target.value})}
                className="input-field" placeholder="Street, City, State" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">ID Number</label>
              <input type="text" required value={form.idNumber}
                onChange={e => setForm({...form, idNumber: e.target.value})}
                className="input-field" placeholder="Government ID / Employee ID" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Specification / Profile Type</label>
              <input type="text" required value={form.specificationType}
                onChange={e => setForm({...form, specificationType: e.target.value})}
                className="input-field" placeholder="Department or category" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Proof Document (Image/PDF) - Optional</label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setProofDocument(e.target.files?.[0] || null)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
              <input type="password" required minLength={6} value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                className="input-field" placeholder="At least 6 characters" />
            </div>
            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"/><span>Creating...</span></> : 'Create Account'}
            </button>
          </form>
          <p className="mt-6 text-center text-gray-500">Already have an account? <Link to="/login" className="text-primary font-semibold hover:underline">Sign In</Link></p>
        </div>
      </div>
    </div>
  );
}
