# Server Automation

PalCenter provides a single Automation page for scheduled tasks across every
configured Palworld server. Automation is available to view for all signed-in
roles. Only Administrators can create, edit, enable, disable, run, or delete
tasks.

## Supported server operations

PalCenter supports exactly three automation task types:

- **Broadcast Message** sends a required player-facing message of up to 500
  characters.
- **Save World** asks Palworld to save the current world state and has no
  task-specific settings.
- **Graceful Shutdown** sends the official Palworld shutdown request. Configure
  an integer wait time from 0 through 86,400 seconds and an optional
  player-facing message of up to 500 characters.

To create a task:

1. Open **Automation** and select **New Task**.
2. Select the Palworld server.
3. Select the server operation.
4. Enter a task name, its operation-specific settings, schedule, and time zone.
5. Choose whether the task should be enabled immediately.

Use **Run Now** from a task's action menu to execute it without changing its
schedule. The manual execution is recorded in task history, but the calculated
next scheduled run remains unchanged. Graceful Shutdown requires confirmation
because players may be disconnected; the confirmation shows the wait time and
optional message.

Graceful Shutdown is not a restart command. Palworld does not currently expose
an official restart REST operation. A compatible process or container restart
policy, such as Docker `restart: unless-stopped`, may start the server process
again after shutdown, but that behavior belongs to the deployment and is not
controlled by PalCenter or the Palworld REST API.

## Scheduling

The editor supports friendly schedules for intervals, hourly, daily, weekly,
monthly, and one-time execution. Advanced users can provide a standard
five-field cron expression.

**Every N minutes** schedules are aligned to the wall clock instead of the time
when the task was created. Configure:

- **Interval (minutes)** for the time between executions.
- **Start minute** for the alignment phase. It must be between `0` and one less
  than the interval.

For example, an interval of `30` with start minute `0` runs at `:00` and `:30`.
The same interval with start minute `15` runs at `:15` and `:45`. An interval
of `15` with start minute `5` runs at `:05`, `:20`, `:35`, and `:50`.

The editor shows a live description and the next calculated execution in the
selected time zone. Editing an enabled task recalculates its next run
immediately.

Every task has an IANA time zone, such as `America/New_York` or `UTC`. Daylight
saving changes are handled using the selected time zone.

One-time tasks automatically become disabled after their scheduled execution.

### Missed runs and restarts

PalCenter does not replay every occurrence missed while it was stopped. When
PalCenter starts, the scheduler immediately checks for overdue tasks. An
overdue task runs once as soon as possible, and its next run is then calculated
from the current time. Earlier missed occurrences are skipped.

For example, if a daily 8:00 PM task is overdue when PalCenter starts at
9:30 PM, it runs once after startup and is next scheduled for 8:00 PM the
following day. An overdue one-time task also runs once and is then disabled.

### Existing interval tasks

Interval tasks created before wall-clock alignment do not require a database
migration or manual edit. Their existing calculated next run is preserved.
When that execution finishes, future runs align with start minute `0`. Editing,
disabling and re-enabling, or otherwise saving a legacy task also persists
start minute `0` and immediately recalculates the next aligned run.

Broadcast tasks created before Save World and Graceful Shutdown support remain
compatible without a database migration. Task types and configuration use the
existing generic SQLite columns. Backups already contain `history.sqlite`, so
all supported tasks and their execution records survive backup, restore, and
container recreation.

## Results and troubleshooting

The task table shows the most recent run, next scheduled run, and last result.
Select **View History** for newest-first details about each execution, including
the task and server, manual or scheduled trigger, start and finish times,
duration, result, safe action summary, and error details. An overdue execution
performed after PalCenter starts is reported as **Scheduled** because the
scheduler intentionally uses the same execution path and does not persist a
separate overdue trigger.

When an execution starts, PalCenter stores an immutable, credential-free
snapshot of the task name, task type, target server ID and display name, and
safe action summary. Later edits to the task or server therefore do not rewrite
what an older history entry reports.

Existing `history.sqlite` databases are upgraded automatically from schema
version 2 to version 3 by adding a nullable execution snapshot column. Existing
execution rows are retained. Rows created before snapshots are identified as
legacy in the history drawer; their descriptive metadata may use the task's
current settings and is not presented as guaranteed historical fact. Every new
manual, scheduled, successful, or failed execution stores a snapshot.

A failed recurring task remains enabled and future scheduled runs continue.
One-time tasks retain their normal automatic-disable behavior after execution.
Check that:

- the selected Palworld server is online;
- its REST API is reachable from the PalCenter container;
- the stored Palworld administrator password is still valid.

Execution metadata and errors are stored in `history.sqlite`. Task
configuration is included in authenticated PalCenter backups.

Deleting a task also deletes its execution history. This is intentional: the
history belongs to that task and the Automation UI warns before deletion.

## Operations

The scheduler checks for due work every 15 seconds by default. Operators can
change this with `AUTOMATION_INTERVAL_SECONDS`; values below 5 seconds are
rejected. PalCenter should remain running for scheduled tasks to execute.

The scheduler uses one periodic polling loop rather than creating a timer for
every task. A task ID is marked as running for the full execution, so the same
task cannot overlap with itself. Tasks that are due in the same polling cycle
may execute concurrently with one another.

Automation data uses the existing `/app/data/history.sqlite` file and survives
container recreation through the standard persistent PalCenter data volume.
