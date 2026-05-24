import { execSync } from 'child_process';
import { ui } from '../utils/ui-helpers.js';

export const dev = async () => {
  ui.section('🚀 Development Server', 'Starting development environment');

  try {
    ui.info('Running npm run dev...');
    execSync('npm run dev', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } catch (error) {
    ui.error(
      'Failed to start development server',
      error instanceof Error ? error.message : 'Unknown error',
    );
    process.exit(1);
  }
};
