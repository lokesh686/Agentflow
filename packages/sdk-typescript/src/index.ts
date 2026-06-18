import axios, { AxiosInstance } from 'axios';

export class AgentFlowError extends Error {
  constructor(message: string, public status?: number, public data?: any) {
    super(message);
    this.name = 'AgentFlowError';
  }
}

export class AgentFlowClient {
  private api: AxiosInstance;

  constructor(apiKey: string, baseURL = 'https://api.agentflow.com/v1') {
    this.api = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          throw new AgentFlowError(
            error.response.data?.error || 'API Error',
            error.response.status,
            error.response.data
          );
        }
        throw new AgentFlowError(error.message);
      }
    );
  }

  public readonly workflows = {
    list: async () => {
      const res = await this.api.get('/workflows');
      return res.data.data;
    },
    create: async (data: any) => {
      const res = await this.api.post('/workflows', data);
      return res.data.data;
    },
    execute: async (id: string, input: any) => {
      const res = await this.api.post(`/workflows/${id}/execute`, { input });
      return res.data.data;
    }
  };

  public readonly executions = {
    get: async (id: string) => {
      const res = await this.api.get(`/executions/${id}`);
      return res.data.data;
    },
    cancel: async (id: string) => {
      const res = await this.api.post(`/executions/${id}/cancel`);
      return res.data;
    }
  };
}