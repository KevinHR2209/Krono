const { z } = require('zod');

const waitlistCandidateSchema = z.object({
  patient_id: z.string().min(1),
  display_name: z.string().min(1),
  phone: z.string().regex(/^\+569\d{8}$/),
  email: z.string().email().optional(),
  attendance_history: z.number().min(0).max(1),
  waiting_days: z.number().int().min(0),
  urgency_level: z.number().int().min(1).max(4)
});

const webhookSchema = z.object({
  event_type: z.literal('appointment_cancelled'),
  source_system_id: z.string().min(1),
  cancellation: z.object({
    appointment_id: z.string().min(1),
    cancelled_at: z.string().datetime(),
    slot: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      start_time: z.string().regex(/^\d{2}:\d{2}$/),
      end_time: z.string().regex(/^\d{2}:\d{2}$/),
      doctor_name: z.string().min(1),
      specialty: z.string().min(1),
      location: z.string().min(1)
    }),
    cancelled_patient: z.object({
      patient_id: z.string().min(1),
      display_name: z.string().min(1)
    })
  }),
  waitlist: z.array(waitlistCandidateSchema).min(1)
});

function validateWebhook(req, res, next) {
  const parsed = webhookSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Payload inválido',
      details: parsed.error.flatten()
    });
  }

  req.validatedWebhook = parsed.data;
  next();
}

module.exports = {
  validateWebhook,
  webhookSchema
};