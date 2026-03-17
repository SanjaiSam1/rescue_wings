import React from 'react';

export default function MissionStatusUpdater({ mission, onAdvance, onReject, busy }) {
  if (!mission) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
        No active mission selected.
      </div>
    );
  }

  const getAction = () => {
    if (mission.status === 'accepted') {
      return { next: 'in-progress', label: 'Start Mission' };
    }
    if (mission.status === 'in-progress') {
      return { next: 'rescued', label: 'Mark Completed' };
    }
    return null;
  };

  const action = getAction();

  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-white">
      <div className="text-sm font-semibold text-gray-800 mb-3">Mission Status Updater</div>
      <div className="text-xs text-gray-500 mb-4">
        Flow: Accepted -&gt; In Progress -&gt; Completed
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
          {mission.status}
        </span>
        <span className="text-gray-400">{'->'}</span>
        <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
          {action ? action.next : 'done'}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {action && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAdvance(mission, action.next)}
            className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? 'Updating...' : action.label}
          </button>
        )}
        {['accepted', 'in-progress'].includes(mission.status) && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onReject(mission)}
            className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 disabled:opacity-60"
          >
            Reject with Reason
          </button>
        )}
      </div>
    </div>
  );
}
