/**
 * Admin Controller - Advanced analytics, reports, and operations views
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const RescueRequest = require('../models/RescueRequest');
const Volunteer = require('../models/Volunteer');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

const RANGE_TO_DAYS = {
  day: 1,
  week: 7,
  month: 30,
};

const getRangeStart = (range) => {
  const days = RANGE_TO_DAYS[range] || RANGE_TO_DAYS.week;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
};

const groupByBucket = (date, range) => {
  const d = new Date(date);
  if (range === 'day') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
  }
  if (range === 'week') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// GET /api/admin/analytics
exports.getAdvancedAnalytics = async (req, res) => {
  try {
    const { range = 'week' } = req.query;
    const startDate = getRangeStart(range);

    const [allRequests, timelineRows] = await Promise.all([
      RescueRequest.find({ createdAt: { $gte: startDate } }).select('status createdAt urgencyLevel disasterType'),
      RescueRequest.find({ createdAt: { $gte: startDate } }).select('status createdAt').sort({ createdAt: 1 }),
    ]);

    const totals = {
      raised: allRequests.length,
      resolved: allRequests.filter((r) => r.status === 'rescued').length,
      pending: allRequests.filter((r) => ['pending', 'accepted', 'in-progress'].includes(r.status)).length,
      failed: allRequests.filter((r) => ['failed', 'cancelled'].includes(r.status)).length,
    };

    const timelineMap = {};
    timelineRows.forEach((row) => {
      const bucket = groupByBucket(row.createdAt, range);
      if (!timelineMap[bucket]) {
        timelineMap[bucket] = { bucket, raised: 0, resolved: 0, pending: 0, failed: 0 };
      }
      timelineMap[bucket].raised += 1;
      if (row.status === 'rescued') timelineMap[bucket].resolved += 1;
      if (['pending', 'accepted', 'in-progress'].includes(row.status)) timelineMap[bucket].pending += 1;
      if (['failed', 'cancelled'].includes(row.status)) timelineMap[bucket].failed += 1;
    });

    const timeline = Object.values(timelineMap).sort((a, b) => a.bucket.localeCompare(b.bucket));

    const byDisaster = allRequests.reduce((acc, request) => {
      acc[request.disasterType] = (acc[request.disasterType] || 0) + 1;
      return acc;
    }, {});

    const byPriority = allRequests.reduce((acc, request) => {
      acc[request.urgencyLevel] = (acc[request.urgencyLevel] || 0) + 1;
      return acc;
    }, {});

    res.json({ totals, timeline, byDisaster, byPriority, range });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/admin/volunteer-performance
exports.getVolunteerPerformanceReport = async (req, res) => {
  try {
    const volunteers = await Volunteer.find({ verificationStatus: 'approved' }).populate('userId', 'name email phone');
    const performance = await Promise.all(volunteers.map(async (volunteer) => {
      const missions = await RescueRequest.find({ assignedVolunteer: volunteer.userId._id })
        .select('status createdAt acceptedAt resolvedAt');

      const completed = missions.filter((m) => m.status === 'rescued').length;
      const total = missions.length;
      const responseMinutes = missions
        .filter((m) => m.acceptedAt && m.createdAt)
        .map((m) => (new Date(m.acceptedAt).getTime() - new Date(m.createdAt).getTime()) / 60000);

      const avgResponseTime = responseMinutes.length
        ? Number((responseMinutes.reduce((a, b) => a + b, 0) / responseMinutes.length).toFixed(1))
        : 0;

      return {
        volunteerId: volunteer._id,
        userId: volunteer.userId?._id,
        name: volunteer.userId?.name || 'Unknown',
        email: volunteer.userId?.email || '',
        totalMissions: total,
        completed,
        avgResponseTime,
        rating: volunteer.rating || 0,
        ratingCount: volunteer.ratingCount || 0,
        availability: volunteer.availability,
      };
    }));

    res.json({ performance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/admin/available-volunteers
exports.getAvailableVolunteers = async (req, res) => {
  try {
    const volunteers = await Volunteer.find({
      verificationStatus: 'approved',
      availability: 'available',
    }).populate('userId', 'name email phone');

    res.json({ volunteers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/admin/heatmap
exports.getDisasterHeatmap = async (req, res) => {
  try {
    const requests = await RescueRequest.find({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    }).select('location disasterType urgencyLevel status createdAt');

    const buckets = {};

    requests.forEach((request) => {
      const lng = request.location?.coordinates?.[0];
      const lat = request.location?.coordinates?.[1];
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

      const roundedLng = Number(lng.toFixed(2));
      const roundedLat = Number(lat.toFixed(2));
      const key = `${roundedLat},${roundedLng}`;

      if (!buckets[key]) {
        buckets[key] = {
          lat: roundedLat,
          lng: roundedLng,
          count: 0,
          criticalCount: 0,
          latestAt: request.createdAt,
        };
      }

      buckets[key].count += 1;
      if (request.urgencyLevel === 'critical') buckets[key].criticalCount += 1;
      if (new Date(request.createdAt) > new Date(buckets[key].latestAt)) {
        buckets[key].latestAt = request.createdAt;
      }
    });

    const heatpoints = Object.values(buckets)
      .sort((a, b) => b.count - a.count)
      .map((point) => ({
        ...point,
        intensity: Math.min(1, point.count / 10),
      }));

    res.json({ heatpoints });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/admin/escalations
exports.getEscalatedRequests = async (req, res) => {
  try {
    const requests = await RescueRequest.find({
      escalationNotified: true,
      status: 'pending',
    })
      .populate('userId', 'name phone email')
      .sort({ escalationNotifiedAt: -1 });

    res.json({ requests });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/admin/export
exports.exportOperationsReport = async (req, res) => {
  try {
    const { format = 'excel' } = req.query;

    const [requests, volunteers, users] = await Promise.all([
      RescueRequest.find({}).populate('userId', 'name email').populate('assignedVolunteer', 'name email').sort({ createdAt: -1 }),
      Volunteer.find({}).populate('userId', 'name email').sort({ createdAt: -1 }),
      User.find({}).select('name email role lastSeen createdAt isActive').sort({ createdAt: -1 }),
    ]);

    if (format === 'excel') {
      const XLSX = require('xlsx');
      const workbook = XLSX.utils.book_new();

      const requestRows = requests.map((r) => ({
        id: String(r._id),
        citizen: r.userId?.name || '',
        citizenEmail: r.userId?.email || '',
        volunteer: r.assignedVolunteer?.name || '',
        volunteerEmail: r.assignedVolunteer?.email || '',
        disasterType: r.disasterType,
        urgency: r.urgencyLevel,
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt || '',
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(requestRows), 'Requests');

      const volunteerRows = volunteers.map((v) => ({
        id: String(v._id),
        name: v.userId?.name || '',
        email: v.userId?.email || '',
        availability: v.availability,
        verificationStatus: v.verificationStatus,
        completedMissions: v.completedMissions,
        rating: v.rating,
        ratingCount: v.ratingCount,
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(volunteerRows), 'Volunteers');

      const userRows = users.map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        lastSeen: u.lastSeen || '',
        createdAt: u.createdAt,
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(userRows), 'Users');

      const tempFile = path.join(os.tmpdir(), `rescue-wings-report-${Date.now()}.xlsx`);
      XLSX.writeFile(workbook, tempFile);

      res.download(tempFile, 'rescue-wings-operations-report.xlsx', () => {
        fs.unlink(tempFile, () => {});
      });
      return;
    }

    if (format === 'pdf') {
      const PDFDocument = require('pdfkit');
      const filePath = path.join(os.tmpdir(), `rescue-wings-report-${Date.now()}.pdf`);
      const doc = new PDFDocument({ margin: 30 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      doc.fontSize(18).text('Rescue Wings Operations Report', { underline: true });
      doc.moveDown();
      doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown();

      doc.fontSize(14).text('Summary');
      doc.fontSize(11).text(`Total Requests: ${requests.length}`);
      doc.text(`Resolved: ${requests.filter((r) => r.status === 'rescued').length}`);
      doc.text(`Pending/Active: ${requests.filter((r) => ['pending', 'accepted', 'in-progress'].includes(r.status)).length}`);
      doc.text(`Failed/Cancelled: ${requests.filter((r) => ['failed', 'cancelled'].includes(r.status)).length}`);
      doc.moveDown();

      doc.fontSize(14).text('Volunteer Snapshot');
      volunteers.slice(0, 20).forEach((v) => {
        doc.fontSize(10).text(`- ${v.userId?.name || 'Unknown'} | ${v.verificationStatus} | availability=${v.availability} | rating=${v.rating}`);
      });

      doc.moveDown();
      doc.fontSize(14).text('Latest Requests');
      requests.slice(0, 30).forEach((r) => {
        doc.fontSize(10).text(`- ${r.disasterType.toUpperCase()} | ${r.status} | ${r.userId?.name || 'Unknown'} | ${new Date(r.createdAt).toLocaleString()}`);
      });

      doc.end();

      stream.on('finish', () => {
        res.download(filePath, 'rescue-wings-operations-report.pdf', () => {
          fs.unlink(filePath, () => {});
        });
      });
      return;
    }

    res.status(400).json({ error: 'Invalid format. Use excel or pdf.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/admin/pending-volunteers
exports.getPendingVolunteers = async (req, res) => {
  try {
    const volunteers = await Volunteer.find({ verificationStatus: 'pending' })
      .populate('userId', 'name email phone age address idNumber specificationType proofDocumentUrl createdAt')
      .sort({ createdAt: -1 });

    res.json({ volunteers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/admin/activity-log
exports.getAdminActivityLog = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const logs = await ActivityLog.find({})
      .populate('userId', 'name email role lastSeen')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await ActivityLog.countDocuments({});
    res.json({ logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
