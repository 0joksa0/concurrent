
#include "littleBookOfSemaphores/multiplex.h"
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
    sem_wait(multiplex);
    printf("%lu entered critial session\n", pthread_self());
    usleep(10 + (rand() % 990));

    printf("%lu exit critial session\n", pthread_self());
    sem_post(multiplex);

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
