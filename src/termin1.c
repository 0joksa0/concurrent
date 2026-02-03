#include "termin1.h"
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static void* printConcurent(void* args)
{
    for (int i = 0; i < strlen((const char*)args); i++) {

        usleep(rand() % 1000);
        printf("%c", ((char*)args)[i]);
    }
}

void simpleConcurrentprogram()
{
    srand(time(NULL));

    char* helloString = "Hello ";
    char* worldString = "World \n";

    pthread_t helloThread;
    pthread_t worldThread;

    pthread_create(&helloThread, NULL, printConcurent, helloString);
    pthread_create(&worldThread, NULL, printConcurent, worldString);

    pthread_join(helloThread, NULL);
    pthread_join(worldThread, NULL);
}
