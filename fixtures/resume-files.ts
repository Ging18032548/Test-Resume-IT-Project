
import path from 'node:path';
import fs from 'node:fs';

// Resume file paths for LearnAce Automation
export const resumeFiles = {
  kanyarat: path.join(
    process.cwd(),
    'fixtures',
    'resumes',
    'Resume_Kanyarat_Patthanan.pdf'
  ),

  phiraphat: path.join(
    process.cwd(),
    'fixtures',
    'resumes',
    'Resume_Phiraphat_Chayanon.pdf'
  ),

  varin: path.join(
    process.cwd(),
    'fixtures',
    'resumes',
    'Resume_Varin_Methawee.pdf'
  ),
} as const;

// Validate that all Resume files exist
export function validateResumeFiles(): void {
  for (const [name, filePath] of Object.entries(resumeFiles)) {
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `Resume file not found for ${name}: ${filePath}`
      );
    }
  }
}
