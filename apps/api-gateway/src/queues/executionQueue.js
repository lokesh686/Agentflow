const { Queue } = require('bullmq');

const connection = { url: process.env.REDIS_URL };

const executionQueue = new Queue('workflow-executions', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  },
});

const deadLetterQueue = new Queue('workflow-executions:failed', {
  connection,
});

function addJob(data) {
  return executionQueue.add('execute', data, {
    jobId: data.executionId,
    removeOnComplete: 100,
    removeOnFail: 500,
  });
}

module.exports = {
  executionQueue,
  deadLetterQueue,
  addJob,
};
