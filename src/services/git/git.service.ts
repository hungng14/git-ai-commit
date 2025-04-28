import simpleGit, { SimpleGit, StatusResult, BranchSummary } from 'simple-git';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerateContentResult,
} from '@google/generative-ai';
import * as fs from 'fs';
import { GEMINI_API_KEY } from '../../config';
import { octokitService } from '../octokit/octokit.service';

// Initialize Google AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '');
const model: GenerativeModel = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
});

// Initialize Git
const git: SimpleGit = simpleGit();

/**
 * Get modified files from git status
 * @returns Array of modified file paths
 */
export async function getModifiedFiles(): Promise<string[]> {
  const status: StatusResult = await git.status();
  return status.modified;
}

/**
 * Get current git branch
 * @returns Current branch name
 */
export async function getCurrentBranch(): Promise<string> {
  const branch: BranchSummary = await git.branch();
  return branch.current;
}

/**
 * Read file content
 * @param file Path to the file
 * @returns File content as string
 */
export async function getFileContent(file: string): Promise<string> {
  return fs.promises.readFile(file, 'utf-8');
}

/**
 * Get diff of staged files
 * @returns Git diff as string
 */
export async function getStagedDiff(): Promise<string> {
  const diff: string = await git.diff(['--cached']);
  return diff;
}

/**
 * Get staged files
 * @returns Array of staged file paths
 */
export async function getStagedFiles(): Promise<string[]> {
  const stagedFiles: string = await git.diff(['--cached', '--name-only']);
  return stagedFiles.split('\n').filter((file) => file.trim() !== '');
}

/**
 * Generate commit message using AI
 * @param files Array of file paths
 * @returns Generated commit message or null if no files
 */
export async function generateCommitMessage(
  files: string[]
): Promise<string | null> {
  console.log('---> files: ', files);
  if (files.length === 0) {
    console.log('No modified files found.');
    return null;
  }

  const currentBranch: string = await getCurrentBranch();
  console.log('---> currentBranch', currentBranch);

  const diffContents: string = await getStagedDiff();
  console.log('---> diffContents', diffContents);

  const followTypes: string = `
          - types: feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert
          - scopes: auth|db|ui|api|deps|core|test`;

  const branchPrompt: string = `Using branch "${currentBranch}" as context, generate a commit message following these types: ${followTypes}. Eg: [lower case type]: [Commit message].\n\n`;

  // const prompt: string = `${branchPrompt} Generate a concise and meaningful commit message no more 40 words for the following changes:\n\n${diffContents}`;
  const prompt: string = `${branchPrompt} Based on the following diff contents: ${diffContents}, 
  create an object with the structure: { title: string, body: string }.
  Generate a concise and relevant title summarizing the overall change. 
  Generate a body following this format:

    ## ✨ Summary by Git AI

    ### 🔥 Changes
    - [List the key points or main changes found in the diff]

  The output should strictly be a JSON object like: { "title": "", "body": "" }.`;

  try {
    const result: GenerateContentResult = await model.generateContent(prompt);

    const commitMessage: string | undefined =
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text;

    return commitMessage || null;
  } catch (error) {
    console.error('Error generating commit message:', error);
    return null;
  }
}

/**
 * Commit changes with AI-generated message
 */
export async function commitChanges(): Promise<void> {
  const files: string[] = await getStagedFiles();
  const commitMessage: string | null = await generateCommitMessage(files);

  if (!commitMessage) return;

  await git.commit(commitMessage);
  // await git.push();
  console.log('Committed and pushed with AI-generated message:', commitMessage);

  // await octokitService.createPullRequest('hungng14', 'git-ai-commit', {
  //   title: commitMessage,
  //   body: `## ✨ Summary by Git AI

  //       ### 🔥 Changes

  //       - Implemented \`createPullRequest\` function
  //       - Added GitHub API integration via Axios

  //       ## ✅ Checklist

  //       - [x] Code compiles correctly
  //       - [x] Tests added and passing
  //       - [x] Documentation updated

  //       ## 📎 Related Issue`,
  //   head: 'feat/add-create-pr',
  //   base: 'main',
  // });
}

// Export the functions
export default {
  getModifiedFiles,
  getCurrentBranch,
  getFileContent,
  getStagedDiff,
  getStagedFiles,
  generateCommitMessage,
  commitChanges,
};
