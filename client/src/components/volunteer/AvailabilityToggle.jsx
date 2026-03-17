import React from 'react';

const OPTIONS = [
  { value: 'available', label: 'Available', color: 'bg-green-500' },
  { value: 'busy', label: 'Busy', color: 'bg-orange-500' },
  { value: 'offline', label: 'Offline', color: 'bg-gray-500' },
];

export default function AvailabilityToggle({ value, onChange, disabled }) {
  return (
    <div className="card flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="font-bold text-gray-900">Availability</div>
        <div className="text-sm text-gray-500">Update your mission readiness with one tap.</div>
      </div>
      <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden bg-white">
        {OPTIONS.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${
                active ? `${option.color} text-white` : 'text-gray-600 hover:bg-gray-50'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
