# Known Issues

## Dependency Injection with tsx Runtime

### Problem
When using `tsx` (Node 24's `--experimental-strip-types`), TypeScript decorator metadata is **not emitted**. This means that NestJS dependency injection requires **explicit `@Inject()` decorators** for all constructor parameters.

### Why Tests Didn't Catch This
- **Tests run with `ts-jest`**: Properly compiles TypeScript with `emitDecoratorMetadata: true`
- **Runtime uses `tsx`**: Strips types without emitting decorator metadata
- **Result**: Tests pass, but runtime fails with `undefined` injected services

### Solution
**All constructor dependencies MUST use explicit `@Inject()` decorators:**

```typescript
// ❌ BAD - Works in tests, fails at runtime with tsx
constructor(private readonly myService: MyService) {}

// ✅ GOOD - Works everywhere
constructor(@Inject(MyService) private readonly myService: MyService) {}

// ✅ GOOD - String tokens always work
constructor(@Inject('IStorageAdapter') private readonly storage: IStorageAdapter) {}
```

### Files That Required Fixes
- `src/cli/commands/sync.command.ts` - SyncService injection
- `src/task/services/sync.service.ts` - ReconciliationService injection  
- `src/task/services/reconciliation.service.ts` - TaxonomyService injection
- `src/cli/commands/insights.command.ts` - AIOperationsService injection
- `src/health/indicators/claude.indicator.ts` - ClaudeService injection

### Prevention
1. **Code Review Checklist**: All constructors with DI must have `@Inject()`
2. **Linting Rule**: Consider adding ESLint rule to enforce this
3. **Integration Tests**: Run tests against the actual `tsx` runtime, not just `ts-jest`

### Alternative Solutions Considered
1. **Use `tsc` + `node`**: Slower startup, requires build step
2. **Use `ts-node`**: Slower than `tsx`, but emits metadata
3. **Stick with `tsx`**: Fast, modern, but requires explicit decorators ✅ **CHOSEN**

### References
- https://github.com/privatenumber/tsx/issues/354
- https://docs.nestjs.com/fundamentals/custom-providers#non-class-based-provider-tokens

