# N-Level Workflow Engine Implementation Guide

This document provides a detailed technical breakdown of how the n-level workflow engine is implemented in the Enterprise Planner system.

## 1. Core Concept
The workflow engine is a dynamic state machine that allows any entity (Demand, Change Request, Leave, etc.) to pass through multiple levels of approval before reaching a final state. The "N-level" capability is achieved by defining a sequence of steps that the system follows linearly.

---

## 2. Database Schema (Tables & Usage)

The engine relies on four primary tables in the Prisma schema:

### A. `WorkflowTemplate`
*   **Purpose**: Defines the configuration blueprint for a specific module.
*   **Usage**: 
    *   `module`: Identifies which part of the system uses this template (e.g., `DEMAND`, `CR`).
    *   `isActive`: Allows enabling/disabling the workflow without deleting it.
    *   *One template contains many steps.*

### B. `WorkflowStep`
*   **Purpose**: Defines the individual "Levels" of approval.
*   **Usage**:
    *   `stepOrder`: The sequence number (1, 2, 3... N). This is the key to n-level functionality.
    *   `approverType`: Can be `ROLE` (e.g., PM), `USER` (specific person), or `REPORTING_AUTHORITY` (the requester's manager).
    *   `approverRoleId`/`approverUserId`: Specifies the target approver.
    *   `escalateAfterHours`: Optional timeout for auto-escalation.

### C. `WorkflowInstance`
*   **Purpose**: Tracks the progress of a live approval request.
*   **Usage**:
    *   `entityType`/`entityId`: Links to the actual record (e.g., Demand #452).
    *   `currentStep`: A pointer to the active `stepOrder` in the template.
    *   `status`: The overall state (`PENDING`, `APPROVED`, `REJECTED`).
    *   `requesterId`: The user who submitted the request.

### D. `WorkflowActionLog`
*   **Purpose**: The audit trail for every action taken during the workflow.
*   **Usage**:
    *   `actorId`: The user who took the action.
    *   `action`: What was done (`APPROVE`, `REJECT`, `SEND_BACK`, `DELEGATE`).
    *   `remarks`: Comments/reasons provided by the actor.

---

## 3. Workflow Lifecycle Logic

### Step 1: Initialization
When a user submits a record (e.g., a Change Request):
1.  The system finds the active `WorkflowTemplate` for the `CR` module.
2.  A `WorkflowInstance` is created with `currentStep = 1`.
3.  The system notifies the approver(s) defined in the first `WorkflowStep`.

### Step 2: The Approval Loop (N-Levels)
When an approver takes an action:
1.  **If ACTION = APPROVE**:
    *   The system checks if a step exists with `stepOrder = currentStep + 1`.
    *   **If YES**: The `currentStep` is updated, and the next level of approvers is notified.
    *   **If NO**: This was the final level. The `WorkflowInstance` is marked as `APPROVED`.
2.  **If ACTION = REJECT**:
    *   The `WorkflowInstance` is immediately marked as `REJECTED`. The process terminates.
3.  **If ACTION = SEND_BACK**:
    *   The `currentStep` is reset (usually to level 1) to allow the requester to modify and resubmit.

### Step 3: Completion & Integration
Once the `WorkflowInstance` reaches a terminal status (`APPROVED` or `REJECTED`):
1.  An internal event is emitted (e.g., `workflow.approved`).
2.  The original module (e.g., Demands) listens for this event and updates the main record's status (e.g., marks the Demand as "Approved").

---

## 4. Key Advantages
*   **Flexibility**: You can add a 5th or 6th level of approval just by adding rows to `WorkflowStep`, without changing any backend code.
*   **Auditability**: Every step, comment, and actor is recorded in the `ActionLog`.
*   **Agility**: The `REPORTING_AUTHORITY` type allows the workflow to dynamically adapt based on who the requester is.
