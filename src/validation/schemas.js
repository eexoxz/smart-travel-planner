const { z } = require('zod');

const idParam = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  })
});

const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(120),
    password: z.string().min(8).max(72)
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(1)
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const tripFields = {
  destination: z.string().trim().min(2).max(120),
  country: z.string().trim().max(80).optional(),
  region: z.string().trim().max(120).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format').optional(),
  notes: z.string().trim().max(1000).optional(),
  preferenceTags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  budgetAmount: z.number().positive().optional(),
  budgetCurrency: z.string().trim().length(3).optional(),
  status: z.enum(['planned', 'visited', 'cancelled']).default('planned')
};

const today = () => new Date().toISOString().slice(0, 10);

const tripBody = z.object(tripFields)
  .refine((data) => data.startDate >= today(), {
    path: ['startDate'],
    message: 'startDate cannot be in the past'
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    path: ['endDate'],
    message: 'endDate must be on or after startDate'
  });

const tripUpdateBody = z.object(tripFields).partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required for update'
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    path: ['endDate'],
    message: 'endDate must be on or after startDate'
  })
  .refine((data) => !data.startDate || data.startDate >= today(), {
    path: ['startDate'],
    message: 'startDate cannot be in the past'
  });

const createTripSchema = z.object({
  body: tripBody,
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const updateTripSchema = z.object({
  body: tripUpdateBody,
  params: idParam.shape.params,
  query: z.object({}).optional()
});

const listTripsSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    status: z.enum(['planned', 'visited', 'cancelled']).optional(),
    destination: z.string().trim().min(1).max(120).optional(),
    limit: z.coerce.number().int().positive().max(100).default(25),
    offset: z.coerce.number().int().nonnegative().default(0)
  })
});

module.exports = {
  idParam,
  registerSchema,
  loginSchema,
  createTripSchema,
  updateTripSchema,
  listTripsSchema
};
