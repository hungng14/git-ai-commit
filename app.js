#!/usr/bin/env node
require('dotenv').config();

const { Command } = require('commander');
const { generateCommitMessage, commitChanges } = require('./utils/git.js');

const program = new Command();

program
  .command('commit')
//   .option('-m, --message <message>', 'Commit message')
  .description('Generate an AI-powered commit message and commit changes')
  .action(async () => {
    console.log('Committing changes...');
    await commitChanges();
  });
  

program.parse(process.argv);

const options = program.opts();

console.log('options: ', options);
