require('dotenv').config();

const simpleGit = require('simple-git');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const { GEMINI_API_KEY } = require('../config/index.js');

const genAI = new GoogleGenerativeAI('AIzaSyC6lR0x5BhzEL6b0AGjqY6n9v5w90cVDNc');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// const prompt = 'Explain how AI works';

// model.generateContent(prompt).then(console.log).catch(err => console.log(err));

const git = simpleGit();

// Get modified files
async function getModifiedFiles() {
  const status = await git.status();

  return status.modified;
}

// Get current branch
async function getCurrentBranch() {
  const branch = await git.branch();
  return branch.current;
}

// Read file content
async function getFileContent(file) {
  return fs.promises.readFile(file, 'utf-8');
}

// Get diff of staged files
async function getStagedDiff() {
  const diff = await git.diff(['--cached']);
  return diff;
}

// Get staged files
async function getStagedFiles() {
  const stagedFiles = await git.diff(['--cached', '--name-only']);
  return stagedFiles.split('\n').filter((file) => file.trim() !== '');
}

// Generate commit message using AI
async function generateCommitMessage(files) {
  console.log('---> files: ', files);
  if (files.length === 0) {
    console.log('No modified files found.');
    return null;
  }
  const currentBranch = await getCurrentBranch();
  console.log('---> currentBranch', currentBranch);
  const diffContents = await getStagedDiff();
  console.log('---> diffContents', diffContents);

  const branchPrompt = `Current branch: ${currentBranch}.\n\n`;

  const prompt = `${branchPrompt} Generate a concise and meaningful commit message no more 40 words for the following changes:\n\n${diffContents}`;

  const result = await model.generateContent(prompt);

  const commitMessage =
    result.response?.candidates?.[0]?.content?.parts?.[0]?.text;

  return commitMessage;
}

// Commit changes with AI-generated message
async function commitChanges() {
  const files = await getStagedFiles();
  const commitMessage = await generateCommitMessage(files);

  if (!commitMessage) return;

  await git.commit(commitMessage);
  await git.push();
  console.log('Committed and pushed with AI-generated message:', commitMessage);
}

module.exports = { commitChanges, generateCommitMessage };
