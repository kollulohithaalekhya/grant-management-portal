-- Provision the fixed role catalogue.
-- The application can only assign roles that exist in this table, so a fresh
-- database must contain them before the first user registers. Kept as a
-- migration (rather than the dev seed) so production deployments get it too.

INSERT INTO "roles" ("id", "name", "description", "created_at")
VALUES
  (gen_random_uuid(), 'ADMIN', 'Full access: manages users, roles, grants and applications.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'GRANT_MANAGER', 'Creates grants and reviews applications for grants they own.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'APPLICANT', 'Browses open grants and submits applications.', CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
