import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export default function PendingApprovalPage() {
  const [params] = useSearchParams();
  const email = params.get('email') || 'your registered email';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Volunteer Application Submitted</h1>
        <p className="text-gray-700 mb-2">
          Your volunteer application has been submitted. You will be approved once the admin validates your details. Please wait a few minutes.
        </p>
        <p className="text-sm text-gray-500 mb-6">Registered email: {email}</p>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm mb-6">
          Your volunteer dashboard stays locked until approval. You will receive an email update on your registered Gmail.
        </div>

        <div className="flex items-center justify-between text-sm">
          <Link to="/login" className="text-primary font-semibold hover:underline">Back to Login</Link>
          <Link to="/" className="text-gray-600 hover:underline">Go to Home</Link>
        </div>
      </div>
    </div>
  );
}