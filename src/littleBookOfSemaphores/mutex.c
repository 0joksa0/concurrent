
#include "littleBookOfSemaphores/mutex.h"
#include <pthread.h>
#include <semaphore.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>


static int count = 0;

static void* threadA(void* arg)
{
    sem_t* mutex = (sem_t*)arg;
    sem_wait(mutex);
    int local = count;
    usleep(10 + (rand() % 990));
    count = local + 1;
    sem_post(mutex);

    return NULL;
}
static void* threadB(void* arg)
{
    sem_t* mutex = (sem_t*)arg;
    sem_wait(mutex);
    int local = count;
    usleep(10 + (rand() % 990));
    count = local + 5;
    sem_post(mutex);

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
