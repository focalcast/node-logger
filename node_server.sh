#!/bin/sh


PORT="3000"
REDIS_PORT="3000"
APP_DIR="."
NODE_APP="node/focalnode.js"
CONFIG_DIR="$APP_DIR"
PID_DIR="processes/node/pid"
PID_FILE="$PID_DIR/watch.pid"
REDIS_PID_FILE="$PID_DIR/redis.pid"
LOG_DIR="processes/node/log"
LOG_FILE="$LOG_DIR/watch.log"
INIT_LOG="$LOG_DIR/init.log"
NODE_PATH="$APP_DIR/node_modules"

###############

# REDHAT chkconfig header

# chkconfig: - 58 74
# description: node-app is the script for starting a node app on boot.
### BEGIN INIT INFO
# Provides: node
# Required-Start:    $network $remote_fs $local_fs
# Required-Stop:     $network $remote_fs $local_fs
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: start and stop node
# Description: Node process for app
### END INIT INFO

###############

USAGE="Usage: $0 {start|stop|restart|status} [--force]"
FORCE_OP=true

pid_file_exists() {
    [ -f "$PID_FILE" ] 
}
redis_pid_exists(){
    [ -f "$REDIS_PID_FILE" ]
}
get_pid() {
    echo "$(cat "$PID_FILE")"
}

get_redis_pid(){
    echo "$(cat "$REDIS_PID_FILE")"
}

is_running() {
    PID=$(get_pid)
    REDIS_PID=$(get_redis_pid)
    ! [ -z "$(ps aux | awk '{print $2}' | grep "^$PID$")"  ]

}
is_redis_running(){
    PID=$(get_redis_pid)
    ! [ -z "$(ps aux | awk '{print $2}' | grep "^$REDIS_PID$")" ]
}

start_it() {
    mkdir -p "$PID_DIR"
    mkdir -p "$LOG_DIR"

    echo "Starting node app ..."
    echo "Application directory = $APP_DIR" > "$INIT_LOG"

    redis-server --port "$REDIS_PORT" 1>"$LOG_DIR/redis.log" 2>&1 &
    echo "Redis server started with pid $!"
    echo $! > "$REDIS_PID_FILE"

    node "$APP_DIR/$NODE_APP"  1>"$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    echo "Node app started with pid $!"
}

stop_process() {
    PID=$(get_pid)
    echo "Killing process $PID"
    kill $PID
    REDIS_PID=$(get_redis_pid)
    echo "Killing redis process $REDIS_PID"
    kill $REDIS_PID
}

stop_redis(){
    if redis_pid_exists
    then
        REDIS_PID=$(get_redis_pid)
        if is_redis_running
        then
        echo "Killing redis process $REDIS_PID"
        kill $REDIS_PID
        fi

    echo rm -f "$REDIS_PID_FILE"
    echo "Removed redis pid file"
    fi

}

remove_pid_file() {
    echo "Removing pid file"
    rm -f "$PID_FILE"
    echo "Removed Node.js pid file"
}

start_app() {
    stop_redis
    echo $PID_FILE
    if pid_file_exists
    then
        if is_running
        then
            PID=$(get_pid)
            echo "Node app already running with pid $PID"
            exit 1
        else
            echo "Node app stopped, but pid file exists"
            if [ $FORCE_OP = true ]
            then
                echo "Forcing start anyways"
                remove_pid_file
                start_it
            fi
        fi
    else
        start_it
    fi
}

stop_app() {
    if redis_pid_exists
    then
        stop_redis
    fi
    if pid_file_exists
    then
        if is_running
        then
            echo "Stopping node app ..."
            stop_process
            remove_pid_file
            echo "Node app stopped"
        else
            echo "Node app already stopped, but pid file exists"
            if [ $FORCE_OP = true ]
            then
                echo "Forcing stop anyways ..."
                remove_pid_file
                echo "Node app stopped"
            else
                exit 0
            fi
        fi
    else
        echo "Node app already stopped mother fucka, pid file does not exist"
    fi
}

status_app() {
    if pid_file_exists
    then
        if is_running
        then
            PID=$(get_pid)
            echo "Node app running with pid $PID"
        else
            echo "Node app stopped, but pid file exists"
        fi
    else
        echo "Node app stopped"
    fi
}

restart_app() {
    if is_redis_running
    then
        stop_redis
    fi
    if pid_file_exists
    then
        stop_app
        start_app
    else
        start_app
    fi
}

case "$2" in
    --force)
        FORCE_OP=true
        ;;

    "")
        ;;

    *)
        echo $USAGE
        exit 1
        ;;
esac

case "$1" in
    start)
        start_app
        ;;

    stop)
        stop_app
        ;;

    restart)
        restart_app
        ;;

    status)
        status_app
        ;;

    *)
        echo $USAGE
        exit 1
        ;;
esac
