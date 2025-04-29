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
  async listPullRequests(owner: string, repo: string, head?: string) {
    const params = head ? `?head=${head}` : '';
    const result = await octokitRequest
      .get(`/repos/${owner}/${repo}/pulls${params}`)
      .then((res) => res.data);

    console.log('listPullRequests result:', result);

    return result;
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
      // Check if PR already exists with the same head branch
      const existingPRs = await this.listPullRequests(
        owner,
        repo,
        `${owner}:${data.head}`
      );

      if (existingPRs && existingPRs.length > 0) {
        // PR already exists, update it
        console.log('PR already exists, updating it...');
        const existingPR = existingPRs[0];
        const prNumber = existingPR.number;

        // Append the new body content to the existing body
        const updatedBody = existingPR.body
          ? `${existingPR.body}\n${data.body}`
          : ` ## ✨ Summary by Git AI

                ### 🔥 Changes
                ${data.body}
            `;

        // Update the PR
        const updateResult = await octokitRequest
          .patch(`/repos/${owner}/${repo}/pulls/${prNumber}`, {
            // title: data.title,
            body: updatedBody,
          })
          .then((res) => res.data);

        console.log('PR updated successfully:', updateResult);
        return updateResult;
      } else {
        // PR doesn't exist, create a new one
        console.log('Creating new PR...');
        const result = await octokitRequest
          .post(`/repos/${owner}/${repo}/pulls`, {
            ...data,
            body: `
                ## ✨ Summary by Git AI

                ### 🔥 Changes
                ${data.body}
            `,
          })
          .then((res) => res.data);

        console.log('New PR created successfully:', result);
        return result;
      }
    } catch (error: any) {
      console.log('Error creating/updating PR:', error?.response?.data);
      throw error;
    }
  }
}

export const octokitService = new OctokitService();
