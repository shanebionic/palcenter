# Server Automation

PalCenter provides a single Automation page for scheduled tasks across every
configured Palworld server. Automation is available to view for all signed-in
roles. Only Administrators can create, edit, enable, disable, run, or delete
tasks.

## Broadcast messages

Broadcast Message is the first supported task type. To create one:

1. Open **Automation** and select **New Task**.
2. Select the Palworld server.
3. Select **Broadcast Message**.
4. Enter a task name, player-facing message, schedule, and time zone.
5. Choose whether the task should be enabled immediately.

Use **Run Now** from a task's action menu to test the message without changing
its schedule. The manual execution is recorded in task history, but the
calculated next scheduled run remains unchanged.

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

## Results and troubleshooting

The task table shows the most recent run, next scheduled run, and last result.
A failed task remains available and future scheduled runs continue. Check that:

- the selected Palworld server is online;
- its REST API is reachable from the PalCenter container;
- the stored Palworld administrator password is still valid.

Execution metadata and errors are stored in `history.sqlite`. Broadcast content
is task configuration and is included in authenticated PalCenter backups.

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
