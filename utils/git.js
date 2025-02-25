require("dotenv").config();

const simpleGit = require('simple-git');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const { GEMINI_API_KEY } = require('../config/index.js');

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// const prompt = 'Explain how AI works';

// model.generateContent(prompt).then(console.log).catch(err => console.log(err));


const git = simpleGit();

// Get modified files
async function getModifiedFiles() {
    const status = await git.status();
    console.log('satatus: ', status);
    return status.modified;
}

// Read file content
async function getFileContent(file) {
    return fs.promises.readFile(file, 'utf-8');
}

// Generate commit message using AI
async function generateCommitMessage(files) {
    console.log('files: ', files);
  if (files.length === 0) {
    console.log('No modified files found.');
    return null;
  }

//   const fileContents = await Promise.all(files.map(getFileContent));
//   const prompt = `Generate a concise and meaningful commit message for the following changes:\n\n${fileContents.join(
//     '\n'
//   )}`;

//   const response = await openai.createChatCompletion({
//     model: 'gpt-4',
//     messages: [{ role: 'user', content: prompt }],
//   });

//   return response.data.choices[0].message.content.trim();
}

// Commit changes with AI-generated message
async function commitChanges() {
  const files = await getModifiedFiles();
//   const commitMessage = await generateCommitMessage(files);

//   if (!commitMessage) return;

//   await git.add(files);
//   await git.commit(commitMessage);
//   await git.push();
//   console.log('Committed and pushed with AI-generated message:', commitMessage);
}

module.exports = { commitChanges, generateCommitMessage };
