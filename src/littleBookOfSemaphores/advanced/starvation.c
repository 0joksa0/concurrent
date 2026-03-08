#include "littleBookOfSemaphores/advanced/starvation.h"
#include "utils/watchdog.h"
#include "viz.h"
#include <pthread.h>
#include <semaphore.h>
#include <stdio.h>
#include <unistd.h>

#define READER_COUNT 3

typedef struct starvation_ctx {
    sem_t mutex;
    sem_t room_empty;
    int reader_count;
} starvation_ctx_t;

typedef struct reader_ctx {
    starvation_ctx_t *shared;
    int id;
} reader_ctx_t;

static void* reader_thread(void *arg)
{
    reader_ctx_t *ctx = (reader_ctx_t *)arg;
    starvation_ctx_t *s = ctx->shared;
    char thread_name[24];
    snprintf(thread_name, sizeof(thread_name), "starve-reader-%d", ctx->id);
    viz_thread_register(thread_name);

    usleep((unsigned int)ctx->id * 4000U);

    while (1) {
        // @viz-node id=starvation_reader_wait_mutex_before type=sync label="Reader waits mutex"
        VIZ("starvation_reader_wait_mutex_before");
        sem_wait(&s->mutex);
        // @viz-node id=starvation_reader_wait_mutex_after type=sync label="Reader acquired mutex"
        VIZ("starvation_reader_wait_mutex_after");

        s->reader_count += 1;
        if (s->reader_count == 1) {
            // @viz-node id=starvation_reader_wait_room_before type=sync label="First reader waits room_empty"
            VIZ("starvation_reader_wait_room_before");
            sem_wait(&s->room_empty);
            // @viz-node id=starvation_reader_wait_room_after type=sync label="First reader acquired room_empty"
            VIZ("starvation_reader_wait_room_after");
        }

        // @viz-node id=starvation_reader_post_mutex_before type=sync label="Reader posts mutex"
        VIZ("starvation_reader_post_mutex_before");
        sem_post(&s->mutex);
        // @viz-node id=starvation_reader_post_mutex_after type=sync label="Reader released mutex"
        VIZ("starvation_reader_post_mutex_after");

        // @viz-node id=starvation_reader_read type=critical label="Reader in critical section (reading)"
        VIZ("starvation_reader_read");
        usleep(12000);

        // @viz-node id=starvation_reader_wait_mutex2_before type=sync label="Reader waits mutex to exit"
        VIZ("starvation_reader_wait_mutex2_before");
        sem_wait(&s->mutex);
        // @viz-node id=starvation_reader_wait_mutex2_after type=sync label="Reader acquired mutex to exit"
        VIZ("starvation_reader_wait_mutex2_after");

        s->reader_count -= 1;
        if (s->reader_count == 0) {
            // @viz-node id=starvation_reader_post_room_before type=sync label="Last reader posts room_empty"
            VIZ("starvation_reader_post_room_before");
            sem_post(&s->room_empty);
            // @viz-node id=starvation_reader_post_room_after type=sync label="Last reader released room_empty"
            VIZ("starvation_reader_post_room_after");
        }

        // @viz-node id=starvation_reader_post_mutex2_before type=sync label="Reader posts mutex after exit"
        VIZ("starvation_reader_post_mutex2_before");
        sem_post(&s->mutex);
        // @viz-node id=starvation_reader_post_mutex2_after type=sync label="Reader released mutex after exit"
        VIZ("starvation_reader_post_mutex2_after");

        usleep(1000);
    }
}

static void* writer_thread(void *arg)
{
    starvation_ctx_t *s = (starvation_ctx_t *)arg;
    viz_thread_register("starve-writer");

    usleep(25000);
    // @viz-node id=starvation_writer_wait_room_before type=sync label="Writer waits room_empty (starving)"
    VIZ("starvation_writer_wait_room_before");
    sem_wait(&s->room_empty);
    // @viz-node id=starvation_writer_wait_room_after type=sync label="Writer acquired room_empty"
    VIZ("starvation_writer_wait_room_after");

    // @viz-node id=starvation_writer_write type=critical label="Writer in critical section (writing)"
    VIZ("starvation_writer_write");
    usleep(10000);

    // @viz-node id=starvation_writer_post_room_before type=sync label="Writer posts room_empty"
    VIZ("starvation_writer_post_room_before");
    sem_post(&s->room_empty);
    // @viz-node id=starvation_writer_post_room_after type=sync label="Writer released room_empty"
    VIZ("starvation_writer_post_room_after");
    return NULL;
}

void starvation_problem(void)
{
    // @viz-node id=starvation_start type=thread label="Starvation demo starts (reader preference)"
    VIZ("starvation_start");

    starvation_ctx_t shared;
    shared.reader_count = 0;
    sem_init(&shared.mutex, 0, 1);
    sem_init(&shared.room_empty, 0, 1);

    pthread_t readers[READER_COUNT];
    reader_ctx_t reader_ctxs[READER_COUNT];
    pthread_t writer;

    for (int i = 0; i < READER_COUNT; i++) {
        reader_ctxs[i].shared = &shared;
        reader_ctxs[i].id = i;
        // @viz-node id=starvation_create_reader type=thread label="Create reader thread"
        VIZ("starvation_create_reader");
        pthread_create(&readers[i], NULL, reader_thread, &reader_ctxs[i]);
    }

    // @viz-node id=starvation_create_writer type=thread label="Create writer thread"
    VIZ("starvation_create_writer");
    pthread_create(&writer, NULL, writer_thread, &shared);

    // @viz-node id=starvation_create_watchdog type=thread label="Create starvation watchdog thread"
    VIZ("starvation_create_watchdog");
    // @viz-node id=starvation_timeout type=thread label="Starvation watchdog timeout reached"
    watchdog_start_exit_after_us(3500, "starvation-watchdog", "starvation_timeout", 0);

    pthread_join(writer, NULL);
}
