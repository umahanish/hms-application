export const id = '003_add_doctor_location';

export function up(db) {
  db.exec('ALTER TABLE doctors ADD COLUMN location TEXT;');
}

export function down(db) {
  db.exec('ALTER TABLE doctors DROP COLUMN location;');
}
