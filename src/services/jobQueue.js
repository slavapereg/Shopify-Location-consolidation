const logger = require('../utils/logger');

class JobQueue {
  constructor() {
    this.jobs = new Map();
    this.processedOrders = new Set(); // Track processed orders for idempotency
  }

  /**
   * Schedule an order for processing
   */
  async scheduleOrderProcessing(jobData) {
    const { orderId, orderNumber, processAt } = jobData;
    
    // Check if order was already processed (idempotency)
    if (this.processedOrders.has(orderId)) {
      logger.logOrderProcessing(orderId, 'already_processed', {
        orderNumber,
        reason: 'idempotency_check'
      });
      return false;
    }

    const jobId = `order_${orderId}_${Date.now()}`;
    
    const job = {
      id: jobId,
      type: 'order_processing',
      orderId,
      orderNumber,
      processAt,
      status: 'scheduled',
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: 3
    };

    this.jobs.set(jobId, job);
    
    logger.debug(`Job scheduled: ${jobId}`, {
      orderId,
      processAt: processAt.toISOString()
    });

    return jobId;
  }

  /**
   * Get jobs ready for processing
   */
  getReadyJobs() {
    const now = new Date();
    const readyJobs = [];

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'scheduled' && job.processAt <= now) {
        readyJobs.push(job);
      }
    }

    return readyJobs;
  }

  /**
   * Mark job as processing
   */
  markJobAsProcessing(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'processing';
      job.startedAt = new Date();
      job.attempts += 1;
      this.jobs.set(jobId, job);
    }
  }

  /**
   * Mark job as completed
   */
  markJobAsCompleted(jobId, result = {}) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'completed';
      job.completedAt = new Date();
      job.result = result;
      this.jobs.set(jobId, job);
      
      // Mark order as processed for idempotency
      this.processedOrders.add(job.orderId);
      
      logger.logOrderProcessing(job.orderId, 'job_completed', {
        jobId,
        attempts: job.attempts,
        duration: job.completedAt - job.startedAt
      });
    }
  }

  /**
   * Mark job as failed
   */
  markJobAsFailed(jobId, error) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.failedAt = new Date();
      job.error = error.message || error;
      
      // Retry logic
      if (job.attempts < job.maxAttempts) {
        // Reschedule with exponential backoff
        const backoffMs = Math.pow(2, job.attempts) * 60000; // 1min, 2min, 4min
        job.processAt = new Date(Date.now() + backoffMs);
        job.status = 'scheduled';
        
        logger.logOrderProcessing(job.orderId, 'job_rescheduled', {
          jobId,
          attempt: job.attempts,
          nextAttempt: job.processAt.toISOString(),
          error: job.error
        });
      } else {
        logger.logError(new Error(`Job failed after ${job.maxAttempts} attempts`), {
          context: 'job_queue',
          jobId,
          orderId: job.orderId,
          error: job.error
        });
      }
      
      this.jobs.set(jobId, job);
    }
  }

  /**
   * Get job statistics
   */
  getStats() {
    const stats = {
      total: this.jobs.size,
      scheduled: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      processedOrders: this.processedOrders.size
    };

    for (const job of this.jobs.values()) {
      stats[job.status] = (stats[job.status] || 0) + 1;
    }

    return stats;
  }

  /**
   * Clean up old completed/failed jobs
   */
  cleanup() {
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    let cleanedCount = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        (job.completedAt || job.failedAt) < cutoffDate
      ) {
        this.jobs.delete(jobId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} old jobs`);
    }

    return cleanedCount;
  }
}

module.exports = new JobQueue(); 