
#include "littleBookOfSemaphores/basic/multiplex.h"
#include "viz.h"
#include <pthread.h>
#include <semaphore.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

#define NUMBER_THREAD 10
#define N 3


static void* worker(void* arg)
{
    sem_t* multiplex = (sem_t*)arg;
    viz_thread_register("multiplex-worker");
    // @viz-node id=multiplex_wait_before type=sync label="Worker waits on multiplex semaphore"
    VIZ("multiplex_wait_before");
    sem_wait(multiplex);
    // @viz-node id=multiplex_wait_after type=sync label="Worker entered critical section"
    VIZ("multiplex_wait_after");
    printf("%lu entered critial session\n", pthread_self());
    usleep(10 + (rand() % 990));

    printf("%lu exit critial session\n", pthread_self());
    // @viz-node id=multiplex_post_before type=sync label="Worker releases multiplex semaphore"
    VIZ("multiplex_post_before");
    sem_post(multiplex);
    // @viz-node id=multiplex_post_after type=sync label="Worker released multiplex semaphore"
    VIZ("multiplex_post_after");

    return NULL;
}

void multiplex()
{
    sem_t multiplex;
    sem_init(&multiplex, 0, N);
    srand(time(NULL));

    pthread_t t[NUMBER_THREAD];
    for (int i = 0; i < NUMBER_THREAD; i++) {

        pthread_create(&t[i], NULL, worker, &multiplex);
    }
    for (int i = 0; i < NUMBER_THREAD; i++) {

        pthread_join(t[i], NULL);
    }


    sem_destroy(&multiplex);
}
