// Generalize the signal pattern so that it works both ways. Thread A has to wait for Thread B and vice versa. In other words, given this code

#include <bits/pthreadtypes.h>
#include <pthread.h>
#include <semaphore.h>
#include <stdio.h>
#include <stdlib.h>

typedef struct randezvous {
    sem_t semA;
    sem_t semB;

} rendezvous_t;

void* threadA(void* arg)
{
    rendezvous_t* r = (rendezvous_t*)arg;
    pthread_t tid = pthread_self();

    printf("A1 (%lu)\n", tid);

    sem_post(&r->semA);   
    sem_wait(&r->semB);  

    printf("A2 (%lu)\n", tid);
    return NULL;
}
void* threadB(void* arg)
{
    rendezvous_t* r = (rendezvous_t*)arg;
    pthread_t tid = pthread_self();

    printf("B1 (%lu)\n", tid);

    sem_post(&r->semB);   
    sem_wait(&r->semA);  

    printf("B2 (%lu)\n", tid);
    return NULL;
}



void rendezvous(){
    rendezvous_t data ;
    sem_init(&data.semA, 0, 0);
    sem_init(&data.semB, 0, 0);
    
    pthread_t tA, tB;
    pthread_create(&tA, NULL , threadA, &data);
    pthread_create(&tB, NULL , threadB, &data);


    pthread_join(tA, NULL);
    pthread_join(tB, NULL);

    sem_destroy(&data.semA);
    sem_destroy(&data.semB);
}
