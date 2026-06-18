require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Template = require('../models/Template');

const SEED_TEMPLATES = [
  {
    name: "Research Agent Pipeline",
    description: "A two-step workflow that researches a topic on the web and synthesizes it into a comprehensive report.",
    category: "research",
    tags: ["research", "synthesis", "web-search"],
    author: "AgentFlow Team",
    rating: 4.8,
    usageCount: 1245,
    isPublic: true,
    isFeatured: true,
    workflowGraph: {
      nodes: [
        {
          id: "research_node",
          type: "research",
          label: "Web Researcher",
          config: {
            model: "gpt-4o",
            temperature: 0.2,
            tools: ["web_search"],
            systemPrompt: "You are an expert web researcher. Your goal is to gather comprehensive and accurate information about the user's prompt using the web_search tool. Summarize your findings."
          }
        },
        {
          id: "writer_node",
          type: "writer",
          label: "Report Writer",
          config: {
            model: "gpt-4o",
            temperature: 0.7,
            tools: [],
            systemPrompt: "You are an expert report writer. Take the research provided by the previous agent and synthesize it into a clean, well-structured markdown report. Use headings and bullet points."
          }
        }
      ],
      edges: [
        {
          id: "edge_1",
          source: "research_node",
          target: "writer_node",
          condition: { type: "always" }
        }
      ]
    }
  },
  {
    name: "Code Review & Refactor",
    description: "Analyzes provided code for bugs and security issues, then writes an optimized, refactored version.",
    category: "code",
    tags: ["development", "code-review", "refactoring"],
    author: "AgentFlow Team",
    rating: 4.9,
    usageCount: 890,
    isPublic: true,
    isFeatured: true,
    workflowGraph: {
      nodes: [
        {
          id: "reviewer",
          type: "code",
          label: "Security Reviewer",
          config: {
            model: "claude-sonnet-4-6",
            temperature: 0.1,
            tools: [],
            systemPrompt: "You are a senior security engineer. Analyze the provided code for potential vulnerabilities, anti-patterns, and bugs. Output a list of issues found."
          }
        },
        {
          id: "refactorer",
          type: "code",
          label: "Code Refactorer",
          config: {
            model: "claude-sonnet-4-6",
            temperature: 0.3,
            tools: [],
            systemPrompt: "You are a senior software developer. Take the original code and the security review, and write a completely refactored, optimized, and secure version of the code. Provide ONLY the code."
          }
        }
      ],
      edges: [
        {
          id: "edge_1",
          source: "reviewer",
          target: "refactorer",
          condition: { type: "always" }
        }
      ]
    }
  },
  {
    name: "Data CSV Analyzer",
    description: "Takes raw data input and extracts key metrics, trends, and a summary suitable for an executive team.",
    category: "data",
    tags: ["data-analysis", "metrics", "summarization"],
    author: "Data Wizards",
    rating: 4.5,
    usageCount: 430,
    isPublic: true,
    isFeatured: false,
    workflowGraph: {
      nodes: [
        {
          id: "analyst",
          type: "data",
          label: "Data Analyst",
          config: {
            model: "gpt-4o",
            temperature: 0,
            tools: [],
            systemPrompt: "You are a data analyst. Review the provided raw data (CSV or JSON). Identify outliers, trends, and key metrics. Output a bulleted list of raw insights."
          }
        },
        {
          id: "executive_writer",
          type: "writer",
          label: "Exec Summary",
          config: {
            model: "gpt-4o",
            temperature: 0.5,
            tools: [],
            systemPrompt: "Take the raw insights from the data analyst and write a 2-paragraph executive summary highlighting the most critical business impacts."
          }
        }
      ],
      edges: [
        {
          id: "e1",
          source: "analyst",
          target: "executive_writer",
          condition: { type: "always" }
        }
      ]
    }
  },
  {
    name: "Customer Support Triager",
    description: "Evaluates a customer ticket, categorizes it, and decides if it needs a human agent or can be auto-resolved.",
    category: "support",
    tags: ["support", "triage", "decision-making"],
    author: "AgentFlow Team",
    rating: 4.6,
    usageCount: 2100,
    isPublic: true,
    isFeatured: true,
    workflowGraph: {
      nodes: [
        {
          id: "triage",
          type: "decision",
          label: "Ticket Triage",
          config: {
            model: "gpt-4o-mini",
            temperature: 0.1,
            tools: [],
            systemPrompt: "You are a support triage agent. Read the ticket. Output EXACTLY one of these words based on the content: 'REFUND', 'TECHNICAL', 'GENERAL', 'URGENT'."
          }
        },
        {
          id: "auto_reply",
          type: "writer",
          label: "Auto Replier",
          config: {
            model: "gpt-4o-mini",
            temperature: 0.7,
            tools: [],
            systemPrompt: "Write a polite response to the customer addressing their general inquiry based on the company knowledge base."
          }
        },
        {
          id: "human_escalate",
          type: "notifier",
          label: "Escalation Notifier",
          config: {
            model: "gpt-4o-mini",
            temperature: 0,
            tools: [],
            systemPrompt: "Format the ticket for human escalation. Include a summary of why it requires human attention."
          }
        }
      ],
      edges: [
        {
          id: "e1",
          source: "triage",
          target: "auto_reply",
          condition: { type: "contains", value: "GENERAL" }
        },
        {
          id: "e2",
          source: "triage",
          target: "human_escalate",
          condition: { type: "on_error" }
        }
      ]
    }
  }
];

async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    // Wipe existing templates
    await Template.deleteMany({});
    console.log('Cleared existing templates');

    // Insert new templates
    await Template.insertMany(SEED_TEMPLATES);
    console.log(`Seeded ${SEED_TEMPLATES.length} templates successfully`);

    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();