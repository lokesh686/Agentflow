# AgentFlow Pro + n8n Integration Guide

This guide provides everything you need to trigger AgentFlow Pro workflows from n8n and get the results back.

## 1. Triggering an AgentFlow Workflow

You can trigger any AgentFlow workflow using its unique webhook URL.

### Steps:

1.  **Get the Webhook URL in AgentFlow:**
    *   Navigate to the workflow you want to trigger.
    *   Click on the "Webhook" button in the header.
    *   Copy the full **Webhook URL**. It will look like this: `https://yourapp.com/v1/webhooks/{workflowId}/{secret}`

2.  **Configure the HTTP Request Node in n8n:**
    *   Add an `HTTP Request` node to your n8n workflow.
    *   **Method:** `POST`
    *   **URL:** Paste the Webhook URL from AgentFlow.
    *   **Body Content Type:** `JSON`
    *   **Body:** This is where you provide the input for your workflow. It must be a JSON object. To pass data from previous n8n nodes, use expressions. For example:
        ```json
        {
            "task": "Summarize the following article for me.",
            "article_url": "{{ $json.articleUrl }}",
            "_callback_url": "{{ $n8n.webhookUrl }}"
        }
        ```

### Important: Using the Callback URL

To get the results of your AgentFlow execution back into n8n, you **must** include the `_callback_url` field in your JSON body.

*   **Field Name:** `_callback_url`
*   **Value:** Use the n8n expression `{{ $n8n.webhookUrl }}`. This special expression tells n8n to generate a unique, temporary webhook URL for this specific run.

AgentFlow will automatically POST the final result to this URL when the execution is complete.

## 2. Receiving the Result in n8n

To receive the result, you need a `Webhook` trigger node in a *separate* n8n workflow.

1.  Create a new n8n workflow.
2.  Add a `Webhook` node as the trigger.
3.  When you first set it up, n8n will provide you with a test URL. The URL you use in the `_callback_url` field will be different, but this setup allows the workflow to receive the data.
4.  When AgentFlow completes, it will send a `POST` request to your callback URL with the following JSON payload:
    ```json
    {
        "executionId": "...",
        "workflowId": "...",
        "status": "COMPLETED",
        "finalOutput": "This is the final result from the agent workflow."
    }
    ```
5.  You can now use this data in subsequent n8n nodes.

## 3. Securing Your Webhook (Optional but Recommended)

For production use, you should verify the signature of the incoming webhook from AgentFlow to ensure it's authentic.

*AgentFlow does not yet support sending a signature on the callback, but the trigger webhook can be secured.* This section will be updated when callback signatures are available.
