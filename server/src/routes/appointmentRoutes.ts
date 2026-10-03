import { Router, Request, Response } from 'express';
import { Doctor } from '../models/Doctor.js';
import { Appointment } from '../models/Appointment.js';

const router = Router();

// GET all doctors with optional specialty and search query
router.get('/doctors', async (req: Request, res: Response) => {
  try {
    const { specialty, q } = req.query;
    const filter: Record<string, unknown> = {};

    if (specialty && specialty !== 'All') {
      filter.specialty = specialty;
    }

    if (q && typeof q === 'string') {
      const regex = new RegExp(q, 'i');
      filter.$or = [{ name: regex }, { specialty: regex }, { hospital: regex }];
    }

    const doctors = await Doctor.find(filter).sort({ rating: -1 });
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

// GET doctor by slug
router.get('/doctors/:slug', async (req: Request, res: Response) => {
  try {
    const doctor = await Doctor.findOne({ slug: req.params.slug });
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    res.json(doctor);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch doctor' });
  }
});

// GET user appointments
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const filter: Record<string, unknown> = {};

    if (status) {
      filter.status = status;
    }

    const appointments = await Appointment.find(filter).sort({ date: 1, timeSlot: 1 });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// GET appointment by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// POST book new appointment
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      doctorId,
      doctorName,
      doctorSpecialty,
      doctorAvatar,
      patientName,
      patientPhone,
      patientEmail,
      date,
      timeSlot,
      type,
      reason,
      notes,
      hospital,
    } = req.body;

    if (!doctorId || !date || !timeSlot || !patientName || !patientPhone) {
      return res.status(400).json({ error: 'Missing required booking details' });
    }

    const newAppointment = new Appointment({
      doctorId,
      doctorName,
      doctorSpecialty,
      doctorAvatar,
      patientName,
      patientPhone,
      patientEmail,
      date,
      timeSlot,
      type: type || 'in-person',
      status: 'upcoming',
      reason: reason || 'General Consultation',
      notes,
      hospital: hospital || 'CareConnect Partner Clinic',
    });

    await newAppointment.save();
    res.status(201).json(newAppointment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// PATCH cancel appointment
router.patch('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    appointment.status = 'cancelled';
    await appointment.save();
    res.json({ message: 'Appointment cancelled successfully', appointment });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel appointment' });
  }
});

export default router;
