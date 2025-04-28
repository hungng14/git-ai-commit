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
  // .option('-m, --message <message>', 'Commit message')
  .description('Generate an AI-powered commit message and commit changes')
  .action(async (): Promise<void> => {
    console.log('Committing changes...');
    await commitChanges();
  });

// Parse command-line arguments
program.parse(process.argv);

// Get options
const options = program.opts();

// Log options for debugging
console.log('options: ', options);
