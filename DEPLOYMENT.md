# Deployment Commands Examples

## Development Deployment

```bash
# Deploy current main branch to dev branch (force push)
dk deploy dev
# or
npm run deploy:dev
```

## Production Deployment

```bash
# Full production deployment workflow
dk deploy prod
# or
npm run deploy:prod
```

This command will:

1. ✅ Pull from stable branch
2. ✅ Check for uncommitted changes
3. ✅ Verify you're on main branch
4. ✅ Auto-increment version if needed (internal helper)
5. ✅ Run npm install
6. ✅ Create deployment commit
7. ✅ Push to main branch
8. ✅ Create PR to stable branch
9. ✅ Open PR in browser

## Command Structure

The CLI uses a hierarchical command structure:

```bash
dk deploy --help          # Show deployment subcommands
dk deploy dev --help      # Show dev deployment options
dk deploy prod --help     # Show prod deployment options
```

## Version Management

Version incrementing is handled automatically by the `deploy prod` command when needed. The system compares the current version in `package.json` with the last deployed version in `deploy.json`:

- If versions match → auto-increment patch version
- If versions differ → use current version (manual increment detected)

## Example Output

### deploy dev

```
🚀 Deploying to development environment...
✅ Successfully deployed to development environment!
```

### deploy prod

```
🚀 Starting production deployment...
📦 Incrementing version...
✅ Version incremented from 1.0.0 to 1.0.1
📥 Installing npm packages...
📋 Creating pull request...
✅ Pull request created successfully!
🎉 Production deployment completed successfully!
```

## Error Handling

The CLI provides clear error messages:

- ❌ "There are uncommitted changes" - commit or stash first
- ❌ "You must be on the main branch" - switch to main
- ❌ "package.json not found" - run from project root
- ❌ "Failed to create pull request" - check GitHub CLI setup

## Dependencies

- **Git**: Required for all commands
- **GitHub CLI** (optional): For PR creation in deploy prod
- **npm**: For package management
- **Node.js**: To run the CLI
