#include "littleBookOfSemaphores/advanced/deadlock.h"
#include "utils/watchdog.h"
#include "viz.h"
#include <pthread.h>
#include <semaphore.h>
#include <unistd.h>

typedef struct deadlock_ctx {
    sem_t fork_a;
    sem_t fork_b;
} deadlock_ctx_t;

static void* philosopher_a(void* arg)
{
    deadlock_ctx_t* ctx = (deadlock_ctx_t*)arg;
    viz_thread_register("deadlock-A");

    // @viz-node id=deadlock_a_wait_fork_a_before type=sync label="A waits fork A"
    VIZ("deadlock_a_wait_fork_a_before");
    sem_wait(&ctx->fork_a);
    // @viz-node id=deadlock_a_wait_fork_a_after type=sync label="A acquired fork A"
    VIZ("deadlock_a_wait_fork_a_after");

    usleep(20000);

    // @viz-node id=deadlock_a_wait_fork_b_before type=sync label="A waits fork B (blocked)"
    VIZ("deadlock_a_wait_fork_b_before");
    sem_wait(&ctx->fork_b);
    // @viz-node id=deadlock_a_wait_fork_b_after type=sync label="A acquired fork B"
    VIZ("deadlock_a_wait_fork_b_after");

    return NULL;
}

static void* philosopher_b(void* arg)
{
    deadlock_ctx_t* ctx = (deadlock_ctx_t*)arg;
    viz_thread_register("deadlock-B");

    // @viz-node id=deadlock_b_wait_fork_b_before type=sync label="B waits fork B"
    VIZ("deadlock_b_wait_fork_b_before");
    sem_wait(&ctx->fork_b);
    // @viz-node id=deadlock_b_wait_fork_b_after type=sync label="B acquired fork B"
    VIZ("deadlock_b_wait_fork_b_after");

    usleep(20000);

    // @viz-node id=deadlock_b_wait_fork_a_before type=sync label="B waits fork A (blocked)"
    VIZ("deadlock_b_wait_fork_a_before");
    sem_wait(&ctx->fork_a);
    // @viz-node id=deadlock_b_wait_fork_a_after type=sync label="B acquired fork A"
    VIZ("deadlock_b_wait_fork_a_after");

    return NULL;
}

void deadlock_problem(void)
{
    // @viz-node id=deadlock_start type=thread label="Deadlock demo starts"
    VIZ("deadlock_start");

    deadlock_ctx_t ctx;
    sem_init(&ctx.fork_a, 0, 1);
    sem_init(&ctx.fork_b, 0, 1);

    pthread_t t_a;
    pthread_t t_b;

    // @viz-node id=deadlock_create_a type=thread label="Create deadlock thread A"
    VIZ("deadlock_create_a");
    pthread_create(&t_a, NULL, philosopher_a, &ctx);

    // @viz-node id=deadlock_create_b type=thread label="Create deadlock thread B"
    VIZ("deadlock_create_b");
    pthread_create(&t_b, NULL, philosopher_b, &ctx);

    // @viz-node id=deadlock_create_watchdog type=thread label="Create deadlock watchdog thread"
    VIZ("deadlock_create_watchdog");
    // @viz-node id=deadlock_timeout type=thread label="Deadlock watchdog timeout reached"
    watchdog_start_exit_after_us(250000, "deadlock-watchdog", "deadlock_timeout", 0);

    // Intentionally blocked forever in deadlock demo; watchdog terminates process.
    pthread_join(t_a, NULL);
    pthread_join(t_b, NULL);
}
