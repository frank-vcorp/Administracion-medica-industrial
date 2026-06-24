SELECT
  (SELECT EXISTS (SELECT FROM pg_type WHERE typname = 'IntakeSource')) AS "IntakeSource_existe",
  (SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medical_events' AND column_name = 'intakeSource')) AS "medical_events_intakeSource_existe",
  (SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medical_events' AND column_name = 'projectId')) AS "medical_events_projectId_existe",
  (SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medical_events' AND column_name = 'intakeCreatedByUserId')) AS "medical_events_intakeCreatedByUserId_existe",
  (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_prisma_migrations')) AS "_prisma_migrations_existe";
