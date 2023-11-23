import { MongoClient } from "mongodb";

let client;
let db;

/**
 * Connect to a database using the provided configuration.
 *
 * @param {Object} config
 * @param {Object} callback - Optional callback function
 */
function connectToDatabase(config, callback) {
  if (db) return;

  let uri = `mongodb://${config.host}/${config.options || ""}`;
  client = new MongoClient(uri);
  db = client.db(config.db);
  callback && callback();
}

/**
 * Close the the active database connection.
 *
 * @param {Object} callback
 */
function closeDatabaseConnection(callback) {
  if (client) {
    client.close();
    db = null;
  }
  callback && callback();
}

/**
 * Get the database connection.
 *
 * @returns {Object} Database connection
 */
function getDatabaseConnection() {
  return db;
}

export { connectToDatabase, closeDatabaseConnection, getDatabaseConnection };
