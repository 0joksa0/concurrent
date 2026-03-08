#include "littleBookOfSemaphores/common/producer_consumer.h"
#include "viz.h"
#include <pthread.h>
#include <semaphore.h>
#include <stdio.h>
#include <unistd.h>

#define BUFFER_SIZE 3
#define PRODUCER_COUNT 2
#define CONSUMER_COUNT 2
#define ITEMS_PER_PRODUCER 4
#define ITEMS_PER_CONSUMER ((PRODUCER_COUNT * ITEMS_PER_PRODUCER) / CONSUMER_COUNT)

typedef struct producer_consumer_ctx {
    int buffer[BUFFER_SIZE];
    int in_idx;
    int out_idx;
    int next_item;
    sem_t empty_slots;
    sem_t full_slots;
    sem_t mutex;
} producer_consumer_ctx_t;

typedef struct worker_ctx {
    producer_consumer_ctx_t *shared;
    int id;
} worker_ctx_t;

static void* producer_thread(void *arg)
{
    worker_ctx_t *ctx = (worker_ctx_t *)arg;
    producer_consumer_ctx_t *pc = ctx->shared;
    char thread_name[24];
    snprintf(thread_name, sizeof(thread_name), "producer-%d", ctx->id);
    viz_thread_register(thread_name);

    for (int i = 0; i < ITEMS_PER_PRODUCER; i++) {
        // @viz-node id=pc_producer_wait_empty_before type=sync label="Producer waits empty slot"
        VIZ("pc_producer_wait_empty_before");
        sem_wait(&pc->empty_slots);
        // @viz-node id=pc_producer_wait_empty_after type=sync label="Producer acquired empty slot"
        VIZ("pc_producer_wait_empty_after");

        // @viz-node id=pc_producer_wait_mutex_before type=sync label="Producer waits buffer mutex"
        VIZ("pc_producer_wait_mutex_before");
        sem_wait(&pc->mutex);
        // @viz-node id=pc_producer_wait_mutex_after type=critical label="Producer entered buffer critical section"
        VIZ("pc_producer_wait_mutex_after");

        int item = pc->next_item++;
        pc->buffer[pc->in_idx] = item;
        pc->in_idx = (pc->in_idx + 1) % BUFFER_SIZE;
        // @viz-node id=pc_producer_write_item type=critical label="Producer writes item to buffer"
        VIZ("pc_producer_write_item");

        // @viz-node id=pc_producer_post_mutex_before type=critical label="Producer posts buffer mutex"
        VIZ("pc_producer_post_mutex_before");
        sem_post(&pc->mutex);
        // @viz-node id=pc_producer_post_mutex_after type=sync label="Producer released buffer mutex"
        VIZ("pc_producer_post_mutex_after");

        // @viz-node id=pc_producer_post_full_before type=sync label="Producer posts full slot"
        VIZ("pc_producer_post_full_before");
        sem_post(&pc->full_slots);
        // @viz-node id=pc_producer_post_full_after type=sync label="Producer signaled full slot"
        VIZ("pc_producer_post_full_after");

        usleep(2500);
    }

    // @viz-node id=pc_producer_exit type=thread label="Producer thread exits"
    VIZ("pc_producer_exit");
    return NULL;
}

static void* consumer_thread(void *arg)
{
    worker_ctx_t *ctx = (worker_ctx_t *)arg;
    producer_consumer_ctx_t *pc = ctx->shared;
    char thread_name[24];
    snprintf(thread_name, sizeof(thread_name), "consumer-%d", ctx->id);
    viz_thread_register(thread_name);

    for (int i = 0; i < ITEMS_PER_CONSUMER; i++) {
        // @viz-node id=pc_consumer_wait_full_before type=sync label="Consumer waits full slot"
        VIZ("pc_consumer_wait_full_before");
        sem_wait(&pc->full_slots);
        // @viz-node id=pc_consumer_wait_full_after type=sync label="Consumer acquired full slot"
        VIZ("pc_consumer_wait_full_after");

        // @viz-node id=pc_consumer_wait_mutex_before type=sync label="Consumer waits buffer mutex"
        VIZ("pc_consumer_wait_mutex_before");
        sem_wait(&pc->mutex);
        // @viz-node id=pc_consumer_wait_mutex_after type=critical label="Consumer entered buffer critical section"
        VIZ("pc_consumer_wait_mutex_after");

        int item = pc->buffer[pc->out_idx];
        pc->out_idx = (pc->out_idx + 1) % BUFFER_SIZE;
        (void)item;
        // @viz-node id=pc_consumer_read_item type=critical label="Consumer reads item from buffer"
        VIZ("pc_consumer_read_item");

        // @viz-node id=pc_consumer_post_mutex_before type=critical label="Consumer posts buffer mutex"
        VIZ("pc_consumer_post_mutex_before");
        sem_post(&pc->mutex);
        // @viz-node id=pc_consumer_post_mutex_after type=sync label="Consumer released buffer mutex"
        VIZ("pc_consumer_post_mutex_after");

        // @viz-node id=pc_consumer_post_empty_before type=sync label="Consumer posts empty slot"
        VIZ("pc_consumer_post_empty_before");
        sem_post(&pc->empty_slots);
        // @viz-node id=pc_consumer_post_empty_after type=sync label="Consumer signaled empty slot"
        VIZ("pc_consumer_post_empty_after");

        usleep(2800);
    }

    // @viz-node id=pc_consumer_exit type=thread label="Consumer thread exits"
    VIZ("pc_consumer_exit");
    return NULL;
}

void producer_consumer_problem(void)
{
    // @viz-node id=pc_start type=thread label="Producer-consumer problem starts"
    VIZ("pc_start");

    producer_consumer_ctx_t shared;
    shared.in_idx = 0;
    shared.out_idx = 0;
    shared.next_item = 1;

    sem_init(&shared.empty_slots, 0, BUFFER_SIZE);
    sem_init(&shared.full_slots, 0, 0);
    sem_init(&shared.mutex, 0, 1);

    worker_ctx_t producers[PRODUCER_COUNT];
    worker_ctx_t consumers[CONSUMER_COUNT];
    pthread_t producer_threads[PRODUCER_COUNT];
    pthread_t consumer_threads[CONSUMER_COUNT];

    producers[0].shared = &shared;
    producers[0].id = 0;
    producers[1].shared = &shared;
    producers[1].id = 1;
    consumers[0].shared = &shared;
    consumers[0].id = 0;
    consumers[1].shared = &shared;
    consumers[1].id = 1;

    // @viz-node id=pc_create_producer_0 type=thread label="Create producer-0 thread"
    VIZ("pc_create_producer_0");
    pthread_create(&producer_threads[0], NULL, producer_thread, &producers[0]);
    // @viz-node id=pc_create_producer_1 type=thread label="Create producer-1 thread"
    VIZ("pc_create_producer_1");
    pthread_create(&producer_threads[1], NULL, producer_thread, &producers[1]);

    // @viz-node id=pc_create_consumer_0 type=thread label="Create consumer-0 thread"
    VIZ("pc_create_consumer_0");
    pthread_create(&consumer_threads[0], NULL, consumer_thread, &consumers[0]);
    // @viz-node id=pc_create_consumer_1 type=thread label="Create consumer-1 thread"
    VIZ("pc_create_consumer_1");
    pthread_create(&consumer_threads[1], NULL, consumer_thread, &consumers[1]);

    pthread_join(producer_threads[0], NULL);
    pthread_join(producer_threads[1], NULL);
    pthread_join(consumer_threads[0], NULL);
    pthread_join(consumer_threads[1], NULL);

    sem_destroy(&shared.empty_slots);
    sem_destroy(&shared.full_slots);
    sem_destroy(&shared.mutex);

    // @viz-node id=pc_end type=thread label="Producer-consumer problem finished"
    VIZ("pc_end");
}
