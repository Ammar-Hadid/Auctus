import { openDatabase } from '../src/server/db/connection';
const store = openDatabase();
console.log(
  'Database migrations applied; integrity:',
  store.sqlite.pragma('integrity_check', { simple: true }),
);
store.sqlite.close();
