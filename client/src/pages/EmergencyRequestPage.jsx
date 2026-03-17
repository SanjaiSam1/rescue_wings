/**
 * Emergency SOS Request Page
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { rescueAPI } from '../services/api';

const DISASTER_TYPES = [
  { value: 'flood', label: '🌊 Flood', color: 'bg-blue-50 border-blue-200 hover:border-blue-400' },
  { value: 'earthquake', label: '🏔️ Earthquake', color: 'bg-orange-50 border-orange-200 hover:border-orange-400' },
  { value: 'fire', label: '🔥 Fire', color: 'bg-red-50 border-red-200 hover:border-red-400' },
  { value: 'landslide', label: '⛰️ Landslide', color: 'bg-brown-50 border-amber-200 hover:border-amber-400' },
  { value: 'cyclone', label: '🌪️ Cyclone', color: 'bg-gray-50 border-gray-200 hover:border-gray-400' },
  { value: 'tsunami', label: '🌊 Tsunami', color: 'bg-teal-50 border-teal-200 hover:border-teal-400' },
  { value: 'other', label: '⚠️ Other', color: 'bg-yellow-50 border-yellow-200 hover:border-yellow-400' },
];

const SAFETY_TIPS = {
  flood: [
    'Move to higher ground immediately and avoid basement areas.',
    'Do not walk or drive through moving flood water.',
    'Switch off electricity if water is entering your home.',
  ],
  earthquake: [
    'Drop, cover, and hold on under sturdy furniture.',
    'Stay away from windows, shelves, and falling objects.',
    'After shaking stops, exit carefully and check for injuries.',
  ],
  fire: [
    'Crawl low under smoke and cover your nose and mouth.',
    'Do not use elevators. Use stairs and nearest safe exit.',
    'If clothes catch fire, stop, drop, and roll.',
  ],
  landslide: [
    'Move away from slopes, retaining walls, and valley channels.',
    'Watch for sudden changes in water flow or unusual ground cracks.',
    'Avoid crossing debris paths until authorities clear the area.',
  ],
  cyclone: [
    'Stay indoors and keep away from glass windows.',
    'Secure loose objects and keep emergency supplies ready.',
    'Do not step outside during the eye of the storm.',
  ],
  tsunami: [
    'Move inland and to higher elevation without delay.',
    'Do not return to the coast until official all-clear messages.',
    'Keep listening to local emergency instructions.',
  ],
  other: [
    'Stay calm and move to a safer area if possible.',
    'Share exact location details with responders.',
    'Follow verified alerts and avoid rumors.',
  ],
};

export default function EmergencyRequestPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    disasterType: '',
    description: '',
    urgencyLevel: 'high',
    numberOfPeople: 1,
    location: { type: 'Point', coordinates: [0, 0], address: '' },
  });
  const [images, setImages] = useState([]);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [autoLocationTried, setAutoLocationTried] = useState(false);
  const [imagePreviews, setImagePreviews] = useState([]);

  const getLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser. Please enter your location manually.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(prev => ({
          ...prev,
          location: {
            type: 'Point',
            coordinates: [pos.coords.longitude, pos.coords.latitude],
            address: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
          }
        }));
        setLocating(false);
      },
      () => { setLocating(false); setError('Unable to get location. Please enter manually.'); },
      { enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    if (!autoLocationTried) {
      setAutoLocationTried(true);
      getLocation();
    }
  }, [autoLocationTried]);

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files).slice(0, 5);
    setImages(files);
    const previews = files.map((file) => ({
      name: file.name,
      size: file.size,
      url: URL.createObjectURL(file),
    }));
    setImagePreviews(previews);
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => {
      const next = [...prev];
      const removed = next[index];
      if (removed?.url) URL.revokeObjectURL(removed.url);
      next.splice(index, 1);
      return next;
    });
  };

  useEffect(() => {
    return () => {
      imagePreviews.forEach((item) => {
        if (item?.url) URL.revokeObjectURL(item.url);
      });
    };
  }, [imagePreviews]);

  const handleSubmit = async () => {
    setError('');
    if (!form.disasterType) return setError('Please select a disaster type');
    if (!form.description) return setError('Please describe the situation');
    if (form.location.coordinates[0] === 0) return setError('Please share your location');

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('disasterType', form.disasterType);
      formData.append('description', form.description);
      formData.append('urgencyLevel', form.urgencyLevel);
      formData.append('numberOfPeople', form.numberOfPeople);
      formData.append('location', JSON.stringify(form.location));
      images.forEach(img => formData.append('images', img));

      const { data } = await rescueAPI.create(formData);
      navigate(`/track/${data.request._id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Emergency Request">
      <div className="max-w-2xl mx-auto">
        {/* SOS Header */}
        <div className="bg-red-600 text-white rounded-2xl p-6 mb-6 text-center">
          <div className="text-5xl mb-3 sos-pulse inline-block">🆘</div>
          <h1 className="font-display text-4xl tracking-widest mb-2">SOS EMERGENCY</h1>
          <p className="text-red-100">Fill this form as quickly as possible. Help is on the way.</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">{error}</div>}

        <div className="card space-y-6">
          {/* Step 1: Disaster Type */}
          <div>
            <h2 className="font-bold text-gray-900 mb-4">1. What type of disaster? <span className="text-red-600">*</span></h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {DISASTER_TYPES.map(type => (
                <button key={type.value} type="button"
                  onClick={() => setForm({...form, disasterType: type.value})}
                  className={`p-4 rounded-xl border-2 text-center font-medium transition-all ${type.color} ${form.disasterType === type.value ? 'ring-2 ring-primary' : ''}`}>
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Urgency */}
          <div>
            <h2 className="font-bold text-gray-900 mb-4">2. Priority Level</h2>
            <div className="flex gap-3 flex-wrap">
              {['low', 'medium', 'high', 'critical'].map(u => (
                <button key={u} type="button"
                  onClick={() => setForm({...form, urgencyLevel: u})}
                  className={`px-5 py-2.5 rounded-xl font-semibold capitalize border-2 transition-all ${
                    form.urgencyLevel === u
                      ? u === 'critical' ? 'bg-red-600 border-red-600 text-white' :
                        u === 'high' ? 'bg-orange-500 border-orange-500 text-white' :
                        u === 'medium' ? 'bg-yellow-500 border-yellow-500 text-white' :
                        'bg-green-500 border-green-500 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}>
                  {u}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Priority helps responders triage requests quickly. Choose Critical only for immediate life-threatening danger.
            </p>
          </div>

          {/* Number of people */}
          <div>
            <h2 className="font-bold text-gray-900 mb-4">3. Number of People Affected</h2>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => setForm({...form, numberOfPeople: Math.max(1, form.numberOfPeople - 1)})}
                className="w-10 h-10 bg-gray-100 rounded-full text-xl font-bold hover:bg-gray-200">−</button>
              <span className="text-3xl font-bold w-16 text-center">{form.numberOfPeople}</span>
              <button type="button" onClick={() => setForm({...form, numberOfPeople: form.numberOfPeople + 1})}
                className="w-10 h-10 bg-gray-100 rounded-full text-xl font-bold hover:bg-gray-200">+</button>
            </div>
          </div>

          {/* Description */}
          <div>
            <h2 className="font-bold text-gray-900 mb-4">4. Describe the Situation <span className="text-red-600">*</span></h2>
            <textarea className="input-field min-h-[120px] resize-none" required
              value={form.description}
              onChange={e => setForm({...form, description: e.target.value})}
              placeholder="Describe your situation: What happened? How many people need help? Any injuries? What's the current condition..." />
          </div>

          {/* Location */}
          <div>
            <h2 className="font-bold text-gray-900 mb-4">5. Your Location <span className="text-red-600">*</span></h2>
            <button type="button" onClick={getLocation} disabled={locating}
              className="btn-secondary w-full flex items-center justify-center gap-2 mb-3">
              {locating ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"/>Locating...</>
                : <><span>📍</span>Share My GPS Location</>}
            </button>
            {form.location.coordinates[0] !== 0 && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm text-center">
                ✅ Location captured: {form.location.coordinates[1].toFixed(4)}, {form.location.coordinates[0].toFixed(4)}
              </div>
            )}
            <div className="mt-3">
              <input className="input-field" placeholder="Or type your address manually..."
                value={form.location.address}
                onChange={e => setForm({...form, location: {...form.location, address: e.target.value}})} />
            </div>
          </div>

          {/* Safety tips */}
          {form.disasterType && (
            <div>
              <h2 className="font-bold text-gray-900 mb-4">Safety Tips for {form.disasterType}</h2>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <ul className="space-y-2 text-sm text-blue-900">
                  {(SAFETY_TIPS[form.disasterType] || SAFETY_TIPS.other).map((tip) => (
                    <li key={tip} className="flex gap-2">
                      <span>•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Images */}
          <div>
            <h2 className="font-bold text-gray-900 mb-4">6. Upload Images (Optional)</h2>
            <label className="border-2 border-dashed border-primary/40 bg-gradient-to-br from-red-50 to-white rounded-2xl p-6 block cursor-pointer hover:border-primary transition-colors">
              <input type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden" />
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-sm font-bold text-gray-900">Choose Emergency Images</div>
                  <div className="text-gray-500 text-xs mt-1">Upload up to 5 images. JPG/PNG recommended.</div>
                </div>
                <div className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold">Choose Image</div>
              </div>

              {images.length > 0 && (
                <div className="mt-4 text-primary font-semibold text-sm">{images.length} image(s) selected</div>
              )}
            </label>

            {imagePreviews.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {imagePreviews.map((preview, index) => (
                  <div key={`${preview.name}-${index}`} className="relative rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
                    <img src={preview.url} alt={preview.name} className="h-28 w-full object-cover" />
                    <div className="p-2">
                      <div className="text-xs font-semibold text-gray-800 truncate">{preview.name}</div>
                      <div className="text-[11px] text-gray-500">{Math.max(1, Math.round(preview.size / 1024))} KB</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white text-xs hover:bg-black"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleSubmit} disabled={submitting}
            className="sos-pulse bg-red-600 hover:bg-red-700 text-white w-full py-5 rounded-2xl font-bold text-xl flex items-center justify-center gap-2 disabled:opacity-60 transition-all">
            {submitting ? <><span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"/>Sending SOS...</>
              : <><span>🆘</span>SEND SOS REQUEST</>}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
