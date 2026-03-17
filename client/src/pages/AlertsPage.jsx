import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { alertAPI } from '../services/api';
import { getSocket } from '../services/socket';

const SEVERITY_STYLES = {
  low: 'bg-green-50 border-green-200',
  medium: 'bg-yellow-50 border-yellow-200',
  high: 'bg-orange-50 border-orange-200',
  critical: 'bg-red-50 border-red-300 animate-pulse',
};

const TYPE_ICONS = { warning: '⚠️', danger: '🚨', info: 'ℹ️', evacuation: '🏃' };

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    alertAPI.getAll().then(({ data }) => setAlerts(data.alerts)).finally(() => setLoading(false));
    const socket = getSocket();
    if (socket) {
      socket.on('emergency_alert', (alert) => setAlerts(prev => [alert, ...prev]));
      return () => socket.off('emergency_alert');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-display text-2xl text-primary tracking-widest">🚁 RESCUE WINGS</Link>
        <Link to="/login" className="btn-primary py-2">Dashboard</Link>
      </nav>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="font-display text-5xl tracking-widest text-gray-900 mb-2">ALERTS</h1>
        <p className="text-gray-500 mb-8">Live emergency alerts and disaster warnings</p>
        {loading ? (
          <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"/></div>
        ) : alerts.length === 0 ? (
          <div className="card text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">✅</div>
            <p>No active alerts at this time. Stay safe!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map(alert => (
              <div key={alert._id} className={`border-2 rounded-2xl p-6 ${SEVERITY_STYLES[alert.severity] || 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{TYPE_ICONS[alert.type] || '⚠️'}</span>
                    <div>
                      <h2 className="font-bold text-gray-900 text-lg">{alert.title}</h2>
                      <div className="flex gap-2 mt-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${
                          alert.severity === 'critical' ? 'bg-red-600 text-white' :
                          alert.severity === 'high' ? 'bg-orange-500 text-white' :
                          alert.severity === 'medium' ? 'bg-yellow-500 text-white' : 'bg-green-500 text-white'
                        }`}>{alert.severity}</span>
                        <span className="text-xs font-semibold bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full capitalize">{alert.type}</span>
                      </div>
                    </div>
                  </div>
                  <div className={`w-3 h-3 rounded-full mt-1 ${alert.isActive ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}/>
                </div>
                <p className="text-gray-700 mt-3 leading-relaxed">{alert.message}</p>
                {alert.affectedAreas?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {alert.affectedAreas.map(area => (
                      <span key={area} className="text-xs bg-white border border-gray-300 text-gray-600 px-2 py-0.5 rounded-full">📍 {area}</span>
                    ))}
                  </div>
                )}
                <div className="mt-3 text-xs text-gray-400">
                  Issued by {alert.createdBy?.name} • {new Date(alert.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
