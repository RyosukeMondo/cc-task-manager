#!/bin/bash

# PM2 Command Center for spec_workflow_automation
# Usage: ./scripts/remote-automation.sh [command] [options]
# Commands: start, stop, restart, logs, status, list, monitor, save, startup

set -e

# Load unified configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.js"

# Validate configuration file exists
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "❌ Configuration file not found: $CONFIG_FILE"
    exit 1
fi

# Configuration from unified config
PROJECT_DIR="$(node -e "const config = require('$CONFIG_FILE'); console.log(config.baseCwd);")"
APP_PATTERN="spec-workflow-automation-*"
ECOSYSTEM_FILE="$(node -e "const config = require('$CONFIG_FILE'); console.log(config.paths.ecosystemFile);")"

# Project list - from unified config
PROJECTS=($(node "$CONFIG_FILE" projects))

# Expected processes from unified config
EXPECTED_AUTOMATION_PROCESSES=($(node "$CONFIG_FILE" expected-automation))
EXPECTED_DASHBOARD_PROCESSES=($(node "$CONFIG_FILE" expected-dashboard))
ALL_EXPECTED_PROCESSES=($(node "$CONFIG_FILE" all-expected))

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to show usage
show_usage() {
    echo -e "${GREEN}PM2 Command Center for Spec Workflow (Symmetric)${NC}"
    echo "Usage: $0 [command] [app_name] [options]"
    echo "       PROCESS_TYPE=automation|dashboard|both $0 [command] [app_name]"
    echo ""
    echo "Commands (symmetric - affects BOTH automation + dashboard by default):"
    echo "  start [app]     - Start process(es) (detached)"
    echo "  stop [app]      - Stop process(es)"
    echo "  restart [app]   - Restart process(es)"
    echo "  logs [app]      - View logs (live tail, includes both stdout & stderr)"
    echo "  status [app]    - Show process status"
    echo "  list            - List all PM2 processes"
    echo "  monitor         - Open PM2 monitor interface"
    echo "  save            - Save PM2 process list"
    echo "  startup         - Generate startup script"
    echo "  delete [app]    - Remove process(es) from PM2"
    echo "  flush [app]     - Flush log files"
    echo "  cleanup         - Remove orphaned spec-workflow processes"
    echo ""
    echo "Process Type Control (environment variable):"
    echo "  PROCESS_TYPE=automation - Target only automation processes"
    echo "  PROCESS_TYPE=dashboard  - Target only dashboard processes"
    echo "  PROCESS_TYPE=both       - Target both automation + dashboard (default)"
    echo ""
    echo "App names (optional - defaults to all):"
    for project in "${PROJECTS[@]}"; do
        echo "  $project - automation + dashboard for $project"
    done
    echo ""
    echo "Examples:"
    echo "  $0 start                          # Start all automation + dashboard processes"
    echo "  $0 delete                         # Delete all automation + dashboard processes"
    echo "  PROCESS_TYPE=automation $0 start  # Start only automation processes"
    echo "  PROCESS_TYPE=dashboard $0 delete  # Delete only dashboard processes"
    if [[ ${#PROJECTS[@]} -gt 0 ]]; then
        echo "  $0 start ${PROJECTS[0]}                     # Start ${PROJECTS[0]} automation + dashboard"
        echo "  $0 logs ${PROJECTS[0]}                      # View both ${PROJECTS[0]} automation + dashboard logs"
    fi
}

# Change to project directory
cd "$PROJECT_DIR"

# Get command and app name
COMMAND="${1:-}"
APP_NAME="${2:-}"

# Function to validate process name
validate_process_name() {
    local name="$1"
    if [[ -n "$name" && ! "$name" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        print_error "Invalid process name: $name"
        exit 1
    fi
}

# Function to get target processes (symmetric: both automation AND dashboard)
get_target_processes() {
    local process_type="${PROCESS_TYPE:-both}"  # Default to both automation + dashboard

    case "$1" in
        "")
            if [[ "$process_type" == "automation" ]]; then
                echo "${EXPECTED_AUTOMATION_PROCESSES[@]}"
            elif [[ "$process_type" == "dashboard" ]]; then
                echo "${EXPECTED_DASHBOARD_PROCESSES[@]}"
            else
                # Both by default for symmetric commands
                echo "${EXPECTED_AUTOMATION_PROCESSES[@]} ${EXPECTED_DASHBOARD_PROCESSES[@]}"
            fi
            ;;
        *)
            # Validate process name
            validate_process_name "$1"

            # Check if it's a known project name
            for project in "${PROJECTS[@]}"; do
                if [[ "$1" == "$project" ]]; then
                    if [[ "$process_type" == "automation" ]]; then
                        echo "spec-workflow-automation-$project"
                    elif [[ "$process_type" == "dashboard" ]]; then
                        echo "spec-workflow-dashboard-$project"
                    else
                        # Both by default
                        echo "spec-workflow-automation-$project spec-workflow-dashboard-$project"
                    fi
                    return
                fi
            done
            # Otherwise return as-is
            echo "$1"
            ;;
    esac
}

TARGET_PROCESSES=$(get_target_processes "$APP_NAME")

# Function to cleanup orphaned processes
cleanup_orphaned_processes() {
    print_info "Checking for orphaned spec-workflow processes..."

    local orphaned_found=false

    # Get list of all PM2 processes with spec-workflow prefix
    local all_processes=$(pm2 list | grep -E "spec-workflow|claude-code" | awk '{print $4}' | grep -v "│" | grep -v "name" | grep -v "─" | sort | uniq)

    for process in $all_processes; do
        if [[ -n "$process" && "$process" != "name" ]]; then
            local is_expected=false
            for expected in "${ALL_EXPECTED_PROCESSES[@]}"; do
                if [[ "$process" == "$expected" ]]; then
                    is_expected=true
                    break
                fi
            done

            if [[ "$is_expected" == false ]]; then
                print_warning "Found unexpected process: $process"
                read -p "Remove process '$process'? (y/N) " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    pm2 delete "$process" 2>/dev/null || true
                    print_success "Removed process: $process"
                    orphaned_found=true
                fi
            fi
        fi
    done

    if [[ "$orphaned_found" == false ]]; then
        print_success "No orphaned processes found"
    fi
}

# Function to check if PM2 is installed
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        print_error "PM2 is not installed or not in PATH"
        print_info "Install PM2 with: npm install -g pm2"
        exit 1
    fi
}

# Function to ensure logs directory exists
ensure_logs_dir() {
    local logs_dir="$PROJECT_DIR/$(node -e "const config = require('$CONFIG_FILE'); console.log(config.paths.logsDir);")"
    mkdir -p "$logs_dir"
}

# Handle commands
case "$COMMAND" in
    start)
        check_pm2
        print_info "Starting processes: $TARGET_PROCESSES"

        # Auto-cleanup orphaned processes before starting
        cleanup_orphaned_processes
        echo ""

        # Ensure logs directory exists
        ensure_logs_dir

        if [ -n "$APP_NAME" ]; then
            # Start specific process
            for process in $TARGET_PROCESSES; do
                if pm2 describe "$process" &>/dev/null; then
                    print_warning "Process $process is already managed by PM2"
                    pm2 restart "$process"
                    print_success "Process $process restarted"
                else
                    pm2 start "$ECOSYSTEM_FILE" --only "$process"
                    print_success "Process $process started"
                fi
            done
        else
            # Start all processes based on process type
            process_list=$(echo $TARGET_PROCESSES | tr ' ' ',')
            pm2 start "$ECOSYSTEM_FILE" --only "$process_list"

            process_type_desc="automation + dashboard"
            if [[ "${PROCESS_TYPE:-both}" == "automation" ]]; then
                process_type_desc="automation"
            elif [[ "${PROCESS_TYPE:-both}" == "dashboard" ]]; then
                process_type_desc="dashboard"
            fi
            print_success "All $process_type_desc processes started"
        fi

        # Show status
        sleep 2
        for process in $TARGET_PROCESSES; do
            pm2 status "$process" 2>/dev/null || true
        done

        print_info "Processes running in background (SSH disconnect safe)"
        print_info "Use '$0 logs [app]' to view logs"
        ;;

    stop)
        check_pm2
        print_info "Stopping processes: $TARGET_PROCESSES"
        for process in $TARGET_PROCESSES; do
            if pm2 describe "$process" &>/dev/null; then
                pm2 stop "$process"
                print_success "Process $process stopped"
            fi
        done
        ;;

    restart)
        check_pm2
        print_info "Restarting processes: $TARGET_PROCESSES"
        for process in $TARGET_PROCESSES; do
            if pm2 describe "$process" &>/dev/null; then
                pm2 restart "$process"
                print_success "Process $process restarted"
            fi
        done
        for process in $TARGET_PROCESSES; do
            pm2 status "$process" 2>/dev/null || true
        done
        ;;

    logs)
        check_pm2
        if [ -n "$APP_NAME" ]; then
            print_info "Showing logs for $TARGET_PROCESSES (Ctrl+C to exit)..."
            echo ""
            process_list=$(echo $TARGET_PROCESSES | tr ' ' ',')
            # Show both stdout and stderr logs with --err flag
            pm2 logs $process_list --lines 50 --err
        else
            process_type_desc="automation + dashboard"
            if [[ "${PROCESS_TYPE:-both}" == "automation" ]]; then
                process_type_desc="automation"
            elif [[ "${PROCESS_TYPE:-both}" == "dashboard" ]]; then
                process_type_desc="dashboard"
            fi
            print_info "Showing logs for all $process_type_desc processes (Ctrl+C to exit)..."
            echo ""
            process_list=$(echo $TARGET_PROCESSES | tr ' ' ',')
            # Show both stdout and stderr logs with --err flag
            pm2 logs $process_list --lines 50 --err
        fi
        ;;

    status)
        check_pm2
        print_info "Process status for: $TARGET_PROCESSES"
        for process in $TARGET_PROCESSES; do
            echo ""
            pm2 describe "$process" 2>/dev/null || print_error "Process $process not found"
        done
        echo ""
        for process in $TARGET_PROCESSES; do
            pm2 status "$process" 2>/dev/null || true
        done
        ;;

    list)
        check_pm2
        print_info "All PM2 processes:"
        pm2 list
        ;;

    monitor)
        check_pm2
        print_info "Opening PM2 monitor (Ctrl+C to exit)..."
        pm2 monit
        ;;

    save)
        check_pm2
        print_info "Saving PM2 process list..."
        pm2 save
        print_success "Process list saved"
        print_info "Processes will restart on system reboot if startup script is configured"
        ;;

    startup)
        check_pm2
        print_info "Generating PM2 startup script..."
        pm2 startup
        print_warning "Follow the instructions above to enable PM2 on system startup"
        ;;

    delete)
        check_pm2
        print_warning "Removing processes: $TARGET_PROCESSES from PM2..."
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            for process in $TARGET_PROCESSES; do
                if pm2 describe "$process" &>/dev/null; then
                    pm2 delete "$process"
                    print_success "Process $process removed from PM2"
                fi
            done
        else
            print_info "Operation cancelled"
        fi
        ;;

    flush)
        check_pm2
        print_info "Flushing logs for: $TARGET_PROCESSES"
        for process in $TARGET_PROCESSES; do
            if pm2 describe "$process" &>/dev/null; then
                pm2 flush "$process"
                print_success "Logs flushed for $process"
            fi
        done
        ;;

    cleanup)
        check_pm2
        print_info "Manual cleanup of orphaned spec-workflow processes"
        cleanup_orphaned_processes
        echo ""
        print_info "Cleanup complete. Current processes:"
        pm2 list
        ;;

    "")
        # Default behavior - show status and usage
        if command -v pm2 &> /dev/null; then
            any_running=false
            for process in ${ALL_EXPECTED_PROCESSES[@]}; do
                if pm2 describe "$process" &>/dev/null; then
                    any_running=true
                    break
                fi
            done

            if [ "$any_running" = true ]; then
                print_info "Current status (all spec-workflow processes):"
                all_processes=$(echo ${ALL_EXPECTED_PROCESSES[@]} | tr ' ' ',')
                pm2 status $all_processes 2>/dev/null || true
                echo ""
            fi
        fi
        show_usage
        ;;

    *)
        print_error "Unknown command: $COMMAND"
        echo ""
        show_usage
        exit 1
        ;;
esac