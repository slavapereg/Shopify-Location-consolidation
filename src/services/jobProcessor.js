const cron = require('node-cron');
const logger = require('../utils/logger');
const jobQueue = require('./jobQueue');
const orderService = require('./orderService');

class JobProcessor {
  constructor() {
    this.isRunning = false;
    this.processingJobs = new Set();
  }

  /**
   * Start the job processor
   */
  start() {
    logger.info('Starting job processor...');
    
    // Run every 30 seconds
    cron.schedule('*/30 * * * * *', async () => {
      await this.processJobs();
    });

    // Cleanup old jobs every hour
    cron.schedule('0 * * * *', () => {
      jobQueue.cleanup();
    });

    // Log stats every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      const stats = jobQueue.getStats();
      logger.debug('Job queue stats', stats);
    });

    this.isRunning = true;
    logger.info('Job processor started');
  }

  /**
   * Process ready jobs
   */
  async processJobs() {
    if (!this.isRunning) return;

    const readyJobs = jobQueue.getReadyJobs();
    
    if (readyJobs.length === 0) return;

    logger.debug(`Processing ${readyJobs.length} ready job(s)`);

    // Process jobs concurrently with a limit
    const concurrencyLimit = 5;
    const promises = [];

    for (let i = 0; i < Math.min(readyJobs.length, concurrencyLimit); i++) {
      const job = readyJobs[i];
      
      // Skip if already processing
      if (this.processingJobs.has(job.id)) continue;
      
      promises.push(this.processJob(job));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Process a single job
   */
  async processJob(job) {
    const { id: jobId, orderId } = job;

    try {
      // Mark as processing
      this.processingJobs.add(jobId);
      jobQueue.markJobAsProcessing(jobId);

      logger.logOrderProcessing(orderId, 'processing_started', {
        jobId,
        attempt: job.attempts + 1
      });

      // Execute the actual order processing
      const result = await orderService.processOrderLocationConsolidation(orderId);

      // Mark as completed
      jobQueue.markJobAsCompleted(jobId, result);

    } catch (error) {
      logger.logError(error, {
        context: 'job_processing',
        jobId,
        orderId
      });

      // Mark as failed (will handle retry logic)
      jobQueue.markJobAsFailed(jobId, error);

    } finally {
      // Remove from processing set
      this.processingJobs.delete(jobId);
    }
  }

  /**
   * Stop the job processor
   */
  stop() {
    this.isRunning = false;
    logger.info('Job processor stopped');
  }

  /**
   * Get processor status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      currentlyProcessing: this.processingJobs.size,
      queueStats: jobQueue.getStats()
    };
  }
}

module.exports = new JobProcessor(); 