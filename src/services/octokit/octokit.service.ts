#!/usr/bin/env node
import 'dotenv/config';

import axios from 'axios';

const octokitRequest = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    Authorization: `Bearer ${process.env.GH_ACCESS_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  },
});

class OctokitService {
  async listPullRequests(owner: string, repo: string) {
    const result = await octokitRequest
      .get(`/repos/${owner}/${repo}/pulls`)
      .then((res) => res.data);

    console.log('result.data', result);

    return result.data;
  }

  async createPullRequest(
    owner: string,
    repo: string,
    data: {
      title: string;
      body: string;
      head: string;
      base: string;
    }
  ) {
    try {
      const result = await octokitRequest
        .post(`/repos/${owner}/${repo}/pulls`, data)
        .then((res) => res.data);

      console.log('result.data', result);

      this.listPullRequests('hungng14', 'git-ai-commit');

      return result.data;
    } catch (error: any) {
      console.log('error', error?.response?.data);
    }
  }
}

export const octokitService = new OctokitService();

