const Workflow = require('../models/Workflow');
const Team = require('../models/Team');

/**
 * Create a new workflow — enforces plan limits.
 */
async function createWorkflow({ teamId, userId, name, description, tags, graph }) {
  // Enforce plan workflow limit
  const team = await Team.findById(teamId);
  if (!team) {
    const err = new Error('Team not found'); err.status = 404; throw err;
  }

  const limits = team.getPlanLimits();
  const existingCount = await Workflow.countDocuments({ teamId, deletedAt: null });
  if (existingCount >= limits.workflows) {
    const err = new Error(
      `Your plan allows a maximum of ${limits.workflows} workflow${limits.workflows === 1 ? '' : 's'}. Upgrade to create more.`
    );
    err.status = 403;
    throw err;
  }

  const workflow = await Workflow.create({
    teamId,
    createdBy: userId,
    name,
    description,
    tags,
    graph: graph || { nodes: [], edges: [] },
  });

  return workflow;
}

/**
 * List workflows for a team — paginated, filterable.
 */
async function listWorkflows({ teamId, status, tag, search, cursor, limit = 20 }) {
  const query = { teamId, deletedAt: null };
  if (status) query.status = status;
  if (tag) query.tags = tag;
  if (search) query.name = { $regex: search, $options: 'i' };
  if (cursor) query._id = { $lt: cursor }; // cursor-based pagination (newest first)

  const workflows = await Workflow.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .select('-history')  // omit history for list view
    .lean();

  const hasMore = workflows.length > limit;
  if (hasMore) workflows.pop();

  return {
    items: workflows,
    hasMore,
    cursor: hasMore ? workflows[workflows.length - 1]._id : null,
  };
}

/**
 * Get a single workflow by id — validates team ownership.
 */
async function getWorkflow({ workflowId, teamId }) {
  const workflow = await Workflow.findOne({ _id: workflowId, teamId, deletedAt: null });
  if (!workflow) {
    const err = new Error('Workflow not found'); err.status = 404; throw err;
  }
  return workflow;
}

/**
 * Update a workflow's graph or metadata — auto-snapshots previous version.
 */
async function updateWorkflow({ workflowId, teamId, userId, updates }) {
  const workflow = await getWorkflow({ workflowId, teamId });

  const { name, description, tags, graph, status } = updates;

  // If graph is changing, snapshot the current version first
  if (graph) {
    workflow.snapshotCurrent(userId);
    workflow.graph = graph;
    workflow.version += 1;

    // Validate the new graph
    const errors = workflow.validateGraph();
    if (errors.length > 0) {
      const err = new Error(`Graph validation failed: ${errors.join('; ')}`);
      err.status = 400;
      throw err;
    }
  }

  if (name !== undefined) workflow.name = name;
  if (description !== undefined) workflow.description = description;
  if (tags !== undefined) workflow.tags = tags;
  if (status !== undefined) {
    if (!['draft', 'active', 'archived'].includes(status)) {
      const err = new Error('Invalid status'); err.status = 400; throw err;
    }
    workflow.status = status;
  }

  await workflow.save();
  return workflow;
}

/**
 * Soft-delete a workflow.
 */
async function deleteWorkflow({ workflowId, teamId }) {
  const workflow = await getWorkflow({ workflowId, teamId });
  workflow.deletedAt = new Date();
  await workflow.save();
  return { deleted: true };
}

/**
 * Get a specific historical version of a workflow's graph.
 */
async function getWorkflowVersion({ workflowId, teamId, version }) {
  const workflow = await getWorkflow({ workflowId, teamId });
  if (version === workflow.version) {
    return { version: workflow.version, graph: workflow.graph };
  }
  const snapshot = workflow.history.find((h) => h.version === version);
  if (!snapshot) {
    const err = new Error(`Version ${version} not found in history`); err.status = 404; throw err;
  }
  return snapshot;
}

module.exports = {
  createWorkflow,
  listWorkflows,
  getWorkflow,
  updateWorkflow,
  deleteWorkflow,
  getWorkflowVersion,
};
