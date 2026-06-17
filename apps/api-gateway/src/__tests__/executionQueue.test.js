jest.mock('bullmq', () => {
  const add = jest.fn();
  const Queue = jest.fn().mockImplementation(() => ({ add }));
  return { Queue, __add: add };
});

describe('executionQueue', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('adds execute job with retry and retention options', async () => {
    const { __add } = require('bullmq');
    const { addJob } = require('../queues/executionQueue');

    const payload = {
      executionId: 'exec-1',
      workflowId: 'wf-1',
      teamId: 'team-1',
      graph: { nodes: [], edges: [] },
      input: { task: 'test' },
    };

    await addJob(payload);

    expect(__add).toHaveBeenCalledWith(
      'execute',
      payload,
      expect.objectContaining({
        jobId: 'exec-1',
        removeOnComplete: 100,
        removeOnFail: 500,
      })
    );
  });
});
