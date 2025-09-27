#!/bin/bash

# PM2 Command Center for spec_workflow_automation
# Usage: ./scripts/remote-automation.sh [command] [options]
# Commands: start, stop, restart, logs, status, list, monitor, save, startup

set -e

# Configuration
PROJECT_DIR="/home/rmondo/repos/cc-task-manager"
APP_NAME="spec-workflow-automation"
ECOSYSTEM_FILE="ecosystem.config.js"

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
    echo -e "${GREEN}PM2 Command Center${NC}"
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  start       - Start the automation process (detached)"
    echo "  stop        - Stop the automation process"
    echo "  restart     - Restart the automation process"
    echo "  logs        - View logs (live tail)"
    echo "  status      - Show process status"
    echo "  list        - List all PM2 processes"
    echo "  monitor     - Open PM2 monitor interface"
    echo "  save        - Save PM2 process list"
    echo "  startup     - Generate startup script"
    echo "  delete      - Remove process from PM2"
    echo "  flush       - Flush all log files"
    echo ""
    echo "Examples:"
    echo "  $0 start              # Start automation in background"
    echo "  $0 logs               # View live logs"
    echo "  $0 status             # Check process status"
    echo "  $0 list               # List all PM2 processes"
}

# Change to project directory
cd "$PROJECT_DIR"

# Get command
COMMAND="${1:-}"

# Handle commands
case "$COMMAND" in
    start)
        print_info "Starting $APP_NAME..."

        # Ensure logs directory exists
        mkdir -p "$PROJECT_DIR/logs"

        # Check if process is already running
        if pm2 describe "$APP_NAME" &>/dev/null; then
            print_warning "Process $APP_NAME is already managed by PM2"
            pm2 reload "$ECOSYSTEM_FILE" --update-env
            print_success "Process reloaded with updated configuration"
        else
            pm2 start "$ECOSYSTEM_FILE"
            print_success "Process started successfully"
        fi

        # Show status
        sleep 2
        pm2 status "$APP_NAME"

        print_info "Process is running in background (SSH disconnect safe)"
        print_info "Use '$0 logs' to view logs"
        ;;

    stop)
        print_info "Stopping $APP_NAME..."
        pm2 stop "$APP_NAME"
        print_success "Process stopped"
        ;;

    restart)
        print_info "Restarting $APP_NAME..."
        pm2 restart "$APP_NAME"
        print_success "Process restarted"
        pm2 status "$APP_NAME"
        ;;

    logs)
        print_info "Showing logs for $APP_NAME (Ctrl+C to exit)..."
        echo ""
        pm2 logs "$APP_NAME" --lines 50
        ;;

    status)
        print_info "Process status for $APP_NAME:"
        pm2 describe "$APP_NAME" || print_error "Process not found"
        echo ""
        pm2 status "$APP_NAME"
        ;;

    list)
        print_info "All PM2 processes:"
        pm2 list
        ;;

    monitor)
        print_info "Opening PM2 monitor (Ctrl+C to exit)..."
        pm2 monit
        ;;

    save)
        print_info "Saving PM2 process list..."
        pm2 save
        print_success "Process list saved"
        print_info "Processes will restart on system reboot if startup script is configured"
        ;;

    startup)
        print_info "Generating PM2 startup script..."
        pm2 startup
        print_warning "Follow the instructions above to enable PM2 on system startup"
        ;;

    delete)
        print_warning "Removing $APP_NAME from PM2..."
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            pm2 delete "$APP_NAME"
            print_success "Process removed from PM2"
        else
            print_info "Operation cancelled"
        fi
        ;;

    flush)
        print_info "Flushing logs for $APP_NAME..."
        pm2 flush "$APP_NAME"
        print_success "Logs flushed"
        ;;

    "")
        # Default behavior - show status and usage
        if pm2 describe "$APP_NAME" &>/dev/null; then
            print_info "Current status:"
            pm2 status "$APP_NAME"
            echo ""
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