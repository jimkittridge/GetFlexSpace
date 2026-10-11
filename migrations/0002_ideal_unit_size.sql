ALTER TABLE tour_requests ADD COLUMN ideal_size TEXT
  CHECK (ideal_size IS NULL OR ideal_size IN ('500-1000', '1000-1500', '1500-2000', '2000+'));
