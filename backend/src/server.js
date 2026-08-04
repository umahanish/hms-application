import { createConnection } from './db/connection.js';
import { migrateUp } from './db/migrate.js';
import { migrations } from './migrations/index.js';
import { createApp } from './app.js';

const DB_PATH = process.env.DB_PATH ?? 'hms.sqlite';
const PORT = process.env.PORT ?? 4000;

const db = createConnection(DB_PATH);
migrateUp(db, migrations);

const app = createApp(db);
app.listen(PORT, () => {
  console.log(`HMS backend listening on port ${PORT}`);
});
