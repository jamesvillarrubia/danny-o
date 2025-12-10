# Pipecraft GitHub Issues

Repository: https://github.com/the-craftlab/pipecraft

## Issue 1: NX outputs generated even when NX is not present

**Title:** NX outputs generated even when NX is not present in repository

**Labels:** bug

**Body:**
```markdown
## Problem

The `detect-changes` action outputs `nxAvailable` and `affectedProjects` even when NX is not present in the repository. This creates confusion and unnecessary outputs in workflows that don't use NX.

## Current Behavior

When running change detection in a repository without NX:
- The action still outputs `nxAvailable` and `affectedProjects` 
- These outputs may be empty or contain misleading information
- The workflow appears to reference NX functionality even when it's not relevant

## Expected Behavior

When NX is not detected in the repository:
- `nxAvailable` should be set to `false` (this seems to work)
- `affectedProjects` should either not be output, or should be clearly documented as only relevant when NX is available
- The workflow should not reference NX-related outputs in contexts where NX doesn't exist

## Impact

- Confusing for users who don't use NX
- Unnecessary outputs cluttering workflow logs
- Potential for users to think NX is required or being used when it's not

## Suggested Fix

1. Only output `affectedProjects` when `nxAvailable` is `true`
2. Add clear documentation that these outputs are NX-specific
3. Consider making the NX-related outputs conditional or clearly marked as optional
```

---

## Issue 2: Initial config file template generation is unclear

**Title:** Initial config file template generation is unclear

**Labels:** enhancement, documentation

**Body:**
```markdown
## Problem

When running `pipecraft init`, the generated configuration file template is not clear about:
- What fields are required vs optional
- What the expected format/values should be
- Examples of valid configurations
- The difference between YAML and JSON formats

## Current Behavior

The `pipecraft init` command generates a basic template, but:
- Users are left guessing about field requirements
- Format expectations (YAML vs JSON) are unclear
- No examples or documentation in the generated file
- Validation errors only appear after generation, not during init

## Expected Behavior

The generated template should:
- Include comments explaining each field
- Show example values
- Indicate required vs optional fields
- Provide links to documentation
- Include common configuration patterns

## Impact

- Users struggle to configure Pipecraft correctly
- Trial-and-error approach to configuration
- Frustration when validation fails after generation
- Support burden from configuration questions

## Suggested Fix

1. Add comprehensive comments to the generated template
2. Include example values for each field
3. Add a `# Required fields:` section
4. Link to documentation in the generated file
5. Consider an interactive init mode that guides users through configuration
```

---

## Issue 3: Validate pipeline command suggestion references non-existent npm script

**Title:** Validate pipeline command suggestion references non-existent npm script

**Labels:** bug, documentation

**Body:**
```markdown
## Problem

After running `pipecraft generate`, the output suggests:
```
npm run validate:pipeline        # Check YAML is valid
```

However, this npm script may not exist in the user's repository. The `validate:pipeline` script appears to be specific to Pipecraft's own development setup, not something that exists in repositories using Pipecraft.

## Current Behavior

The post-generation message suggests running `npm run validate:pipeline`, but:
- This script doesn't exist in most user repositories
- Users may be confused when the command fails
- The suggestion implies this is a standard part of using Pipecraft

## Expected Behavior

The suggestion should either:
1. Only appear if the script actually exists in the repository
2. Be replaced with a more generic validation approach (e.g., `npx yaml-lint` or similar)
3. Be clearly marked as optional or Pipecraft-development-specific
4. Provide alternative validation methods that work in any repository

## Impact

- Confusing for users who don't have this script
- Misleading suggestion that doesn't apply to most users
- Users may think their setup is incomplete

## Suggested Fix

1. Check if `validate:pipeline` exists before suggesting it
2. Provide alternative validation commands that work universally (e.g., `npx yaml-lint .github/workflows/pipeline.yml`)
3. Make it clear this is optional
4. Or remove the suggestion entirely if it's only relevant to Pipecraft's own repo
```
