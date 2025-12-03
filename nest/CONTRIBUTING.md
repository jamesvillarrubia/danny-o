# Contributing Guide

Thank you for your interest in contributing to the Todoist AI Agent! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Commit Guidelines](#commit-guidelines)
- [Issue Guidelines](#issue-guidelines)

## Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes:**
- Trolling, insulting/derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js 22+** - `nvm use 22`
- **pnpm** - `npm install -g pnpm`
- **Git** - For version control
- **Docker** (optional) - For testing deployment
- **VS Code** (recommended) - With recommended extensions

### Fork and Clone

```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/tasks.git
cd tasks/nest

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/tasks.git
```

## Development Setup

### 1. Install Dependencies

```bash
# Install all dependencies
pnpm install

# Verify installation
pnpm list
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your API keys
# TODOIST_API_KEY=your_key_here
# CLAUDE_API_KEY=your_key_here
```

### 3. Build and Test

```bash
# Build TypeScript
pnpm build

# Run tests
pnpm test

# Start in dev mode
pnpm start:dev
```

### 4. IDE Setup (VS Code)

**Recommended Extensions:**
- ESLint
- Prettier
- TypeScript + JavaScript Language Features
- Jest Runner
- Docker

**Workspace Settings** (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## Development Workflow

### 1. Create a Feature Branch

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/amazing-feature
# or
git checkout -b fix/bug-description
```

### 2. Make Changes

- Write code following our [Code Style](#code-style)
- Add tests for new functionality
- Update documentation as needed
- Run linters and formatters

### 3. Test Your Changes

```bash
# Run all tests
pnpm test

# Run specific test
pnpm test -- sync.service.spec.ts

# Run with coverage
pnpm test:cov

# Lint code
pnpm lint

# Format code
pnpm format
```

### 4. Commit Changes

```bash
# Stage changes
git add .

# Commit with conventional commit message
git commit -m "feat: add task priority sorting"

# Push to your fork
git push origin feature/amazing-feature
```

### 5. Open Pull Request

- Go to GitHub and open a PR
- Fill out the PR template
- Link related issues
- Request review

## Code Style

### TypeScript

**Use strict typing:**

```typescript
// ✅ Good
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ❌ Bad
function calculateTotal(items: any): any {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

**Avoid `any` types:**

```typescript
// ✅ Good
interface TaskMetadata {
  category: string;
  timeEstimate?: number;
}

// ❌ Bad
let metadata: any;
```

**Use interfaces for objects:**

```typescript
// ✅ Good
interface CreateTaskDto {
  content: string;
  description?: string;
  priority?: number;
}

// ❌ Bad - anonymous type
function createTask(data: { content: string; priority?: number }) {}
```

### NestJS Conventions

**Use dependency injection:**

```typescript
// ✅ Good
@Injectable()
export class TaskService {
  constructor(
    @Inject('IStorageAdapter') private storage: IStorageAdapter,
    private logger: Logger,
  ) {}
}

// ❌ Bad - direct instantiation
export class TaskService {
  private storage = new SQLiteAdapter();
}
```

**Module structure:**

```typescript
@Module({
  imports: [StorageModule, ConfigurationModule],
  providers: [TaskService, TaskController],
  exports: [TaskService],
})
export class TaskModule {}
```

### Naming Conventions

**Files:**
- Services: `*.service.ts`
- Controllers: `*.controller.ts`
- Modules: `*.module.ts`
- DTOs: `*.dto.ts`
- Interfaces: `*.interface.ts`
- Tests: `*.spec.ts`

**Classes:**
```typescript
// PascalCase for classes
export class TaskService {}
export class CreateTaskDto {}
export interface IStorageAdapter {}
```

**Functions and variables:**
```typescript
// camelCase for functions and variables
const taskCount = 10;
function fetchTasks() {}
async function syncWithTodoist() {}
```

**Constants:**
```typescript
// UPPER_SNAKE_CASE for constants
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT = 5000;
```

### Formatting

**Automatically formatted by Prettier:**
- 2 space indentation
- Single quotes
- Semicolons
- Trailing commas
- 100 character line length

**Run formatter:**
```bash
pnpm format
```

### Linting

**ESLint rules enforced:**
- No unused variables
- No explicit `any`
- Consistent return types
- Import ordering

**Run linter:**
```bash
pnpm lint

# Fix auto-fixable issues
pnpm lint --fix
```

## Testing Guidelines

### Test Structure

```typescript
describe('TaskService', () => {
  let service: TaskService;
  let storage: MockStorageAdapter;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TaskService,
        {
          provide: 'IStorageAdapter',
          useClass: MockStorageAdapter,
        },
      ],
    }).compile();

    service = module.get(TaskService);
    storage = module.get('IStorageAdapter');
  });

  describe('getTasks', () => {
    it('should return all tasks', async () => {
      // Arrange
      storage.seedTasks([mockTask1, mockTask2]);

      // Act
      const result = await service.getTasks();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(mockTask1.id);
    });

    it('should filter by category', async () => {
      // ...
    });
  });
});
```

### Test Coverage

**Aim for 80%+ coverage:**

```bash
# Check coverage
pnpm test:cov

# View HTML report
open coverage/lcov-report/index.html
```

**What to test:**
- ✅ All service methods
- ✅ Edge cases and error handling
- ✅ Integration between modules
- ✅ E2E workflows
- ❌ Don't test NestJS framework code
- ❌ Don't test third-party libraries

### Writing Good Tests

**1. Arrange-Act-Assert pattern:**

```typescript
it('should classify task', async () => {
  // Arrange
  const task = createMockTask();
  claudeService.setMockResponse('classify', { category: 'work' });

  // Act
  const result = await aiOps.classifyTask(task);

  // Assert
  expect(result.category).toBe('work');
});
```

**2. Descriptive test names:**

```typescript
// ✅ Good
it('should throw error when task not found')
it('should return empty array when no tasks match filter')

// ❌ Bad
it('works')
it('test getTasks')
```

**3. Use test fixtures:**

```typescript
// Import shared fixtures
import { mockTasks, createMockTask } from '../../fixtures/tasks.fixture';

it('should process tasks', () => {
  const task = createMockTask({ category: 'work' });
  // ...
});
```

**4. Mock external dependencies:**

```typescript
// Mock Claude API
claudeService.setMockResponse('classify', {
  category: 'work',
  confidence: 0.9,
});

// Mock Todoist API
taskProvider.seedTasks([mockTask]);
```

## Documentation

### Code Comments

**JSDoc for public APIs:**

```typescript
/**
 * Classify a task into a category using AI.
 * 
 * @param task - The task to classify
 * @param options - Classification options
 * @returns Classification result with category and confidence
 * @throws Error if AI service is unavailable
 * 
 * @example
 * ```typescript
 * const result = await aiOps.classifyTask(task);
 * console.log(result.category); // 'work'
 * ```
 */
async classifyTask(task: Task, options?: ClassifyOptions): Promise<ClassificationResult> {
  // Implementation
}
```

**Inline comments for complex logic:**

```typescript
// Parse Claude response and extract category
// Note: Response format changed in API v2024-01
const category = response.content[0].text.match(/category: (\w+)/)?.[1];
```

### README Updates

When adding features, update:
- Feature list
- Usage examples
- Configuration options
- MCP tool list

### Architecture Documentation

For significant changes, update [ARCHITECTURE.md](./ARCHITECTURE.md):
- New modules
- Design patterns
- Data flow changes

## Pull Request Process

### Before Submitting

**Checklist:**
- [ ] Tests pass (`pnpm test`)
- [ ] Linter passes (`pnpm lint`)
- [ ] Code formatted (`pnpm format`)
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] Branch is up to date with main

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How was this tested?

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. **Automated checks run** - CI/CD pipeline
2. **Code review** - At least one approval required
3. **Testing** - Reviewer tests changes
4. **Feedback** - Address review comments
5. **Merge** - Maintainer merges when approved

### After Merge

- Delete your feature branch
- Update your fork
- Close related issues

## Commit Guidelines

### Conventional Commits

Format: `<type>(<scope>): <description>`

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Code style (formatting, no logic change)
- `refactor` - Code refactoring
- `test` - Test updates
- `chore` - Build/tooling changes
- `perf` - Performance improvements

**Examples:**

```bash
# Feature
git commit -m "feat(ai): add task breakdown functionality"

# Bug fix
git commit -m "fix(sync): handle rate limit errors correctly"

# Documentation
git commit -m "docs(readme): update installation instructions"

# Breaking change
git commit -m "feat(storage)!: migrate to PostgreSQL schema v2

BREAKING CHANGE: Database schema changed, migration required"
```

### Commit Best Practices

**Do:**
- ✅ Make atomic commits (one logical change)
- ✅ Write clear, descriptive messages
- ✅ Reference issues (`Closes #123`)
- ✅ Keep commits focused

**Don't:**
- ❌ Commit multiple unrelated changes
- ❌ Use vague messages ("fix stuff", "updates")
- ❌ Commit commented-out code
- ❌ Commit `.env` files or secrets

## Issue Guidelines

### Creating Issues

**Bug Report:**
```markdown
**Describe the bug**
A clear description

**To Reproduce**
1. Run command X
2. See error

**Expected behavior**
What should happen

**Environment**
- OS: macOS 14
- Node: 22.0.0
- Version: 2.0.0

**Logs**
```
Error message here
```

**Feature Request:**
```markdown
**Is your feature request related to a problem?**
Description

**Describe the solution**
What you want to happen

**Alternatives considered**
Other solutions

**Additional context**
Any other information
```

### Issue Labels

- `bug` - Something isn't working
- `enhancement` - New feature request
- `documentation` - Documentation improvements
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `question` - Further information requested

## Getting Help

### Resources

- **Documentation**: [README.md](./README.md), [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)

### Questions?

- Open a [GitHub Discussion](https://github.com/your-repo/discussions)
- Join our Discord/Slack (if available)
- Email maintainers

## Recognition

Contributors are recognized in:
- README.md contributors section
- Release notes
- GitHub contributors page

Thank you for contributing! 🎉

---

**Ready to contribute?** Start with a [good first issue](https://github.com/your-repo/issues?q=label%3A%22good+first+issue%22)!

