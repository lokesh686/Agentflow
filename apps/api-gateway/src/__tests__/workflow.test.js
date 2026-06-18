/**
 * Workflow Model & Service — Unit Tests
 *
 * Run: npm test --workspace=apps/api-gateway
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('../config/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(undefined),
  getRedis: jest.fn().mockReturnValue({
    lPush: jest.fn().mockResolvedValue(1),
  }),
}));

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// ─── Workflow Model ──────────────────────────────────────────────────────────

describe('Workflow model', () => {
  const Workflow = require('../models/Workflow');

  const sampleGraph = {
    nodes: [
      { id: 'node-1', type: 'research', label: 'Research Agent',
        position: { x: 0, y: 0 }, config: { systemPrompt: 'Search the web', model: 'gpt-4o' } },
      { id: 'node-2', type: 'writer', label: 'Writer Agent',
        position: { x: 300, y: 0 }, config: { systemPrompt: 'Write a report', model: 'gpt-4o' } },
    ],
    edges: [
      { id: 'e1', source: 'node-1', target: 'node-2', condition: { type: 'always' } },
    ],
  };

  it('creates a workflow with valid data', async () => {
    const teamId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const wf = await Workflow.create({ teamId, createdBy: userId, name: 'Test Workflow', graph: sampleGraph });
    expect(wf.name).toBe('Test Workflow');
    expect(wf.version).toBe(1);
    expect(wf.status).toBe('draft');
    expect(wf.graph.nodes).toHaveLength(2);
  });

  it('validateGraph passes on a valid connected graph', async () => {
    const teamId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const wf = await Workflow.create({ teamId, createdBy: userId, name: 'Valid', graph: sampleGraph });
    expect(wf.validateGraph()).toHaveLength(0);
  });

  it('validateGraph detects disconnected node', async () => {
    const teamId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const graph = {
      nodes: [
        { id: 'n1', type: 'research', label: 'R', position: { x: 0, y: 0 }, config: {} },
        { id: 'n2', type: 'writer',   label: 'W', position: { x: 0, y: 0 }, config: {} },
      ],
      edges: [], // no edges — both nodes are disconnected
    };
    const wf = await Workflow.create({ teamId, createdBy: userId, name: 'Disconnected', graph });
    const errors = wf.validateGraph();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('disconnected'))).toBe(true);
  });

  it('validateGraph flags custom node without system prompt', async () => {
    const teamId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const graph = {
      nodes: [{ id: 'n1', type: 'custom', label: 'MyAgent', position: { x: 0, y: 0 }, config: { systemPrompt: '' } }],
      edges: [],
    };
    const wf = await Workflow.create({ teamId, createdBy: userId, name: 'Custom', graph });
    const errors = wf.validateGraph();
    expect(errors.some((e) => e.includes('system prompt'))).toBe(true);
  });

  it('snapshotCurrent stores a version snapshot and trims to 10', async () => {
    const teamId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const wf = await Workflow.create({ teamId, createdBy: userId, name: 'Snap', graph: sampleGraph });

    // Create 11 snapshots
    for (let i = 0; i < 11; i++) {
      wf.snapshotCurrent(userId);
    }
    expect(wf.history.length).toBe(10); // capped at 10
  });
});

// ─── Execution Model ─────────────────────────────────────────────────────────

describe('Execution model', () => {
  const Execution = require('../models/Execution');

  function makeExecution(overrides = {}) {
    return {
      workflowId: new mongoose.Types.ObjectId(),
      teamId: new mongoose.Types.ObjectId(),
      triggeredBy: new mongoose.Types.ObjectId(),
      input: { task: 'Research AI trends' },
      ...overrides,
    };
  }

  it('creates an execution in QUEUED status', async () => {
    const exec = await Execution.create(makeExecution());
    expect(exec.status).toBe('QUEUED');
    expect(exec.steps).toHaveLength(0);
    expect(exec.totalTokens.total).toBe(0);
  });

  it('valid state transitions: QUEUED → RUNNING → COMPLETED', async () => {
    const exec = await Execution.create(makeExecution());
    exec.transition('RUNNING');
    expect(exec.status).toBe('RUNNING');
    expect(exec.startedAt).toBeDefined();
    exec.transition('COMPLETED');
    expect(exec.status).toBe('COMPLETED');
    expect(exec.completedAt).toBeDefined();
    expect(exec.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('rejects invalid transition: COMPLETED → RUNNING', async () => {
    const exec = await Execution.create(makeExecution());
    exec.transition('RUNNING');
    exec.transition('COMPLETED');
    expect(() => exec.transition('RUNNING')).toThrow('Invalid status transition');
  });

  it('addStep accumulates token usage', async () => {
    const exec = await Execution.create(makeExecution());
    exec.addStep({
      agentName: 'ResearchAgent', nodeId: 'n1', type: 'agent_complete',
      tokensUsed: { prompt: 500, completion: 200, total: 700 }, timestamp: new Date(),
    });
    exec.addStep({
      agentName: 'WriterAgent', nodeId: 'n2', type: 'agent_complete',
      tokensUsed: { prompt: 300, completion: 400, total: 700 }, timestamp: new Date(),
    });
    expect(exec.totalTokens.total).toBe(1400);
    expect(exec.totalTokens.prompt).toBe(800);
    expect(exec.steps).toHaveLength(2);
  });

  it('calculateCost returns a non-negative USD value', async () => {
    const exec = await Execution.create(makeExecution());
    exec.addStep({
      agentName: 'A', nodeId: 'n1', type: 'agent_complete',
      tokensUsed: { prompt: 1000, completion: 500, total: 1500 }, timestamp: new Date(),
    });
    const cost = exec.calculateCost('gpt-4o');
    expect(cost).toBeGreaterThan(0);
    expect(exec.estimatedCostUsd).toBe(cost);
  });
});

// ─── Workflow Service ─────────────────────────────────────────────────────────

describe('workflowService', () => {
  const workflowService = require('../services/workflowService');
  const Team = require('../models/Team');

  let teamId, userId;

  beforeEach(async () => {
    userId = new mongoose.Types.ObjectId();
    const team = await Team.create({
      name: 'Test Team', slug: 'test-team-' + Date.now(),
      ownerId: userId, plan: 'free',
      members: [{ userId, role: 'owner' }],
    });
    teamId = team._id;
  });

  it('createWorkflow enforces free plan limit of 2', async () => {
    await workflowService.createWorkflow({ teamId, userId, name: 'WF 1' });
    await workflowService.createWorkflow({ teamId, userId, name: 'WF 2' });
    await expect(
      workflowService.createWorkflow({ teamId, userId, name: 'WF 3' })
    ).rejects.toMatchObject({ status: 403 });
  });

  it('listWorkflows returns only non-deleted workflows for the team', async () => {
    await workflowService.createWorkflow({ teamId, userId, name: 'Alpha' });
    await workflowService.createWorkflow({ teamId, userId, name: 'Beta' });
    const result = await workflowService.listWorkflows({ teamId });
    expect(result.items).toHaveLength(2);
  });

  it('updateWorkflow increments version and snapshots previous graph', async () => {
    const wf = await workflowService.createWorkflow({
      teamId, userId, name: 'V1',
      graph: {
        nodes: [{ id: 'n1', type: 'research', label: 'R', position: { x: 0, y: 0 }, config: { systemPrompt: 'x', model: 'gpt-4o' } }],
        edges: [],
      },
    });
    expect(wf.version).toBe(1);

    const updated = await workflowService.updateWorkflow({
      workflowId: wf._id, teamId, userId,
      updates: {
        graph: {
          nodes: [
            { id: 'n1', type: 'research', label: 'R', position: { x: 0, y: 0 }, config: { systemPrompt: 'updated', model: 'gpt-4o' } },
          ],
          edges: [],
        },
      },
    });
    expect(updated.version).toBe(2);
    expect(updated.history).toHaveLength(1);
    expect(updated.history[0].version).toBe(1);
  });

  it('deleteWorkflow soft-deletes (sets deletedAt)', async () => {
    const wf = await workflowService.createWorkflow({ teamId, userId, name: 'ToDelete' });
    await workflowService.deleteWorkflow({ workflowId: wf._id, teamId });
    const result = await workflowService.listWorkflows({ teamId });
    expect(result.items).toHaveLength(0); // deleted workflow not returned
  });
});
