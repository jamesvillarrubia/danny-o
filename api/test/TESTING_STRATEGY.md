# Testing Strategy

This document defines the testing philosophy and guidelines for the Danny Tasks API.

## Testing Trophy

We follow a "testing trophy" approach, prioritizing integration/contract tests over unit tests:

```
        ╱╲
       ╱  ╲        Smoke Tests (tiny) - Health checks
      ╱────╲
     ╱      ╲
    ╱        ╲     Contract Tests (large) - Step-CI black-box API testing
   ╱──────────╲
  ╱            ╲
 ╱              ╲  Unit Tests (small) - Pure functions, algorithms only
╱────────────────╲
══════════════════  Static Analysis - TypeScript + ESLint
```

## Principles

1. **Test at boundaries, not through mocks** - If behavior is observable via the API, test it via Step-CI contracts, not unit tests with mocked internals.

2. **If Step-CI can test it, don't unit test it** - Contract tests provide higher confidence because they test the real system.

3. **AI responses use static fixtures** - Deterministic responses for reproducible tests without per-test mock setup.

4. **No frontend testing** - API correctness is the source of truth. Visual/display issues are caught via manual QA.

5. **Idempotent contract tests** - Tests create and clean up their own data, can run in any order.

## Test Layers

### Layer 1: Static Analysis (Base)

**Tools:** TypeScript, ESLint

**What it catches:**
- Type errors
- Unused variables
- Import errors
- Code style violations

**When it runs:** On every file save, pre-commit, and CI

### Layer 2: Unit Tests (Small)

**Tool:** Vitest

**What to unit test:**
- Pure functions with complex logic (e.g., query expansion, filter algorithms)
- Edge cases not easily testable via API (e.g., sync token handling, cache invalidation)
- Utility functions (`lib/utils.ts`, `lib/taskFilters.ts`)

**What NOT to unit test:**
- Service methods that are already tested via Step-CI contracts
- Database queries (tested via contract tests)
- API endpoint behavior (tested via contract tests)
- AI operations (tested via contract tests with static fixtures)

**Example of a GOOD unit test:**
```typescript
// Testing pure function logic
describe('taskFilters', () => {
  it('should filter tasks by time constraint', () => {
    const tasks = [
      { id: '1', metadata: { timeConstraint: 'business-hours' } },
      { id: '2', metadata: { timeConstraint: 'anytime' } },
    ];
    const result = filterByTimeConstraint(tasks, 'business-hours');
    expect(result).toHaveLength(1);
  });
});
```

**Example of a BAD unit test (duplicates contract coverage):**
```typescript
// This is tested via Step-CI POST /v1/ai/classify
describe('AIOperationsService', () => {
  it('should classify tasks using AI', async () => {
    claudeMock.setMockResponse('classify', {...});
    const result = await service.classifyTasks(tasks);
    // This just tests that the mock works, not the real system
  });
});
```

### Layer 3: Contract Tests (Large - Primary)

**Tool:** Step-CI

**What contract tests cover:**
- All API endpoints (CRUD operations)
- Request/response format validation
- Error handling (404, 400, 500)
- Complete workflows (sync → classify → complete)
- AI operations with static mock responses

**Test Types:**

1. **Blueprint Tests** (`step-ci/workflows/blueprint/`) - Endpoint availability and format:
   - Does the endpoint exist?
   - Does it return the expected status code?
   - Does the response have the expected shape?

2. **Contract Tests** (`step-ci/workflows/contracts/`) - Complete workflows:
   - Create → Read → Update → Delete lifecycle
   - Sync → Classify → Complete workflow
   - Error scenarios

**Running contract tests:**
```bash
# With mocks (CI)
pnpm test:step-ci:mock

# Against real Todoist (manual validation)
pnpm test:step-ci:real
```

### Layer 4: Smoke Tests (Tiny)

**What:** Health check endpoint validation

**When:** After deployment, in CI

**Implementation:** Step-CI `health.yaml` blueprint test

## AI Testing Strategy

### Static Response Fixtures

AI operations use deterministic fixtures instead of per-test mock setup:

```
test/fixtures/ai-responses/
├── classify.json      # Classification response
├── estimate.json      # Time estimation response
├── prioritize.json    # Prioritization response
├── breakdown.json     # Subtask breakdown response
├── insights.json      # Productivity insights response
└── daily-plan.json    # Daily plan response
```

### How It Works

1. **Mock Mode** (`USE_MOCKS=true`): `MockClaudeService` returns static fixtures based on prompt type detection.

2. **Real Mode**: Actual Claude API is called (for manual validation only).

3. **Recording Mode** (`pnpm test:step-ci:record`): Captures real responses to update fixtures.

### Fixture Format

```json
{
  "promptType": "classify",
  "response": {
    "tasks": [
      {
        "taskId": "task_1",
        "category": "work",
        "confidence": 0.95,
        "reasoning": "Software development task"
      }
    ]
  }
}
```

## File Structure

```
api/test/
├── TESTING_STRATEGY.md     # This file
├── setup.ts                # Vitest global setup
├── fixtures/
│   ├── tasks.fixture.ts    # Task/project/label test data
│   └── ai-responses/       # Static AI response fixtures
│       ├── classify.json
│       ├── estimate.json
│       └── ...
├── mocks/
│   ├── claude.mock.ts      # Uses static fixtures
│   ├── storage.mock.ts     # In-memory storage
│   └── task-provider.mock.ts
└── unit/
    └── task/
        ├── enrichment.service.spec.ts  # Pure logic tests
        └── sync.service.spec.ts        # Internal behavior tests
```

## When to Write Tests

### Add a Unit Test When:
- You're implementing a pure function with complex logic
- The behavior is internal and not observable via API
- You need to test edge cases that are hard to trigger via API

### Rely on Contract Tests When:
- Testing API endpoint behavior
- Testing database operations
- Testing service method outputs
- Testing AI operation results

### Don't Write Tests For:
- Simple CRUD operations (covered by contract tests)
- Passthrough methods with no logic
- Configuration loading
- Third-party library wrappers

## Running Tests

```bash
# Static analysis
pnpm tsc --noEmit
pnpm lint

# Unit tests
pnpm test              # Run once
pnpm test:watch        # Watch mode
pnpm test:cov          # With coverage

# Contract tests (primary)
pnpm test:step-ci:mock # CI mode with mocks

# Manual validation
pnpm test:step-ci:real # Against real APIs (careful!)
```

## CI Pipeline

```yaml
jobs:
  test:
    steps:
      - name: Type Check
        run: pnpm tsc --noEmit
      
      - name: Lint
        run: pnpm lint
      
      - name: Unit Tests
        run: pnpm test
      
      - name: Contract Tests
        run: pnpm test:step-ci:mock
```

## Maintenance

### When Changing API Contracts:
1. Update Step-CI workflow to reflect new contract
2. Run `pnpm test:step-ci:mock` to verify
3. Run `pnpm test:step-ci:real` to validate against real APIs

### When Adding New AI Operations:
1. Add static fixture to `test/fixtures/ai-responses/`
2. Add Step-CI contract test for the endpoint
3. Update `MockClaudeService` if needed

### When Refactoring Internals:
1. Run `pnpm test:step-ci:mock` - if contracts pass, refactor is safe
2. Unit tests may break if testing internal implementation details (this is expected)
