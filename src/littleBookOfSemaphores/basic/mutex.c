
#include "littleBookOfSemaphores/basic/mutex.h"
#include "viz.h"
#include <pthread.h>
#include <semaphore.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>


static int count = 0;

static void* threadA(void* arg)
{
    sem_t* mutex = (sem_t*)arg;
    viz_thread_register("mutex-threadA");
    // @viz-node id=mutex_threadA_wait_before type=sync label="Thread A waits mutex semaphore"
    VIZ("mutex_threadA_wait_before");
    sem_wait(mutex);
    // @viz-node id=mutex_threadA_wait_after type=sync label="Thread A entered critical section"
    VIZ("mutex_threadA_wait_after");
    int local = count;
    usleep(10 + (rand() % 990));
    count = local + 1;
    // @viz-node id=mutex_threadA_post_before type=sync label="Thread A releases mutex semaphore"
    VIZ("mutex_threadA_post_before");
    sem_post(mutex);
    // @viz-node id=mutex_threadA_post_after type=sync label="Thread A exited critical section"
    VIZ("mutex_threadA_post_after");

    return NULL;
}
static void* threadB(void* arg)
{
    sem_t* mutex = (sem_t*)arg;
    viz_thread_register("mutex-threadB");
    // @viz-node id=mutex_threadB_wait_before type=sync label="Thread B waits mutex semaphore"
    VIZ("mutex_threadB_wait_before");
    sem_wait(mutex);
    // @viz-node id=mutex_threadB_wait_after type=sync label="Thread B entered critical section"
    VIZ("mutex_threadB_wait_after");
    int local = count;
    usleep(10 + (rand() % 990));
    count = local + 5;
    // @viz-node id=mutex_threadB_post_before type=sync label="Thread B releases mutex semaphore"
    VIZ("mutex_threadB_post_before");
    sem_post(mutex);
    // @viz-node id=mutex_threadB_post_after type=sync label="Thread B exited critical section"
    VIZ("mutex_threadB_post_after");

    return NULL;
}

void mutex()
{
    sem_t mutex;
    sem_init(&mutex, 0, 1);
    srand(time(NULL));

    pthread_t tA, tB;
    pthread_create(&tA, NULL, threadA, &mutex);
    pthread_create(&tB, NULL, threadB, &mutex);

    pthread_join(tA, NULL);
    pthread_join(tB, NULL);
    printf("%d", count);

    sem_destroy(&mutex);
}
