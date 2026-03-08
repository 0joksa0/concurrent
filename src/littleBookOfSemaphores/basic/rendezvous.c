#include "littleBookOfSemaphores/basic/rendezvous.h"
#include "viz.h"
#include <pthread.h>
#include <semaphore.h>
#include <stdio.h>
#include <stdlib.h>

typedef struct randezvous {
    sem_t semA;
    sem_t semB;

} rendezvous_t;


static void* threadA(void* arg)
{
    rendezvous_t* r = (rendezvous_t*)arg;
    pthread_t tid = pthread_self();
    viz_thread_register("rendezvous-A");

    printf("A1 (%lu)\n", tid);

    // @viz-node id=rendezvous_a_post_before type=sync label="Thread A posts semA"
    VIZ("rendezvous_a_post_before");
    sem_post(&r->semA);   
    // @viz-node id=rendezvous_a_wait_before type=sync label="Thread A waits semB"
    VIZ("rendezvous_a_wait_before");
    sem_wait(&r->semB);  
    // @viz-node id=rendezvous_a_wait_after type=sync label="Thread A passed semB wait"
    VIZ("rendezvous_a_wait_after");

    printf("A2 (%lu)\n", tid);
    return NULL;
}
static void* threadB(void* arg)
{
    rendezvous_t* r = (rendezvous_t*)arg;
    pthread_t tid = pthread_self();
    viz_thread_register("rendezvous-B");

    printf("B1 (%lu)\n", tid);

    // @viz-node id=rendezvous_b_post_before type=sync label="Thread B posts semB"
    VIZ("rendezvous_b_post_before");
    sem_post(&r->semB);   
    // @viz-node id=rendezvous_b_wait_before type=sync label="Thread B waits semA"
    VIZ("rendezvous_b_wait_before");
    sem_wait(&r->semA);  
    // @viz-node id=rendezvous_b_wait_after type=sync label="Thread B passed semA wait"
    VIZ("rendezvous_b_wait_after");

    printf("B2 (%lu)\n", tid);
    return NULL;
}



void rendezvous(){
    // @viz-node id=rendezvous_start type=thread label="Rendezvous function starts"
    VIZ("rendezvous_start");
    rendezvous_t data ;
    sem_init(&data.semA, 0, 0);
    sem_init(&data.semB, 0, 0);
    
    pthread_t tA, tB;
    // @viz-node id=rendezvous_create_threadA type=thread label="Create threadA context"
    VIZ("rendezvous_create_threadA");
    pthread_create(&tA, NULL , threadA, &data);
    // @viz-node id=rendezvous_create_threadB type=thread label="Create threadB context"
    VIZ("rendezvous_create_threadB");
    pthread_create(&tB, NULL , threadB, &data);


    pthread_join(tA, NULL);
    pthread_join(tB, NULL);

    // @viz-node id=rendezvous_join_done type=thread label="Rendezvous threads joined"
    VIZ("rendezvous_join_done");

    sem_destroy(&data.semA);
    sem_destroy(&data.semB);
}
