#include "utils/watchdog.h"
#include "viz.h"
#include <pthread.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

typedef struct watchdog_cfg {
    unsigned int timeout_us;
    char *thread_name;
    char *timeout_node_id;
    int exit_code;
} watchdog_cfg_t;

static char *watchdog_strdup_local(const char *text)
{
    size_t len;
    char *copy;

    if (text == NULL) {
        return NULL;
    }

    len = strlen(text) + 1;
    copy = (char *)malloc(len);
    if (copy == NULL) {
        return NULL;
    }

    memcpy(copy, text, len);
    return copy;
}

static void* watchdog_runner(void *arg)
{
    watchdog_cfg_t *cfg = (watchdog_cfg_t *)arg;

    if (cfg->thread_name != NULL) {
        viz_thread_register(cfg->thread_name);
    }
    usleep(cfg->timeout_us);
    VIZ(cfg->timeout_node_id != NULL ? cfg->timeout_node_id : "watchdog_timeout");
    _exit(cfg->exit_code);
}

int watchdog_start_exit_after_us(unsigned int timeout_us,
                                 const char *thread_name,
                                 const char *timeout_node_id,
                                 int exit_code)
{
    pthread_t thread;
    watchdog_cfg_t *cfg = (watchdog_cfg_t *)calloc(1, sizeof(*cfg));

    if (cfg == NULL) {
        return -1;
    }

    cfg->timeout_us = timeout_us;
    cfg->thread_name = watchdog_strdup_local(thread_name != NULL ? thread_name : "watchdog");
    cfg->timeout_node_id = watchdog_strdup_local(timeout_node_id != NULL ? timeout_node_id : "watchdog_timeout");
    cfg->exit_code = exit_code;

    if (pthread_create(&thread, NULL, watchdog_runner, cfg) != 0) {
        free(cfg->thread_name);
        free(cfg->timeout_node_id);
        free(cfg);
        return -1;
    }

    pthread_detach(thread);
    return 0;
}
