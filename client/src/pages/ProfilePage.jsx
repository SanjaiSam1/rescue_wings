import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { authAPI, volunteerAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const EMPTY_CONTACT = { name: '', phone: '', relation: '' };
const SKILL_OPTIONS = [
  'first-aid',
  'swimming',
  'driving',
  'medical',
  'search-rescue',
  'firefighting',
  'counseling',
  'logistics',
  'other',
];

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    emergencyContacts: user?.emergencyContacts?.length
      ? user.emergencyContacts.slice(0, 3)
      : [EMPTY_CONTACT],
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [volunteerForm, setVolunteerForm] = useState({
    skills: [],
    organization: '',
    experience: 0,
    certificationsText: '',
  });

  const canEditEmergencyContacts = useMemo(() => user?.role === 'citizen', [user?.role]);
  const isVolunteer = useMemo(() => user?.role === 'volunteer', [user?.role]);

  useEffect(() => {
    if (!isVolunteer) return;
    volunteerAPI.getMe().then(({ data }) => {
      const volunteer = data?.volunteer;
      if (!volunteer) return;
      setVolunteerForm({
        skills: volunteer.skills || [],
        organization: volunteer.organization || '',
        experience: volunteer.experience || 0,
        certificationsText: (volunteer.certifications || []).join(', '),
      });
    }).catch(() => {});
  }, [isVolunteer]);

  const handleResetOnboarding = () => {
    const onboardingKey = user?._id || user?.email || user?.role;
    if (!onboardingKey) return;
    localStorage.removeItem(`rw_onboarded_${onboardingKey}`);
    navigate('/onboarding');
  };

  const handleContactChange = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.map((contact, i) =>
        i === index ? { ...contact, [key]: value } : contact
      ),
    }));
  };

  const addContact = () => {
    setForm((prev) => {
      if (prev.emergencyContacts.length >= 3) return prev;
      return { ...prev, emergencyContacts: [...prev.emergencyContacts, EMPTY_CONTACT] };
    });
  };

  const removeContact = (index) => {
    setForm((prev) => {
      const nextContacts = prev.emergencyContacts.filter((_, i) => i !== index);
      return {
        ...prev,
        emergencyContacts: nextContacts.length ? nextContacts : [EMPTY_CONTACT],
      };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name: form.name,
        phone: form.phone,
      };

      if (canEditEmergencyContacts) {
        payload.emergencyContacts = form.emergencyContacts
          .filter((c) => c.name.trim() || c.phone.trim() || c.relation.trim())
          .map((c) => ({
            name: c.name.trim(),
            phone: c.phone.trim(),
            relation: c.relation.trim(),
          }));
      }

      const { data } = await authAPI.updateProfile(payload);
      updateUser(data.user);

      if (isVolunteer) {
        await volunteerAPI.updateProfile({
          skills: volunteerForm.skills,
          organization: volunteerForm.organization,
          experience: Number(volunteerForm.experience) || 0,
          certifications: volunteerForm.certificationsText
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean),
        });
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update profile');
    }

    setSaving(false);
  };

  return (
    <DashboardLayout title="Profile">
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <div className="flex items-center gap-5 mb-8 pb-6 border-b">
            <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-white font-display text-3xl">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{user?.name}</h2>
              <div className="text-gray-500 capitalize">{user?.role}</div>
              <div className="text-sm text-gray-400">{user?.email}</div>
            </div>
          </div>

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 mb-6 text-sm">
              Profile updated successfully.
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
              <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
              <input className="input-field bg-gray-50" value={user?.email || ''} disabled />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
              <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
              <input className="input-field bg-gray-50 capitalize" value={user?.role || ''} disabled />
            </div>

            {canEditEmergencyContacts && (
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-gray-700">Emergency Contacts</label>
                  <button
                    type="button"
                    onClick={addContact}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-semibold hover:bg-blue-200"
                  >
                    + Add Contact
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-3">Add up to 3 trusted contacts for emergencies.</p>
                <div className="space-y-4">
                  {form.emergencyContacts.map((contact, index) => (
                    <div key={`${index}-${contact.name}-${contact.phone}`} className="rounded-xl border border-gray-200 p-4">
                      <div className="grid sm:grid-cols-3 gap-3">
                        <input
                          className="input-field"
                          placeholder="Name"
                          value={contact.name}
                          onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                        />
                        <input
                          className="input-field"
                          placeholder="Phone"
                          value={contact.phone}
                          onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                        />
                        <input
                          className="input-field"
                          placeholder="Relation"
                          value={contact.relation}
                          onChange={(e) => handleContactChange(index, 'relation', e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeContact(index)}
                        className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isVolunteer && (
              <div className="pt-4 border-t">
                <div className="text-sm font-semibold text-gray-700 mb-3">Volunteer Skills</div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {SKILL_OPTIONS.map((skill) => {
                    const selected = volunteerForm.skills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => {
                          setVolunteerForm((prev) => ({
                            ...prev,
                            skills: selected
                              ? prev.skills.filter((s) => s !== skill)
                              : [...prev.skills, skill],
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {skill}
                      </button>
                    );
                  })}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Organization</label>
                    <input
                      className="input-field"
                      value={volunteerForm.organization}
                      onChange={(e) => setVolunteerForm((prev) => ({ ...prev, organization: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Experience (years)</label>
                    <input
                      type="number"
                      min="0"
                      className="input-field"
                      value={volunteerForm.experience}
                      onChange={(e) => setVolunteerForm((prev) => ({ ...prev, experience: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Certifications (comma separated)</label>
                  <input
                    className="input-field"
                    value={volunteerForm.certificationsText}
                    onChange={(e) => setVolunteerForm((prev) => ({ ...prev, certificationsText: e.target.value }))}
                    placeholder="CPR, Swift Water Rescue"
                  />
                </div>
              </div>
            )}

            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t">
            <div className="text-sm font-semibold text-gray-800 mb-2">Onboarding</div>
            <p className="text-sm text-gray-500 mb-4">Need a walkthrough again? Restart your role setup guide.</p>
            <button
              type="button"
              onClick={handleResetOnboarding}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
            >
              Reset Onboarding
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
