# System Architecture

## Overview Diagram

```mermaid
graph TB
    subgraph "Entry Points"
        CLI[CLI Commands]
        MCP[MCP Server]
        Cursor[Cursor/AI Assistant]
    end

    subgraph "Core Services"
        Storage[(Storage Adapter<br/>SQLite/PostgreSQL)]
        Todoist[Todoist Client<br/>API Wrapper]
        Sync[Sync Engine<br/>Background Sync]
        AIAgent[AI Agent<br/>Claude SDK]
    end

    subgraph "AI Components"
        Enrichment[Task Enrichment<br/>Classification]
        AIOperations[AI Operations<br/>Prioritize/Estimate]
        Learning[Learning System<br/>History Analysis]
        TaskProcessor[Task Processor Agent<br/>Agentic Text Processing]
    end

    subgraph "External Services"
        TodoistAPI[Todoist API]
        ClaudeAPI[Claude API<br/>Anthropic]
    end

    CLI --> Storage
    CLI --> Todoist
    CLI --> Sync
    CLI --> AIAgent
    CLI --> Enrichment
    CLI --> AIOperations
    CLI --> TaskProcessor

    MCP --> Storage
    MCP --> Todoist
    MCP --> Sync
    MCP --> Enrichment
    MCP --> AIOperations
    MCP --> TaskProcessor

    Cursor --> MCP

    TaskProcessor --> AIAgent
    TaskProcessor -.uses tools.-> Storage
    TaskProcessor -.uses tools.-> Todoist
    TaskProcessor -.uses tools.-> Sync

    Enrichment --> AIAgent
    AIOperations --> AIAgent
    Learning --> Storage

    Sync --> Todoist
    Sync --> Storage
    Sync --> Enrichment

    Todoist --> TodoistAPI
    AIAgent --> ClaudeAPI

    Storage -.persists to.-> DB[(Database<br/>tasks.db)]

    style TaskProcessor fill:#f9f,stroke:#333,stroke-width:4px
    style MCP fill:#bbf,stroke:#333,stroke-width:2px
    style CLI fill:#bfb,stroke:#333,stroke-width:2px
```

## CLI Command Architecture

```mermaid
graph LR
    subgraph "Task Management"
        sync[sync]
        list[list]
        inbox[inbox]
        complete[complete]
        completed[completed]
    end

    subgraph "AI Operations"
        classify[classify]
        prioritize[prioritize]
        plan[plan]
        search[search]
        breakdown[breakdown]
    end

    subgraph "Analytics"
        productivity[productivity]
        stats[stats]
        insights[insights]
    end

    subgraph "Meta Commands"
        processText[process-text]
        models[models]
    end

    sync --> SyncEngine
    list --> Storage
    inbox --> Storage
    complete --> |fuzzy search| Storage
    complete --> SyncEngine
    completed --> Storage
    productivity --> Storage

    classify --> Enrichment
    prioritize --> AIOperations
    plan --> AIOperations
    search --> AIOperations
    breakdown --> AIOperations

    stats --> Enrichment
    insights --> AIOperations

    processText --> TaskProcessor
    models --> AIAgent

    TaskProcessor -.agentic flow.-> |creates/updates/completes| SyncEngine
```

## MCP Tools Architecture

```mermaid
graph TB
    subgraph "Cursor Integration"
        CursorChat[Cursor Chat]
        CursorAgent[AI Assistant]
    end

    subgraph "MCP Server Tools"
        direction TB
        
        subgraph "Task Tools"
            t1[list_todoist_tasks]
            t2[get_todoist_task]
            t3[sync_todoist]
            t4[update_task]
            t5[complete_task]
            t6[complete_task_by_search]
        end

        subgraph "AI Tools"
            a1[ai_classify_tasks]
            a2[ai_prioritize]
            a3[ai_estimate_time]
            a4[ai_daily_plan]
            a5[ai_breakdown_task]
            a6[ai_search_tasks]
        end

        subgraph "Analytics Tools"
            s1[get_task_history]
            s2[get_recently_completed]
            s3[get_productivity_stats]
            s4[get_insights]
            s5[get_stats]
        end

        subgraph "Meta Tools"
            m1[process_text_agent]
        end
    end

    subgraph "Backend"
        Services[Core Services]
        TaskProcessorAgent[Task Processor Agent<br/>Agentic AI]
    end

    CursorChat --> CursorAgent
    CursorAgent --> |MCP protocol| MCP

    t1 & t2 & t3 & t4 & t5 & t6 --> Services
    a1 & a2 & a3 & a4 & a5 & a6 --> Services
    s1 & s2 & s3 & s4 & s5 --> Services
    m1 --> TaskProcessorAgent

    TaskProcessorAgent -.recursive tool use.-> t1 & t2 & t3 & t4 & t5

    style m1 fill:#f9f,stroke:#333,stroke-width:4px
    style TaskProcessorAgent fill:#f9f,stroke:#333,stroke-width:4px
```

## Task Processor Agent Flow (NEW!)

```mermaid
sequenceDiagram
    participant User
    participant CLI/MCP
    participant TaskProcessor
    participant Claude
    participant Tools

    User->>CLI/MCP: Paste task list or<br/>natural language
    CLI/MCP->>TaskProcessor: processText(rawInput)
    
    TaskProcessor->>Claude: System prompt +<br/>user input +<br/>available tools
    
    loop Agentic Reasoning (max 5 turns)
        Claude->>Claude: Analyze intent
        Claude->>Tools: search_tasks("vendor")
        Tools-->>Claude: [existing tasks]
        
        Claude->>Claude: Check for duplicates
        
        alt New task needed
            Claude->>Tools: create_task(content)
            Tools-->>Claude: {success, taskId}
        else Task exists
            Claude->>Tools: update_task(taskId, updates)
            Tools-->>Claude: {success}
        end
        
        Claude->>Claude: Plan next action
    end
    
    Claude-->>TaskProcessor: Final response text
    TaskProcessor-->>CLI/MCP: {success, message, turns}
    CLI/MCP-->>User: "Created 3 tasks,<br/>updated 1 existing"
```

## Data Flow: Sync & Enrichment

```mermaid
graph TD
    Start([Sync Triggered])
    Start --> FetchAPI[Fetch from Todoist API<br/>with pagination]
    FetchAPI --> DetectChanges[Detect New/Changed Tasks<br/>via content_hash]
    DetectChanges --> SaveDB[(Save to Database)]
    
    DetectChanges --> |new/changed tasks| EnrichQueue[Enrichment Queue]
    EnrichQueue --> ClassifyBatch[Batch Classify with AI<br/>10 tasks at a time]
    ClassifyBatch --> SaveMetadata[(Save AI Metadata)]
    SaveMetadata --> SaveHistory[(Save to History)]
    
    SaveDB --> Complete([Sync Complete])
    SaveHistory --> Complete

    style EnrichQueue fill:#ff9,stroke:#333,stroke-width:2px
    style ClassifyBatch fill:#f96,stroke:#333,stroke-width:2px
```

## Storage Layer

```mermaid
graph LR
    subgraph "Storage Interface"
        IStorage[IStorageAdapter<br/>Abstract Interface]
    end

    subgraph "Implementations"
        SQLite[SQLite Adapter<br/>Local Development]
        Postgres[PostgreSQL Adapter<br/>Cloud Deployment]
    end

    subgraph "Tables"
        Tasks[(tasks)]
        TaskMeta[(task_metadata)]
        TaskHistory[(task_history)]
        Projects[(projects)]
        Labels[(labels)]
    end

    IStorage --> SQLite
    IStorage --> Postgres

    SQLite --> Tasks
    SQLite --> TaskMeta
    SQLite --> TaskHistory
    SQLite --> Projects
    SQLite --> Labels

    Postgres --> Tasks
    Postgres --> TaskMeta
    Postgres --> TaskHistory
    Postgres --> Projects
    Postgres --> Labels

    Factory[Storage Factory] -.creates.-> SQLite
    Factory -.creates.-> Postgres

    style Factory fill:#9cf,stroke:#333,stroke-width:2px
```

## Component Responsibilities

| Component | Responsibility | Key Methods |
|-----------|---------------|-------------|
| **CLI** | User interface, command parsing | All `program.command()` definitions |
| **MCP Server** | Tool exposure for AI assistants | `ListToolsRequestSchema`, `CallToolRequestSchema` |
| **Storage Adapter** | Database abstraction | `getTasks()`, `saveTasks()`, `updateTask()` |
| **Todoist Client** | API communication | `getTasks()`, `createTask()`, `closeTask()` |
| **Sync Engine** | Background sync, change detection | `syncNow()`, `completeTask()` |
| **AI Agent** | Claude SDK wrapper | `query()`, streaming |
| **Task Enrichment** | AI classification | `classifyTask()`, batch processing |
| **AI Operations** | High-level AI ops | `prioritizeTasks()`, `generateInsights()` |
| **Task Processor** | Agentic text processing (NEW!) | `processText()`, tool execution |

## Key Features by Layer

### Entry Layer (CLI/MCP)
- ✅ 20+ CLI commands
- ✅ 15+ MCP tools
- ✅ Fuzzy search completion
- ✅ Natural language processing via Task Processor Agent

### Service Layer
- ✅ Cloud-ready storage abstraction
- ✅ Todoist pagination (359 tasks)
- ✅ Background sync with change detection
- ✅ Content hashing for cost optimization

### AI Layer
- ✅ Batch classification (10 tasks/batch)
- ✅ Prioritization with reasoning
- ✅ Time estimation learning
- ✅ Agentic task processor with tool use

### Data Layer
- ✅ SQLite for local development
- ✅ PostgreSQL ready for cloud
- ✅ Task history for learning
- ✅ Metadata enrichment

## Request Flow Examples

### Example 1: CLI Task Completion
```
User: pnpm run cli complete "vendor" --time 15
  ↓
CLI: Parse args, init services
  ↓
Storage: Fuzzy search "vendor" → 1 match
  ↓
Sync: completeTask(taskId, {actualDuration: 15})
  ↓
Todoist API: closeTask(taskId)
  ↓
Storage: saveTaskCompletion(taskId, metadata)
  ↓
CLI: Display "✅ Task completed"
```

### Example 2: MCP Tool Call
```
Cursor: "Complete the vendor task"
  ↓
MCP Server: complete_task_by_search({searchTerm: "vendor"})
  ↓
Storage: Search & find task
  ↓
Sync: completeTask(taskId)
  ↓
MCP: Return {success: true, taskContent: "..."}
  ↓
Cursor: Shows response to user
```

### Example 3: Agentic Text Processing (NEW!)
```
User: Paste "- buy groceries\n- fix sink\n- email John"
  ↓
CLI: process-text command
  ↓
Task Processor Agent: processText(rawInput)
  ↓
Claude: Receives system prompt + tools
  ↓
Claude: search_tasks("groceries") → none found
  ↓
Claude: create_task({content: "buy groceries"})
  ↓
Claude: search_tasks("sink") → found "repair kitchen sink"
  ↓
Claude: Ask user: "Update existing 'repair kitchen sink' or create new?"
  ↓
[continues agentic loop until done]
  ↓
Task Processor: Returns conversational summary
  ↓
CLI: Display result
```

## Technology Stack

- **Runtime**: Node.js v22+
- **Package Manager**: pnpm
- **AI**: Claude (Anthropic) - Haiku 3/3.5, Sonnet 3.5
- **Database**: SQLite (local), PostgreSQL (cloud)
- **Task Service**: Todoist API v2
- **Integration**: MCP (Model Context Protocol)
- **CLI Framework**: Commander.js

## Deployment Targets

| Environment | Storage | Sync | AI | Access |
|-------------|---------|------|-----|--------|
| **Local Dev** | SQLite | Manual/Interval | Claude API | CLI + MCP |
| **Cloud (GCP)** | Cloud SQL (Postgres) | Cloud Scheduler | Claude API | MCP Server |
| **Cursor** | Remote MCP | On-demand | Claude API | Chat Interface |

---

**Key Insight**: The system is designed as a **layered architecture** where:
1. **Entry points** (CLI/MCP) are thin wrappers
2. **Services** handle business logic
3. **AI components** are composable and tool-enabled
4. **Storage** is abstracted for cloud deployment
5. **Task Processor Agent** provides agentic capabilities via recursive tool use

