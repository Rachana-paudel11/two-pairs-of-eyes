import mongoose from 'mongoose';

/**
 * Connect to MongoDB database.
 */
export async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/two_pairs_of_eyes';

  try {
    const conn = await mongoose.connect(uri);
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    // Don't kill process immediately in dev so app can still provide diagnostics
    throw error;
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Connection lost. Attempting to reconnect...');
});

mongoose.connection.on('error', (err) => {
  console.error('[MongoDB] Error:', err.message);
});
