/**
 * Landing Page - Hero, features, safety tips
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { alertAPI } from '../services/api';

const SAFETY_TIPS = [
  { icon: '🌊', title: 'Flood Safety', tip: 'Move to higher ground immediately. Never walk through moving water.' },
  { icon: '🏔️', title: 'Earthquake', tip: 'Drop, Cover, and Hold On. Stay away from windows.' },
  { icon: '🔥', title: 'Fire Emergency', tip: 'Evacuate immediately. Call emergency services. Never use elevators.' },
  { icon: '🌪️', title: 'Cyclone/Storm', tip: 'Seek shelter in a sturdy building. Stay away from windows.' },
  { icon: '🏔️', title: 'Landslide', tip: 'Move quickly away from the path. Avoid river valleys.' },
  { icon: '🌊', title: 'Tsunami', tip: 'Move inland immediately after an earthquake near the coast.' },
];

const STATS = [
  { label: 'Rescue Operations', value: '2,847' },
  { label: 'Lives Saved', value: '12,400+' },
  { label: 'Active Volunteers', value: '3,200' },
  { label: 'Cities Covered', value: '180' },
];

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [showAlertBanner, setShowAlertBanner] = useState(false);

  useEffect(() => {
    alertAPI.getAll({ active: true }).then(({ data }) => {
      if (data.alerts.length > 0) {
        setAlerts(data.alerts);
        setShowAlertBanner(true);
      }
    }).catch(() => {});
  }, []);

  const handleSOS = () => {
    navigate('/login?role=citizen');
  };

  const handleVolunteer = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Alert Banner */}
      {showAlertBanner && alerts[0] && (
        <div className="bg-red-600 text-white py-2 px-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="animate-pulse">⚠️</span>
            <strong>ACTIVE ALERT:</strong> {alerts[0].title}
          </span>
          <button onClick={() => setShowAlertBanner(false)} className="ml-4 text-white/80 hover:text-white">✕</button>
        </div>
      )}

      {/* Navbar */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <span className="text-3xl">🚁</span>
            <div>
              <div className="font-display text-2xl text-primary tracking-widest">RESCUE WINGS</div>
              <div className="text-xs text-gray-500 -mt-1">Disaster Response System</div>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/alerts" className="text-gray-600 hover:text-primary font-medium transition-colors">Alerts</Link>
            <Link to="/login" className="text-gray-600 hover:text-primary font-medium transition-colors">Login</Link>
            {user ? (
              <Link to="/home" className="btn-primary">Dashboard</Link>
            ) : (
              <Link to="/register" className="btn-primary">Join Now</Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
              style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${i * 0.3}s` }} />
          ))}
        </div>
        <div className="relative max-w-7xl mx-auto px-4 py-24 md:py-36 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-red-600/20 border border-red-500/30 rounded-full px-4 py-2 text-red-300 text-sm mb-6">
              <span className="animate-pulse w-2 h-2 bg-red-400 rounded-full inline-block"></span>
              24/7 Emergency Response Active
            </div>
            <h1 className="font-display text-6xl md:text-8xl tracking-widest mb-4">
              RESCUE<br />
              <span className="text-primary">WINGS</span>
            </h1>
            <p className="text-gray-300 text-xl md:text-2xl mb-8 max-w-xl leading-relaxed">
              When disaster strikes, every second counts. Connect with rescue teams instantly and coordinate relief operations in real-time.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <button onClick={handleSOS}
                className="sos-pulse bg-red-600 hover:bg-red-700 text-white text-xl font-bold px-10 py-5 rounded-2xl transition-all duration-200 shadow-2xl">
                🆘 SOS EMERGENCY
              </button>
              <button
                type="button"
                onClick={handleVolunteer}
                className="border-2 border-white/30 hover:border-white text-white px-10 py-5 rounded-2xl font-bold text-xl transition-all duration-200 text-center">
                🦺 Be a Volunteer
              </button>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-4 max-w-sm">
            {STATS.map(stat => (
              <div key={stat.label} className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6 text-center">
                <div className="font-display text-4xl text-primary tracking-wider">{stat.value}</div>
                <div className="text-gray-300 text-sm mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="font-display text-5xl tracking-widest text-gray-900 mb-4">HOW IT WORKS</h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">Three simple steps to get help or provide it during any disaster</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: '📍', title: 'Request Help', desc: 'Tap SOS and share your location. Describe the emergency and upload images.', color: 'bg-red-50 border-red-200' },
              { step: '02', icon: '🗺️', title: 'Get Matched', desc: 'Nearby volunteers are instantly notified. Real-time tracking begins immediately.', color: 'bg-blue-50 border-blue-200' },
              { step: '03', icon: '✅', title: 'Get Rescued', desc: 'Track your rescuer in real-time. Stay in contact via built-in chat.', color: 'bg-green-50 border-green-200' },
            ].map(item => (
              <div key={item.step} className={`${item.color} border-2 rounded-3xl p-8 relative overflow-hidden`}>
                <div className="absolute top-4 right-4 font-display text-6xl text-gray-200/80">{item.step}</div>
                <div className="text-5xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Safety Tips */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="font-display text-5xl tracking-widest text-gray-900 mb-4">DISASTER SAFETY TIPS</h2>
            <p className="text-gray-500 text-lg">Essential knowledge that could save your life</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SAFETY_TIPS.map(tip => (
              <div key={tip.title} className="card hover:shadow-md transition-shadow group">
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform inline-block">{tip.icon}</div>
                <h3 className="font-bold text-lg mb-2 text-gray-900">{tip.title}</h3>
                <p className="text-gray-500">{tip.tip}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary py-20 text-white text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="font-display text-5xl tracking-widest mb-6">READY TO HELP?</h2>
          <p className="text-red-100 text-xl mb-10">Join our network of volunteers and help save lives in your community during disasters.</p>
          <Link to="/register" className="bg-white text-primary font-bold text-xl px-12 py-5 rounded-2xl hover:bg-gray-100 transition-colors shadow-xl inline-block">
            Register Now — It's Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="font-display text-2xl text-white tracking-widest mb-3">🚁 RESCUE WINGS</div>
              <p className="text-sm">A web-based disaster rescue coordination platform for real-time emergency response.</p>
            </div>
            <div>
              <div className="font-semibold text-white mb-3">Platform</div>
              <div className="space-y-2 text-sm">
                <Link to="/alerts" className="block hover:text-white">Alerts</Link>
                <button
                  type="button"
                  onClick={handleSOS}
                  className="block hover:text-white text-left"
                >
                  Emergency
                </button>
              </div>
            </div>
            <div>
              <div className="font-semibold text-white mb-3">Emergency Lines</div>
              <div className="space-y-2 text-sm">
                <p>🆘 National Emergency: 112</p>
                <p>🚒 Fire: 101</p>
                <p>🚑 Ambulance: 108</p>
                <p>👮 Police: 100</p>
              </div>
            </div>
            <div>
              <div className="font-semibold text-white mb-3">Account</div>
              <div className="space-y-2 text-sm">
                <Link to="/register" className="block hover:text-white">Register</Link>
                <Link to="/login" className="block hover:text-white">Login</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>© {new Date().getFullYear()} Rescue Wings. Built to save lives.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
