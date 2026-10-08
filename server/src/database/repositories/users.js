import { db } from '../db.js';

export const usersRepo = {
  getDemo() {
    return db().get('SELECT id, name, role FROM users WHERE id = ?', ['seed-operator']);
  },
};
