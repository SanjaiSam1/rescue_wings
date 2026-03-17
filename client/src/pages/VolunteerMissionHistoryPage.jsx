import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { volunteerAPI } from '../services/api';

const STATUS_LABELS = {
  rescued: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_STYLES = {
  rescued: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-700',
};

export default function VolunteerMissionHistoryPage() {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    volunteerAPI
      .getHistory()
      .then(({ data }) => setMissions(data.requests || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout title="Mission History">
      <div className="max-w-5xl mx-auto">
        <div className="card mb-6">
          <h2 className="text-xl font-bold text-gray-900">Completed and Cancelled Missions</h2>
          <p className="text-sm text-gray-500 mt-1">Review outcomes, citizen details, and timestamps.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : missions.length === 0 ? (
          <div className="card text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">📘</div>
            <p>No mission history found yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {missions.map((mission) => (
              <div key={mission._id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-lg text-gray-900 capitalize">{mission.disasterType} Mission</div>
                    <div className="text-sm text-gray-500 mt-1">Citizen: {mission.userId?.name || 'Unknown'}</div>
                    <div className="text-sm text-gray-500">Phone: {mission.userId?.phone || 'N/A'}</div>
                  </div>
                  <span className={`status-badge ${STATUS_STYLES[mission.status] || 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_LABELS[mission.status] || mission.status}
                  </span>
                </div>

                <div className="mt-3 text-sm text-gray-700">
                  <strong>Description:</strong> {mission.description}
                </div>

                <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm text-gray-600">
                  <div>Created: {new Date(mission.createdAt).toLocaleString()}</div>
                  <div>Resolved: {mission.resolvedAt ? new Date(mission.resolvedAt).toLocaleString() : 'N/A'}</div>
                </div>

                {mission.statusHistory?.length > 0 && (
                  <div className="mt-4 rounded-xl border border-gray-200 p-3">
                    <div className="text-xs font-semibold text-gray-500 mb-2 uppercase">Outcome Notes</div>
                    <div className="space-y-2">
                      {mission.statusHistory
                        .filter((entry) => ['rescued', 'cancelled'].includes(entry.status) || entry.note?.toLowerCase().includes('reject'))
                        .map((entry, idx) => (
                          <div key={`${entry.timestamp}-${idx}`} className="text-sm text-gray-700">
                            <span className="font-semibold capitalize">{entry.status}</span>: {entry.note || 'No note'}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
