#include "littleBookOfSemaphores/common/dining_philosophers.h"
#include "viz.h"
#include <pthread.h>
#include <semaphore.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <unistd.h>

#define PHILOSOPHERS 5
#define ROUNDS 2

typedef struct philosopher_ctx {
    int id;
    sem_t* room;
    sem_t* forks;
} philosopher_ctx_t;

#define VIZ_DINING_CREATE_THREAD(I) do { \
    switch ((I)) { \
        /* @viz-node id=dining_create_philosopher_0 type=thread label="Create philosopher thread #0" */ \
        case 0: VIZ("dining_create_philosopher_0"); break; \
        /* @viz-node id=dining_create_philosopher_1 type=thread label="Create philosopher thread #1" */ \
        case 1: VIZ("dining_create_philosopher_1"); break; \
        /* @viz-node id=dining_create_philosopher_2 type=thread label="Create philosopher thread #2" */ \
        case 2: VIZ("dining_create_philosopher_2"); break; \
        /* @viz-node id=dining_create_philosopher_3 type=thread label="Create philosopher thread #3" */ \
        case 3: VIZ("dining_create_philosopher_3"); break; \
        /* @viz-node id=dining_create_philosopher_4 type=thread label="Create philosopher thread #4" */ \
        case 4: VIZ("dining_create_philosopher_4"); break; \
        default: VIZ("dining_create_philosopher"); break; \
    } \
} while (0)

static void* philosopher(void* arg)
{
    philosopher_ctx_t* ctx = (philosopher_ctx_t*)arg;
    int left = ctx->id;
    int right = (ctx->id + 1) % PHILOSOPHERS;
    char thread_name[32];

    snprintf(thread_name, sizeof(thread_name), "philosopher-%d", ctx->id);
    viz_thread_register(thread_name);

    for (int r = 0; r < ROUNDS; r++) {
        // @viz-node id=dining_think type=action label="Philosopher thinks"
        VIZ("dining_think");
        usleep(5000 + (rand() % 10000));

        // @viz-node id=dining_wait_room_before type=sync label="Wait for room semaphore"
        VIZ("dining_wait_room_before");
        sem_wait(ctx->room);
        // @viz-node id=dining_wait_room_after type=sync label="Room semaphore acquired"
        VIZ("dining_wait_room_after");

        // @viz-node id=dining_wait_left_before type=sync label="Wait for left fork"
        VIZ("dining_wait_left_before");
        sem_wait(&ctx->forks[left]);
        // @viz-node id=dining_wait_left_after type=sync label="Left fork acquired"
        VIZ("dining_wait_left_after");

        // @viz-node id=dining_wait_right_before type=sync label="Wait for right fork"
        VIZ("dining_wait_right_before");
        sem_wait(&ctx->forks[right]);
        // @viz-node id=dining_wait_right_after type=sync label="Right fork acquired"
        VIZ("dining_wait_right_after");

        // @viz-node id=dining_eat type=action label="Philosopher eats"
        VIZ("dining_eat");
        printf("philosopher %d eating round %d\n", ctx->id, r + 1);
        usleep(5000 + (rand() % 10000));

        // @viz-node id=dining_release_right_before type=sync label="Release right fork"
        VIZ("dining_release_right_before");
        sem_post(&ctx->forks[right]);
        // @viz-node id=dining_release_left_before type=sync label="Release left fork"
        VIZ("dining_release_left_before");
        sem_post(&ctx->forks[left]);
        // @viz-node id=dining_release_room_before type=sync label="Release room semaphore"
        VIZ("dining_release_room_before");
        sem_post(ctx->room);
    }

    // @viz-node id=dining_done type=thread label="Philosopher thread done"
    VIZ("dining_done");
    return NULL;
}

void dining_philosophers(void)
{
    // @viz-node id=dining_start type=thread label="Dining philosophers starts"
    VIZ("dining_start");
    srand(time(NULL));

    sem_t room;
    sem_t forks[PHILOSOPHERS];
    sem_init(&room, 0, PHILOSOPHERS - 1);

    for (int i = 0; i < PHILOSOPHERS; i++) {
        sem_init(&forks[i], 0, 1);
    }

    pthread_t threads[PHILOSOPHERS];
    philosopher_ctx_t ctx[PHILOSOPHERS];

    for (int i = 0; i < PHILOSOPHERS; i++) {
        ctx[i].id = i;
        ctx[i].room = &room;
        ctx[i].forks = forks;

        VIZ_DINING_CREATE_THREAD(i);
        pthread_create(&threads[i], NULL, philosopher, &ctx[i]);
    }

    for (int i = 0; i < PHILOSOPHERS; i++) {
        pthread_join(threads[i], NULL);
    }

    for (int i = 0; i < PHILOSOPHERS; i++) {
        sem_destroy(&forks[i]);
    }
    sem_destroy(&room);

    // @viz-node id=dining_end type=thread label="Dining philosophers finished"
    VIZ("dining_end");
}
