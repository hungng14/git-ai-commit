#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { commitChanges } from './services/git/git.service';

/**
 * Main CLI application for git-ai-commit
 */

// Initialize the command-line interface
const program = new Command();

// Define the 'commit' command
program
  .command('commit')
  .option('--pr', 'Create a pull request after committing')
  .description('Generate an AI-powered commit message and commit changes')
  .action(async (options): Promise<void> => {
    console.log('Committing changes...');
    await commitChanges(options.pr);
  });

// Define the 'commit pr' command as a shorthand for 'commit --pr'
program
  .command('commit-pr')
  .description('Generate an AI-powered commit message, commit changes, and create a pull request')
  .action(async (): Promise<void> => {
    console.log('Committing changes and creating PR...');
    await commitChanges(true);
  });

// Parse command-line arguments
program.parse(process.argv);

// Get options
const options = program.opts();

// Log options for debugging
console.log('options: ', options);
