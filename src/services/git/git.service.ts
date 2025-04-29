import simpleGit, { SimpleGit, StatusResult, BranchSummary } from 'simple-git';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerateContentResult,
} from '@google/generative-ai';
import * as fs from 'fs';
import { GEMINI_API_KEY } from '../../config';
import { octokitService } from '../octokit/octokit.service';
import { parseCustomJSONString } from '../../helper/str';

// Initialize Google AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '');
const model: GenerativeModel = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
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

  // const branchPrompt: string = `Using branch "${currentBranch}" as context, generate a commit message following these types: ${followTypes}. Eg: [lower case type]: [Commit message].\n\n`;

  // const prompt: string = `${branchPrompt} Generate a concise and meaningful commit message no more 40 words for the following changes:\n\n${diffContents}`;
  const prompt: string = `Here is the Git diff content: [${diffContents}].

Convert the diff into a structured JSON object following **EXACTLY** this format:

{
  "title": "[Generate a short, clear title following this format: [type]: [commit message]. Types: feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert. Scopes (optional): auth|db|ui|api|deps|core|test]",
  "body": ["- List key points or main changes from the diff, each as a separate string"]
}

**Important rules:**
- Start every item in the body array with a dash (-) followed by a space.
- Return **ONLY** the raw JSON object.
- STRICTLY follow the { title, body } structure.
- **DO NOT** include any extra explanation, markdown formatting, or comments.
      `;

  try {
    console.log('prompt', prompt);
    const result: GenerateContentResult = await model.generateContent({
      systemInstruction: `You are a Git commit message generator.

Your task is to analyze provided Git diffs, file modifications, or user descriptions, and generate a concise, clear Git commit message.

**Rules you must follow:**
- You must always return a **JSON object** with two fields:
  - \`title\`: A short, clear commit title, following the format \`[type]: [message]\`.
    - Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
    - Optionally, you may use scopes like auth, db, ui, api, deps, core, test (example: \`feat(auth): add login validation\`).
    - Keep the title under 72 characters if possible.
  - \`body\`: An array of strings. Each string describes a key point or main change from the diff.
    - Each body item must start with a dash (-) followed by a space.
    - Focus on summarizing what changed and why, not how.
    - Each entry should be a clear, standalone point.

**Important:**
- Return **only** the raw JSON object. No extra text, no explanations, no markdown, no comments.
- **Strictly** follow the required \`{ title, body }\` structure.
- If the diff is empty or minor, still generate a meaningful title and leave \`body\` empty if necessary.
- Prioritize clarity, accuracy, and relevance.`,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    });
    console.log(
      'result.response?.candidates?.[0]?.content?.parts',
      result.response?.candidates?.[0]?.content?.parts
    );
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
  const commitMessage: { title: string; body: string } | null =
    await generateContentGithubChange(files);
  if (!commitMessage) {
    throw new Error('Can not generate commit message');
  }
  console.log('commitMessage', commitMessage);

  await git.commit(commitMessage.title);
  await git.push();

  await octokitService.createPullRequest('hungng14', 'git-ai-commit', {
    title: commitMessage.title,
    body: commitMessage.body,
    head: await getCurrentBranch(),
    base: 'main',
  });
}

const generateContentGithubChange = async (files: string[]) => {
  let commitMessage: string | null = await generateCommitMessage(files);

  // Retry once if commitMessage is null
  if (!commitMessage) {
    console.log('First attempt failed to generate commit message. Retrying...');
    commitMessage = await generateCommitMessage(files);

    if (!commitMessage) {
      console.error('Failed to generate commit message after retry.');
      return; // Stop if still no message
    }
  }

  console.log('Committed and pushed with AI-generated message:', commitMessage);

  let changes = parseCustomJSONString(commitMessage);

  // Retry once if changes is null
  if (!changes) {
    console.log('First attempt failed to parse changes. Retrying...');
    commitMessage = await generateCommitMessage(files);

    if (!commitMessage) {
      console.error(
        'Failed to generate commit message after retry (parse retry).'
      );
      return;
    }

    console.log('Retry commit message:', commitMessage);

    changes = parseCustomJSONString(commitMessage);

    if (!changes) {
      console.error('Failed to parse changes after retry.');
      return;
    }
  }
  console.log('changes', changes);

  return changes;
};

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
