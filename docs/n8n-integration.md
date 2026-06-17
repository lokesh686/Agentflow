# Bidirectional n8n Integration

This document describes how to integrate AgentFlow with n8n using bidirectional webhooks and HMAC security.

## Overview

The integration allows n8n to:
1.  **Trigger AgentFlow Workflows**: Start a workflow execution via a secure HMAC-signed webhook.
2.  **Receive Results Automatically**: AgentFlow will POST the final output back to an n8n webhook once execution is complete.

---

## 1. Trigger AgentFlow from n8n

To trigger a workflow, send a POST request to the AgentFlow API.

### Endpoint
`POST https://yourapp.com/v1/workflows/webhooks/{workflowId}/{secret}`

- `{workflowId}`: The ID of your AgentFlow workflow.
- `{secret}`: A secret key used for HMAC signing (can be configured per workflow).

### Authentication (HMAC)
Every request must include an `x-agentflow-signature` header. This signature is a SHA-256 HMAC of the request body, using your `webhookSecret` as the key.

**Format**: `sha256={hash}`

### n8n Node Configuration

**Node**: `HTTP Request`
- **Method**: `POST`
- **URL**: `https://yourapp.com/v1/workflows/webhooks/{workflowId}/{secret}`
- **Headers**:
    - `x-agentflow-signature`: `{{$node.Sign.json.signature}}` (Assuming a previous node calculates the signature)
- **Body**: `{{$json}}` (Pass your trigger data as the workflow input)

**Adding Callback URL**:
To receive results back, include `_callback_url` in your request body:
```json
{
  "task": "Research AI trends",
  "_callback_url": "https://your-n8n.com/webhook/agentflow-callback"
}
```

---

## 2. Receive Results in n8n

AgentFlow will automatically send a POST request to your `_callback_url` when the workflow finishes.

### n8n Node Configuration

**Node**: `Webhook`
- **HTTP Method**: `POST`
- **Path**: `/webhook/agentflow-callback`

### Callback Payload
```json
{
  "executionId": "648f...",
  "status": "completed",
  "output": "The research results...",
  "token_usage": {
    "prompt": 1200,
    "completion": 800,
    "total": 2000
  },
  "cost": 0.012
}
```

---

## 3. Sample n8n Workflow JSON

Import this JSON into n8n to get started. This sample demonstrates a **Research Agent → AgentFlow → Slack Notification** flow.

```json
{
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "agentflow-callback",
        "options": {}
      },
      "name": "AgentFlow Callback",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [
        800,
        300
      ],
      "webhookId": "agentflow-callback"
    },
    {
      "parameters": {
        "channel": "general",
        "text": "=AgentFlow execution {{ $json.executionId }} completed!\n\nOutput: {{ $json.output }}",
        "otherOptions": {}
      },
      "name": "Slack Notification",
      "type": "n8n-nodes-base.slack",
      "typeVersion": 1,
      "position": [
        1050,
        300
      ]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://yourapp.com/v1/workflows/webhooks/YOUR_WORKFLOW_ID/YOUR_SECRET",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "x-agentflow-signature",
              "value": "={{ $node[\"Calculate Signature\"].json.signature }}"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"input\": {{ $json.query }},\n  \"_callback_url\": \"https://your-n8n-instance.com/webhook/agentflow-callback\"\n}",
        "options": {}
      },
      "name": "Trigger AgentFlow",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [
        550,
        300
      ]
    },
    {
      "parameters": {
        "functionCode": "const crypto = require('crypto');\nconst secret = 'YOUR_SECRET';\nconst body = JSON.stringify(items[0].json);\nconst signature = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');\nreturn { signature };"
      },
      "name": "Calculate Signature",
      "type": "n8n-nodes-base.function",
      "typeVersion": 1,
      "position": [
        300,
        300
      ]
    }
  ],
  "connections": {
    "Calculate Signature": {
      "main": [
        [
          {
            "node": "Trigger AgentFlow",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "AgentFlow Callback": {
      "main": [
        [
          {
            "node": "Slack Notification",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```
