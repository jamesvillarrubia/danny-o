# Dynamic Chat Filters with REST Query, MCP Tools, and Semantic Search

## Overview

When users ask Danny to list tasks in chat, the response should dynamically update the task view instead of just showing tasks in the chat. The active filter should be visible above the task list, and users should be able to save temporary views. The system should support FeathersJS-style REST query filtering, MCP-enabled query/text filtering, and semantic vector search - all exposed to the AI so it can intelligently create filters from natural language user intent.

## Issues to Address

1. Chat lists tasks but doesn't update the view
2. Active filter is not visible to users
3. No way to save temporary views created by chat
4. Only PERSONAL tasks are showing (need to investigate and fix)
5. Need REST-enabled filtering similar to FeathersJS query standards
6. Need MCP tools for query/text filtering
7. Need semantic/vector search capabilities exposed to AI

## Implementation Plan

### 1. Backend: Implement FeathersJS-Style REST Query Filtering

**Files**: 
- `api/src/api/controllers/v1/tasks.controller.ts`
- `api/src/api/dto/task.dto.ts`
- `api/src/storage/adapters/kysely.adapter.ts`
- New: `api/src/common/utils/query-parser.ts`

**Changes**:
- Create query parser utility to parse FeathersJS-style query strings
- Support operators: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$like`, `$ilike`
- Support logical operators: `$or`, `$and`
- Support sorting: `$sort[field]=1|-1`
- Support pagination: `$limit`, `$skip`
- Support nested fields: `due.date`, `metadata.category`
- Update `ListTasksQueryDto` to accept raw query string or parsed query object
- Modify `getTasks()` in storage adapter to handle complex query filters
- Update TasksController to use query parser

**Examples**:
- `?priority[$gte]=3` - priority >= 3
- `?priority[$in]=[1,2]` - priority in [1,2]
- `?$or=[{priority:4},{completed:false}]` - OR conditions
- `?$sort[priority]=-1&$sort[due.date]=1` - multi-field sort
- `?due.date[$gte]=2024-01-01` - nested field query

### 2. Backend: Add MCP Tools for Query/Text Filtering

**Files**:
- `api/src/mcp/tools/ai.tools.ts` (extend existing)
- New: `api/src/mcp/tools/filter.tools.ts`

**Changes**:
- Add `query_tasks` MCP tool that accepts FeathersJS query object
- Add `text_filter_tasks` MCP tool using existing SearchService
- Add `semantic_filter_tasks` MCP tool for vector/semantic search
- Add `build_filter_from_intent` tool that uses AI to convert natural language to query

### 3. Backend: Enhance Semantic/Vector Search

**Files**:
- `api/src/ai/services/search.service.ts` (extend existing)
- New: `api/src/ai/services/vector-search.service.ts` (optional - if true vector embeddings needed)

**Changes**:
- Enhance SearchService to support filter queries
- Add vector search service if embeddings are available
- Support semantic similarity filtering in query system
- Integrate with existing query expansion and fuzzy search

### 4. Backend: Add Filter Information to Chat Response

**File**: `api/src/api/controllers/v1/chat.controller.ts`

**Changes**:
- Modify `list_tasks` tool handler to:
  - Track the filter parameters used (dueToday, highPriority, limit, etc.)
  - Build FeathersJS-style query object
  - Return filter metadata along with tasks
  - Add a new action type `apply_filter` to the actions array with query string
- Update `ChatResponseDto` to include optional `filterQuery` field (FeathersJS query string)
- When `list_tasks` is called, create a query object and convert to query string

### 5. Backend: Fix PERSONAL Task Filtering Issue

**Files**: 
- `api/src/api/controllers/v1/chat.controller.ts` (list_tasks tool)
- `api/src/storage/adapters/kysely.adapter.ts` (getTasks method)

**Changes**:
- Investigate why only PERSONAL tasks are showing
- Check if there's a default projectId filter being applied
- Ensure `getTasks()` without projectId returns all tasks
- Verify chat's `list_tasks` tool doesn't filter by project
- Remove any hardcoded project filters

### 6. Frontend: Handle Filter Actions from Chat

**File**: `web/src/App.tsx`

**Changes**:
- Add state for temporary view/filter
- Listen for `apply_filter` actions from chat responses
- When filter action received:
  - Parse the FeathersJS query string
  - Create a temporary view object with the filter config
  - Switch to this temporary view
  - Store it separately from saved views (so it can be saved later)
- Add `handleChatFilter` callback that processes filter actions
- Pass callback to ChatInput component

### 7. Frontend: Display Active Filter Above Task List

**File**: New `web/src/components/FilterDisplay.tsx`

**Changes**:
- Create a filter display component that shows:
  - Active filter criteria in human-readable format
  - "Save View" button if it's a temporary view
  - Clear/reset filter option
- Position it above the task list
- Show filter in readable format:
  - "Due: Today" or "Due: This Week"
  - "Priority: High (P1-P2)"
  - "Category: Work"
  - "All tasks" if no filters
- Integrate into App.tsx above TaskList

### 8. Frontend: Save Temporary View Functionality

**Files**: 
- `web/src/App.tsx`
- `web/src/api/client.ts`

**Changes**:
- Add "Save View" functionality:
  - When user clicks "Save View", prompt for view name
  - Call API to create a new saved view
  - Convert temporary view to permanent view
  - Refresh views list
- Add `saveTemporaryView` function in App.tsx
- Add `createView` API call in client.ts
- Show modal/prompt for view name
- Update views list after saving

### 9. Frontend: Update Chat Hook to Emit Filter Actions

**File**: `web/src/hooks/useChat.ts`

**Changes**:
- Modify `sendMessage` to:
  - Check response for `filterQuery` or `apply_filter` actions
  - Return filter information that App can use
  - Emit filter events that App can listen to
- Add filter detection in chat response
- Return filter query in response
- Use callback pattern to notify parent

### 10. Frontend: Update ViewSelector to Show Temporary Views

**File**: `web/src/components/ViewSelector.tsx`

**Changes**:
- Display temporary view in the view selector (maybe with different styling)
- Show indicator that it's temporary/unsaved
- Allow switching away from temporary view
- Add temporary view to views list
- Style differently (e.g., italic, different color)
- Show "unsaved" indicator

## Technical Details

### Filter Query Structure

The filter query from chat should use FeathersJS format:
```typescript
{
  priority?: { $gte?: number, $in?: number[] },
  "due.date"?: { $gte?: string, $lte?: string },
  "metadata.category"?: string,
  completed?: boolean,
  $or?: Array<Record<string, any>>,
  $sort?: Record<string, 1 | -1>,
  $limit?: number,
  $skip?: number
}
```

### Temporary View Handling

- Temporary views should have a special slug like `temp-{timestamp}`
- They should not be persisted to the database
- When saved, they become regular views with a user-provided name
- The filter config is stored as a FeathersJS query string

### MCP Tool Integration

The AI will have access to:
- `query_tasks`: Execute structured queries
- `text_filter_tasks`: Text-based search filtering
- `semantic_filter_tasks`: Semantic/vector similarity filtering
- `build_filter_from_intent`: Convert natural language to query

## Testing Considerations

- Test FeathersJS query parsing with various operators
- Test chat listing tasks updates the view
- Test filter display shows correct information
- Test saving temporary view works
- Test switching between views preserves/clears temporary view
- Verify all tasks show (not just PERSONAL)
- Test MCP tools for filtering
- Test semantic search integration
- Test AI filter generation from natural language

