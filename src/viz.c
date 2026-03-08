#include "viz.h"

#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/time.h>

typedef struct viz_thread_info {
    char *name;
    unsigned long numeric_id;
} viz_thread_info_t;

static pthread_once_t g_tls_once = PTHREAD_ONCE_INIT;
static pthread_key_t g_tls_key;
static pthread_mutex_t g_log_mutex = PTHREAD_MUTEX_INITIALIZER;
static pthread_mutex_t g_id_mutex = PTHREAD_MUTEX_INITIALIZER;
static unsigned long g_next_thread_id = 1;
static FILE *g_output = NULL;

static char *viz_strdup_local(const char *src)
{
    size_t len;
    char *dst;

    if (src == NULL) {
        return NULL;
    }

    len = strlen(src) + 1;
    dst = (char *)malloc(len);
    if (dst == NULL) {
        return NULL;
    }

    memcpy(dst, src, len);
    return dst;
}

static void viz_tls_destructor(void *ptr)
{
    viz_thread_info_t *info = (viz_thread_info_t *)ptr;
    if (info == NULL) {
        return;
    }

    free(info->name);
    free(info);
}

static void viz_make_tls_key(void)
{
    pthread_key_create(&g_tls_key, viz_tls_destructor);
}

static void viz_ensure_tls_key(void)
{
    pthread_once(&g_tls_once, viz_make_tls_key);
}

static viz_thread_info_t *viz_get_thread_info(void)
{
    viz_ensure_tls_key();
    return (viz_thread_info_t *)pthread_getspecific(g_tls_key);
}

static unsigned long viz_next_thread_id(void)
{
    unsigned long id;

    pthread_mutex_lock(&g_id_mutex);
    id = g_next_thread_id;
    g_next_thread_id++;
    pthread_mutex_unlock(&g_id_mutex);

    return id;
}

static void viz_write_json_string(FILE *out, const char *text)
{
    const unsigned char *p = (const unsigned char *)text;

    fputc('"', out);
    if (text == NULL) {
        fputc('"', out);
        return;
    }

    while (*p != '\0') {
        if (*p == '\\' || *p == '"') {
            fputc('\\', out);
            fputc((int)*p, out);
        } else if (*p == '\n') {
            fputs("\\n", out);
        } else if (*p == '\r') {
            fputs("\\r", out);
        } else if (*p == '\t') {
            fputs("\\t", out);
        } else if (*p < 0x20) {
            fprintf(out, "\\u%04x", *p);
        } else {
            fputc((int)*p, out);
        }
        p++;
    }

    fputc('"', out);
}

void viz_init(const char *output_path)
{
    const char *path = output_path;

    if (path == NULL || path[0] == '\0') {
        path = "trace.jsonl";
    }

    pthread_mutex_lock(&g_log_mutex);

    if (g_output != NULL) {
        fclose(g_output);
        g_output = NULL;
    }

    g_output = fopen(path, "w");

    pthread_mutex_unlock(&g_log_mutex);
}

void viz_shutdown(void)
{
    pthread_mutex_lock(&g_log_mutex);

    if (g_output != NULL) {
        fclose(g_output);
        g_output = NULL;
    }

    pthread_mutex_unlock(&g_log_mutex);
}

void viz_thread_register(const char *thread_name)
{
    viz_thread_info_t *info;
    const char *name = thread_name;

    viz_ensure_tls_key();

    if (name == NULL || name[0] == '\0') {
        name = "unregistered";
    }

    info = (viz_thread_info_t *)pthread_getspecific(g_tls_key);
    if (info == NULL) {
        info = (viz_thread_info_t *)calloc(1, sizeof(*info));
        if (info == NULL) {
            return;
        }
        info->numeric_id = viz_next_thread_id();
        pthread_setspecific(g_tls_key, info);
    }

    free(info->name);
    info->name = viz_strdup_local(name);
    if (info->name == NULL) {
        info->name = viz_strdup_local("unregistered");
    }
}

const char *viz_current_thread_name(void)
{
    viz_thread_info_t *info = viz_get_thread_info();

    if (info == NULL || info->name == NULL) {
        return "unregistered";
    }

    return info->name;
}

unsigned long viz_current_thread_numeric_id(void)
{
    viz_thread_info_t *info = viz_get_thread_info();

    if (info == NULL) {
        return 0;
    }

    return info->numeric_id;
}

void viz_point(const char *node_id, const char *file, int line, const char *func)
{
    struct timeval tv;
    unsigned long long timestamp_us;
    const char *name;
    unsigned long numeric_id;

    pthread_mutex_lock(&g_log_mutex);

    if (g_output == NULL) {
        pthread_mutex_unlock(&g_log_mutex);
        return;
    }

    gettimeofday(&tv, NULL);
    timestamp_us = (unsigned long long)tv.tv_sec * 1000000ULL + (unsigned long long)tv.tv_usec;

    name = viz_current_thread_name();
    numeric_id = viz_current_thread_numeric_id();

    fputc('{', g_output);
    fprintf(g_output, "\"timestamp_us\":%llu,", timestamp_us);
    fputs("\"event_type\":\"checkpoint\",", g_output);

    fputs("\"node_id\":", g_output);
    viz_write_json_string(g_output, node_id != NULL ? node_id : "");

    fputs(",\"thread_name\":", g_output);
    viz_write_json_string(g_output, name);

    fprintf(g_output, ",\"thread_numeric_id\":%lu", numeric_id);

    fputs(",\"file\":", g_output);
    viz_write_json_string(g_output, file != NULL ? file : "");

    fprintf(g_output, ",\"line\":%d", line);

    fputs(",\"function\":", g_output);
    viz_write_json_string(g_output, func != NULL ? func : "");

    fputs("}\n", g_output);
    fflush(g_output);

    pthread_mutex_unlock(&g_log_mutex);
}
