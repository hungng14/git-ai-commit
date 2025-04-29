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
 * Extract owner and repo from git remote URL
 * @returns Object containing owner and repo
 */
export async function getRepoInfo(): Promise<{ owner: string; repo: string }> {
  try {
    // Get the remote URL
    const remoteUrl = await git.remote(['get-url', 'origin']);
    console.log('remoteUrl', remoteUrl)

    if (!remoteUrl) {
      throw new Error('Could not get remote URL');
    }

    // Parse the URL to extract owner and repo
    let owner = '';
    let repo = '';

    // Handle different URL formats
    if (remoteUrl.includes('github.com')) {
      // Format: https://github.com/owner/repo.git or git@github.com:owner/repo.git
      const urlParts = remoteUrl
        .replace('https://github.com/', '')
        .replace('git@github.com:', '')
        .replace('.git', '')
        .trim()
        .split('/');

      if (urlParts.length >= 2) {
        owner = urlParts[0];
        repo = urlParts[1];
      }
    }

    if (!owner || !repo) {
      throw new Error(`Could not parse owner and repo from remote URL: ${remoteUrl}`);
    }

    return { owner, repo };
  } catch (error) {
    console.error('Error getting repo info:', error);
    throw error;
  }
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

  // Define commit message types and scopes for reference
  // const followTypes: string = `
  //         - types: feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert
  //         - scopes: auth|db|ui|api|deps|core|test`;

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
 * @param createPR Whether to create a pull request after committing
 */
export async function commitChanges(createPR?: boolean): Promise<void> {
  const files: string[] = await getStagedFiles();
  const commitMessage: { title: string; body: string } | null =
    await generateContentGithubChange(files);

  if (!commitMessage) {
    return console.error(
      '\x1b[31m%s\x1b[0m',
      'Cannot generate commit message, please push the changed files to generate commit!'
    );
  }
  console.log('commitMessage', commitMessage);

  await git.commit(commitMessage.title);
  await git.push();

  console.log(
    '\x1b[32m%s\x1b[0m',
    `✅ Changes committed and pushed with message: ${commitMessage.title}`
  );

  // Only create a PR if the createPR flag is true
  if (createPR) {
    console.log('\x1b[36m%s\x1b[0m', '🔄 Creating pull request...');
    try {
      // Get repository owner and name
      const { owner, repo } = await getRepoInfo();
      console.log(`Repository info - Owner: ${owner}, Repo: ${repo}`);

      const prResult = await octokitService.createPullRequest(
        owner,
        repo,
        {
          title: commitMessage.title,
          body: commitMessage.body,
          head: await getCurrentBranch(),
          base: 'main',
        }
      );

      if (prResult.message) {
        // This is a custom message when no PR was created
        console.log('\x1b[33m%s\x1b[0m', `ℹ️ ${prResult.message}`);
        console.log('\x1b[33m%s\x1b[0m', `ℹ️ Branch URL: ${prResult.html_url}`);
      } else {
        // PR was created or updated successfully
        console.log(
          '\x1b[32m%s\x1b[0m',
          `✅ Pull request created/updated successfully: ${prResult.html_url}`
        );
      }
    } catch (error) {
      console.error(
        '\x1b[31m%s\x1b[0m',
        'Failed to create pull request:',
        error
      );
    }
  }
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

    changes = parseCustomJSONString(commitMessage);

    if (!changes) {
      console.error('Failed to parse changes after retry.');
      return;
    }
  }
  return changes;
};

// Export the functions
export default {
  getModifiedFiles,
  getCurrentBranch,
  getRepoInfo,
  getFileContent,
  getStagedDiff,
  getStagedFiles,
  generateCommitMessage,
  commitChanges,
};
