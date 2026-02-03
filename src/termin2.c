#include "termin2.h"
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <time.h>

static int balance = 10000;

// Primer SHARED memory and RACE conditions
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
        if (i % 2) {
            signal = deposit(amount);
        } else {
            signal = withdraw(amount);
        }
        printf("%d %s, trhead id: %lu\n", amount, signal ? "successfully" : "unsuccessfully", threadId);
    }
}

void sharedMemoryProblem(int numberOfThreads, int numberOfTransactions)
{
    pthread_t threads[numberOfThreads];
    srand(time(NULL));

    for (int i = 0; i < numberOfThreads; i++) {
        pthread_create(&threads[i], NULL, workerThread, &numberOfTransactions);
    }

    for (int i = 0; i < numberOfThreads; i++) {
        pthread_join(threads[i], NULL);
    }
}
