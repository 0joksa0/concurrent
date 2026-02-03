//SEMAPHORES in C
#include "termin3.h"
#include <pthread.h>
#include <time.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <semaphore.h>

static sem_t semaphore;

static void* printConcurent(void* args)
{
    sem_wait(&semaphore);
    for (int i = 0; i < strlen((const char*)args); i++) {

        usleep(rand() % 1000);
        printf("%c", ((char*)args)[i]);
    }
    sem_post(&semaphore);
}





void simpleSynchronisation(){
    srand(time(NULL));
    sem_init(&semaphore, 0, 1);
    
    char* helloString = "Hello ";
    char* worldString = "World \n";

    pthread_t helloThread;
    pthread_t worldThread;

    pthread_create(&helloThread, NULL, printConcurent, helloString);
    pthread_create(&worldThread, NULL, printConcurent, worldString);

    pthread_join(helloThread, NULL);
    pthread_join(worldThread, NULL);
    sem_destroy(&semaphore);
}

static int balance = 10000;

static int deposit(int amount)
{
    int temp = balance + amount;
    printf("deposit f => ");
    usleep(rand() % 10);
    balance = temp;
    return 1;
}

static int withdraw(int amount)
{
    int temp = balance - amount;
    printf("withdarw f => ");
    if (temp < 0) {
        return 0;
    }
    usleep(rand() % 10);
    balance = temp;
    return 1;
}

static void* workerThread(void* args)
{
    pthread_t threadId = pthread_self();
    for (int i = 0; i < *(int *)args; i++) {
        int amount = rand() % 500 + 1;
        int signal;
        sem_wait(&semaphore);
        if (i % 2) {
            signal = deposit(amount);
        } else {
            signal = withdraw(amount);
        }
    
        sem_post(&semaphore);
        printf("%d %s, trhead id: %lu\n", amount, signal ? "successfully" : "unsuccessfully", threadId);
    }
}

void simpleMUTEX_primer2(int numberOfThreads, int numberOfTransactions)
{
    pthread_t threads[numberOfThreads];
    sem_init(&semaphore,0, 1);

    srand(time(NULL));

    for (int i = 0; i < numberOfThreads; i++) {
        pthread_create(&threads[i], NULL, workerThread, &numberOfTransactions);
    }

    for (int i = 0; i < numberOfThreads; i++) {
        pthread_join(threads[i], NULL);
    }
    sem_destroy(&semaphore);
}
