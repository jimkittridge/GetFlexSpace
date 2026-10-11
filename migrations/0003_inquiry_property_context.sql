ALTER TABLE tour_requests ADD COLUMN property_context TEXT
  CHECK (property_context IS NULL OR json_valid(property_context));
