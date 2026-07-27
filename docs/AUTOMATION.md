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
its schedule.

## Scheduling

The editor supports friendly schedules for intervals, hourly, daily, weekly,
monthly, and one-time execution. Advanced users can provide a standard
five-field cron expression.

Every task has an IANA time zone, such as `America/New_York` or `UTC`. Daylight
saving changes are handled using the selected time zone.

One-time tasks automatically become disabled after their scheduled execution.

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

Automation data uses the existing `/app/data/history.sqlite` file and survives
container recreation through the standard persistent PalCenter data volume.
