#!/usr/bin/env pwsh
<#
.SYNOPSIS
    PalCenter Roadmap Projects v2 helper. Manage issue items on the PalCenter Roadmap board.

.DESCRIPTION
    Dynamically discovers the project ID, field IDs, and single-select option IDs at runtime.
    Avoids hard-coding any internal identifiers.  Every write is followed by a read-back
    verification step that fails clearly if the desired state was not achieved.

.PARAMETER Issue
    GitHub issue number to operate on.

.PARAMETER Action
    'Get' - retrieve current Roadmap project item state for this issue.
    'Add' - add the issue to PalCenter Roadmap (noop if already present).

.PARAMETER Field
    Field name to update when used together with -Value.
    Supported values: Status, Priority.

.PARAMETER Value
    New value for the specified field.  The helper resolves this human-readable
    label into the correct internal option ID at runtime.

.EXAMPLE
    .\scripts\roadmap-helper.ps1 -Issue 166 -Action Get
    .\scripts\roadmap-helper.ps1 -Issue 166 -Action Add
    .\scripts\roadmap-helper.ps1 -Issue 166 -Field Status -Value Done
    .\scripts\roadmap-helper.ps1 -Issue 166 -Field Priority -Value P2
#>

param(
    [Parameter(Mandatory = $true)]
    [int]$Issue,

    [ValidateSet('Get', 'Add')]
    [string]$Action,

    [ValidateSet('Status', 'Priority')]
    [string]$Field,

    [string]$Value
)

$ErrorActionPreference = 'Stop'

# Script-level caching
$script:_projectId = $null
$script:_fieldConfig = $null

function Fail($msg) {
    Write-Error "roadmap-helper: $msg"
    exit 1
}

function GraphQl([string]$query) {
    try {
        $raw = gh api graphql -F "query=$query" 2>&1
    } catch {
        Fail $_.Exception.Message
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "DEBUG: $query"
        Fail "gh api returned non-zero exit code: $raw"
    }

    $obj = $null
    try { $obj = $raw | ConvertFrom-Json } catch { Fail "JSON parse failed: $_" }
    if ($obj.errors) {
        $msgs = ($obj.errors | ForEach-Object { $_.message }) -join '; '
        Fail "GraphQL error(s): $msgs"
    }
    return $obj
}

function IssueNodeId {
    [Convert]::ToBase64String(
        [System.Text.Encoding]::UTF8.GetBytes("Issue:$Issue"))
}

#------------------------------------------------------------
# Discovery - find the PalCenter Roadmap project by title
#------------------------------------------------------------

function DiscoverProjectId {
    if ($script:_projectId) { return $script:_projectId }

    # query{ repository(owner:"shanebionic",name:"palcenter"){ projectsV2(first:10){ nodes{ id number title }}} }
    $q = 'query{repository(owner:"shanebionic",name:"palcenter"){projectsV2(first:10){nodes{id number title}}}}'
    $r = GraphQl $q

    $node = ($r.data.repository.projectsV2.nodes) | Where-Object title -eq 'PalCenter Roadmap'
    if (-not $node) { Fail "Could not find PalCenter Roadmap project." }

    $script:_projectId = $node.id
    return $node.id
}

#------------------------------------------------------------
# Discovery - find field IDs and single-select option values
#------------------------------------------------------------

function DiscoverFieldConfig {
    if ($script:_fieldConfig) { return $script:_fieldConfig }

    $projectId = DiscoverProjectId

    # Build query with inlined project ID - variables don't work with gh api + anonymous query
    $q = "query{node(id:`"$projectId`"){__typename ... on ProjectV2{id title fields(first:50){nodes{... on ProjectV2SingleSelectField{id name options{id name color}} ... on ProjectV2IterationField{id name}}}}}}"

    $r = GraphQl $q
    if (-not $r.data.node) { Fail "Could not fetch project node." }

    # Parse field tree. Skip null/empty names gracefully.
    $script:_fieldConfig = @{}
    foreach ($n in $r.data.node.fields.nodes) {
        if (-not $n.name) { continue }
        if ($n.options) {
            $opts = @{}
            foreach ($o in $n.options) {
                if ($o.name) { $opts[$o.name] = @{ id = $o.id; name = $o.name } }
            }
            $script:_fieldConfig[$n.name] = @{ id = $n.id; type = 'SingleSelect'; options = $opts }
        } else {
            if (-not ($script:_fieldConfig.ContainsKey($n.name))) {
                $script:_fieldConfig[$n.name] = @{ id = $n.id; type = 'Other' }
            }
        }
    }

    if (-not $script:_fieldConfig.ContainsKey('Status')) { Fail "Required field 'Status' not found on project." }
    if (-not $script:_fieldConfig['Status']) { Fail "'Status' config is null." }
    if ($script:_fieldConfig['Status'].type -ne 'SingleSelect') { Fail "'Status' is not a SingleSelect field." }

    if (-not $script:_fieldConfig.ContainsKey('Priority')) { Fail "Required field 'Priority' not found on project." }
    if (-not $script:_fieldConfig['Priority']) { Fail "'Priority' config is null." }
    if ($script:_fieldConfig['Priority'].type -ne 'SingleSelect') { Fail "'Priority' is not a SingleSelect field." }

    return $script:_fieldConfig
}

#------------------------------------------------------------
# Issue - Project item mapping - search items by GitHub issue number
#------------------------------------------------------------

function FindProjectItemId {
    param([string]$projectId, [int]$issueNum)

    # This query fetches all project items and checks each content's issue number
    $q = "query{node(id:`"$projectId`"){__typename ... on ProjectV2{id title items(first:100){nodes{id content{__typename ... on Issue{id number} ... on DraftIssue{id title}}}}}}}"

    $r = GraphQl $q

    foreach ($item in $r.data.node.items.nodes) {
        if ($item.content.number -eq $issueNum) { return $item.id }
    }
    return $null
}

#------------------------------------------------------------
# Read field values for a project item
#------------------------------------------------------------

function ReadFieldValues {
    param([string]$projectId, [string]$itemId)

        # Fetch items and their single-select field values in one query.
    # We avoid the problematic projectField union by selecting only
    # optionId on ProjectV2ItemFieldSingleSelectValue nodes.
    $q = "query{node(id:`"$projectId`"){__typename ... on ProjectV2{id title items(first:100){nodes{id fieldValues(first:50){nodes{... on ProjectV2ItemFieldSingleSelectValue{name optionId}}}}}}}}"

    $r = GraphQl $q

    # Build a reverse lookup: optionId -> (fieldConfig entry) using cached config
    $config = DiscoverFieldConfig
    $optionToField = @{}
    foreach ($fcName in $config.Keys) {
        $fcEntry = $config[$fcName]
        if ($fcEntry.type -eq 'SingleSelect') {
            foreach ($optName in $fcEntry.options.Keys) {
                $optId = $fcEntry.options[$optName].id
                $optionToField[$optId] = @{ fieldName = $fcName; optionName = $optName }
            }
        }
    }

    foreach ($item in $r.data.node.items.nodes) {
        if ($item.id -eq $itemId) {
            $map = @{}
            foreach ($fv in $item.fieldValues.nodes) {
                if (-not $fv.optionId) { continue }

                if ($optionToField.ContainsKey($fv.optionId)) {
                    $entry = $optionToField[$fv.optionId]
                    $map[$entry.fieldName] = $entry.optionName
                } elseif ($fv.name) {
                    # Fallback: unknown field, use the display name we got
                    # We can't determine which field this belongs to without
                    # the projectField union, so skip if unresolvable.
                    continue
                }
            }
            return $map
        }
    }
    return @{}
}

#------------------------------------------------------------
# Mutation: Set a single-select field value and verify read-back
#------------------------------------------------------------

function SetSingleSelectValue {
    param(
        [string]$projectId,
        [string]$itemId,
        [string]$fieldId,
        [string]$optionId,
        [string]$fieldName,
        [string]$optionName
    )

    # Inline all IDs directly into the mutation string - avoids variable passing issues with gh api
    $mut = "mutation{updateProjectV2ItemField(input:{projectId:`"$projectId`" itemId:`"$itemId`" fieldId:`"$fieldId`" value:{singleSelectOptionId:`"$optionId`"}}){clientMutationId}}"

    GraphQl $mut | Out-Null

    # Verify read-back
    Start-Sleep -Seconds 1
    $values = ReadFieldValues -projectId $projectId -itemId $itemId
    $actual = if ($values.ContainsKey($fieldName)) { $values[$fieldName] } else { '<missing>' }
    if ($actual -ne $optionName) {
        Fail "Verification failed for '$fieldName': expected '$optionName' but got '$actual'."
    }

    Write-Host "$Field set to $optionName on issue #$Issue (verified)."
}

#------------------------------------------------------------
# Mutation: Add an issue to the roadmap project, then verify read-back
#------------------------------------------------------------

function AddToRoadmapProject {
    param([string]$projectId, [int]$issueNum)

    $nodeRef = IssueNodeId
    $mut = "mutation{addProjectV2ItemById(input:{projectId:`"$projectId`" contentId:`"$nodeRef`"}){item{id}}}"

    $result = GraphQl $mut
    $addedItemId = $result.data.addProjectV2ItemById.item.id
    Write-Host "Added issue #$issueNum to PalCenter Roadmap (item: $addedItemId)."

    Start-Sleep -Seconds 1
    $newId = FindProjectItemId -projectId $projectId -issueNum $issueNum
    if (-not $newId) { Fail "Post-add verification failed for issue #$issueNum." }
}

#------------------------------------------------------------
# GitHub REST issue state lookup via gh cli
#------------------------------------------------------------

function Get-IssueRestState {
    try {
        return (gh api "repos/shanebionic/palcenter/issues/$Issue" | ConvertFrom-Json)
    } catch { Write-Warning "Could not fetch issue metadata for #$Issue." ; return $null }
}

#------------------------------------------------------------
# Entry point - validate params and dispatch
#------------------------------------------------------------

if (-not ($Action -or $Field)) {
    Fail "No action specified. Use '-Action Get', '-Action Add', or '-Field <Status|Priority> -Value <value>'."
}

Write-Host "---"
Write-Host "Discovering PalCenter Roadmap..."
$projectId = DiscoverProjectId
Write-Host "Project ID: $projectId"

$fields = DiscoverFieldConfig
Write-Host "---"

if ($Action -eq 'Get') {
    if ($Field) { Fail "-Field cannot be used with -Action Get." }

    $itemId = FindProjectItemId -projectId $projectId -issueNum $Issue
    if (-not $itemId) {
        Write-Host "Issue #$Issue is NOT on PalCenter Roadmap."
        $rest = Get-IssueRestState
        if ($rest) { Write-Host "GitHub Issue State: $($rest.state)" }
        exit 0
    }

    $fv   = ReadFieldValues -projectId $projectId -itemId $itemId
    $rest = Get-IssueRestState

    Write-Host "Issue #$Issue - PalCenter Roadmap status:"
    Write-Host "  Project Item ID : $itemId"
    if ($fv.ContainsKey('Status'))    { Write-Host "  Status        : $($fv['Status'])" } else { Write-Host '  Status        : (not set)' }
    if ($fv.ContainsKey('Priority'))  { Write-Host "  Priority      : $($fv['Priority'])" } else { Write-Host '  Priority      : (not set)' }
    if ($rest) {
        Write-Host "  GitHub State  : $($rest.state)"
        Write-Host "  Created At    : $($rest.created_at)"
    }

} elseif ($Action -eq 'Add') {
    if ($Field) { Fail "-Field cannot be used with -Action Add." }

    $existing = FindProjectItemId -projectId $projectId -issueNum $Issue
    if ($existing) {
        Write-Host "Issue #$Issue is already on PalCenter Roadmap (item: $existing). No action taken."
    } else {
        AddToRoadmapProject -projectId $projectId -issueNum $Issue
    }

} elseif ($Field) {
    if (-not $fields.ContainsKey($Field)) { Fail "Unknown field '$Field'." }
    $fieldConfig = $fields[$Field]
    if (-not $Value) { Fail "-Value is required when using -Field." }

    if (-not $fieldConfig.options.ContainsKey($Value)) {
        $valid = ($fieldConfig.options.Keys -join ', ')
        Fail "Invalid value '$Value' for field '$Field'. Valid options: $valid"
    }

    $itemId = FindProjectItemId -projectId $projectId -issueNum $Issue
    if (-not $itemId) { Fail "Issue #$Issue is not on the PalCenter Roadmap. Add it first with '-Action Add'." }

    SetSingleSelectValue `
        -projectId  $projectId `
        -itemId     $itemId `
        -fieldId    $fieldConfig.id `
        -optionId   $fieldConfig.options[$Value].id `
        -fieldName  $Field `
        -optionName $Value

} else {
    Fail "No valid action specified."
}
