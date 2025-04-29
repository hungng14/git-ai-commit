/**
 * Example usage of the git service
 */
import 'dotenv/config';
import gitService from './services/git/git.service';

async function main(): Promise<void> {
  try {
    // Get current branch
    const branch = await gitService.getCurrentBranch();
    console.log('Current branch:', branch);
    
    // Get modified files
    const modifiedFiles = await gitService.getModifiedFiles();
    console.log('Modified files:', modifiedFiles);
    
    // Get staged files
    const stagedFiles = await gitService.getStagedFiles();
    console.log('Staged files:', stagedFiles);
    
    // If there are staged files, generate a commit message
    if (stagedFiles.length > 0) {
      console.log('Generating commit message for staged files...');
      const commitMessage = await gitService.generateCommitMessage(stagedFiles);
      console.log('Generated commit message:', commitMessage);
      
      // Uncomment to actually commit and push changes
      // await gitService.commitChanges();
    } else {
      console.log('No staged files found. Stage some files with `git add` first.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
main();
