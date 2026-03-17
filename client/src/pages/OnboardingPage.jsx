import React from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { getHomeRouteByRole } from '../utils/roleRoutes';

const ROLE_GUIDES = {
  citizen: {
    title: 'Citizen Quick Start',
    subtitle: 'You can request rescue help and track support in real time.',
    steps: [
      'Keep your phone and location permissions enabled for accurate rescue tracking.',
      'Use SOS Request to submit your emergency details with clear description.',
      'Use Chat to coordinate with assigned volunteers during active rescue.',
      'Check Alerts regularly for evacuation and safety updates.',
    ],
  },
  volunteer: {
    title: 'Volunteer Mission Brief',
    subtitle: 'You can accept missions and update rescue progress live.',
    steps: [
      'Set availability to available only when you are ready to respond immediately.',
      'Monitor pending requests and accept only missions you can safely handle.',
      'Update mission status frequently so citizens and admin can track progress.',
      'Use chat for clear communication and provide timely on-ground updates.',
    ],
  },
  admin: {
    title: 'Admin Operations Setup',
    subtitle: 'You can supervise operations, volunteers, and public alerts.',
    steps: [
      'Review pending volunteer verifications before assigning critical responsibilities.',
      'Track request statuses and intervene in delayed or stalled operations.',
      'Broadcast accurate alerts with clear severity and action guidance.',
      'Use map and dashboard trends to prioritize high-risk zones quickly.',
    ],
  },
};

export default function OnboardingPage() { 
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role || 'citizen';
  const guide = ROLE_GUIDES[role] || ROLE_GUIDES.citizen;

  const handleComplete = () => {
    const onboardingKey = user?._id || user?.email || role;
    localStorage.setItem(`rw_onboarded_${onboardingKey}`, 'true');
    navigate(getHomeRouteByRole(role), { replace: true });
  };

  return (
    <DashboardLayout title="Welcome Onboard">
      <div className="max-w-3xl mx-auto">
        <div className="card border-2 border-primary/10">
          <div className="mb-2 text-sm uppercase tracking-wide font-semibold text-primary">{role} onboarding</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{guide.title}</h2>
          <p className="text-gray-600 mb-6">{guide.subtitle}</p>

          <div className="space-y-3 mb-8">
            {guide.steps.map((step, index) => (
              <div key={step} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="w-7 h-7 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center mt-0.5">
                  {index + 1}
                </span>
                <p className="text-gray-700 text-sm leading-6">{step}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={handleComplete} className="btn-primary">
              Complete Setup
            </button>
            <button
              onClick={handleComplete}
              className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
            >
              Skip For Now
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
