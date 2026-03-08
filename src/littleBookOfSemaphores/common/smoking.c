#include "littleBookOfSemaphores/common/smoking.h"
#include "viz.h"
#include <pthread.h>
#include <semaphore.h>
#include <stdio.h>
#include <unistd.h>

#define ROUNDS 6
#define ROUNDS_PER_SMOKER (ROUNDS / 3)

typedef struct smoking_ctx {
    sem_t agent_sem;
    sem_t smoker_tobacco_sem;
    sem_t smoker_paper_sem;
    sem_t smoker_match_sem;
} smoking_ctx_t;

static void* smoker_tobacco_thread(void* arg)
{
    smoking_ctx_t* ctx = (smoking_ctx_t*)arg;
    viz_thread_register("thread_tobacco");

    for (int i = 0; i < ROUNDS_PER_SMOKER; i++) {
        // @viz-node id=smoking_tobacco_wait_before type=sync label="Tobacco smoker waits signal"
        VIZ("smoking_tobacco_wait_before");
        sem_wait(&ctx->smoker_tobacco_sem);
        // @viz-node id=smoking_tobacco_wait_after type=sync label="Tobacco smoker received ingredients"
        VIZ("smoking_tobacco_wait_after");

        // @viz-node id=smoking_tobacco_smoke type=action label="Tobacco smoker smokes"
        VIZ("smoking_tobacco_smoke");
        usleep(3000);

        // @viz-node id=smoking_tobacco_post_agent_before type=sync label="Tobacco smoker posts agent semaphore"
        VIZ("smoking_tobacco_post_agent_before");
        sem_post(&ctx->agent_sem);
        // @viz-node id=smoking_tobacco_post_agent_after type=sync label="Tobacco smoker posted agent semaphore"
        VIZ("smoking_tobacco_post_agent_after");
    }

    // @viz-node id=smoking_tobacco_exit type=thread label="Tobacco smoker exits"
    VIZ("smoking_tobacco_exit");
    return NULL;
}

static void* smoker_paper_thread(void* arg)
{
    smoking_ctx_t* ctx = (smoking_ctx_t*)arg;
    viz_thread_register("thread_paper");

    for (int i = 0; i < ROUNDS_PER_SMOKER; i++) {
        // @viz-node id=smoking_paper_wait_before type=sync label="Paper smoker waits signal"
        VIZ("smoking_paper_wait_before");
        sem_wait(&ctx->smoker_paper_sem);
        // @viz-node id=smoking_paper_wait_after type=sync label="Paper smoker received ingredients"
        VIZ("smoking_paper_wait_after");

        // @viz-node id=smoking_paper_smoke type=action label="Paper smoker smokes"
        VIZ("smoking_paper_smoke");
        usleep(3000);

        // @viz-node id=smoking_paper_post_agent_before type=sync label="Paper smoker posts agent semaphore"
        VIZ("smoking_paper_post_agent_before");
        sem_post(&ctx->agent_sem);
        // @viz-node id=smoking_paper_post_agent_after type=sync label="Paper smoker posted agent semaphore"
        VIZ("smoking_paper_post_agent_after");
    }

    // @viz-node id=smoking_paper_exit type=thread label="Paper smoker exits"
    VIZ("smoking_paper_exit");
    return NULL;
}

static void* smoker_match_thread(void* arg)
{
    smoking_ctx_t* ctx = (smoking_ctx_t*)arg;
    viz_thread_register("thread_match");

    for (int i = 0; i < ROUNDS_PER_SMOKER; i++) {
        // @viz-node id=smoking_match_wait_before type=sync label="Match smoker waits signal"
        VIZ("smoking_match_wait_before");
        sem_wait(&ctx->smoker_match_sem);
        // @viz-node id=smoking_match_wait_after type=sync label="Match smoker received ingredients"
        VIZ("smoking_match_wait_after");

        // @viz-node id=smoking_match_smoke type=action label="Match smoker smokes"
        VIZ("smoking_match_smoke");
        usleep(3000);

        // @viz-node id=smoking_match_post_agent_before type=sync label="Match smoker posts agent semaphore"
        VIZ("smoking_match_post_agent_before");
        sem_post(&ctx->agent_sem);
        // @viz-node id=smoking_match_post_agent_after type=sync label="Match smoker posted agent semaphore"
        VIZ("smoking_match_post_agent_after");
    }

    // @viz-node id=smoking_match_exit type=thread label="Match smoker exits"
    VIZ("smoking_match_exit");
    return NULL;
}

static void* agent_thread(void* arg)
{
    smoking_ctx_t* ctx = (smoking_ctx_t*)arg;
    viz_thread_register("thread_agent");

    const int sequence[ROUNDS] = { 0, 1, 2, 0, 1, 2 };
    for (int i = 0; i < ROUNDS; i++) {
        if (sequence[i] == 0) {
            // @viz-node id=smoking_agent_put_paper_match type=action label="Agent puts paper+match"
            VIZ("smoking_agent_put_paper_match");
            // @viz-node id=smoking_agent_post_tobacco_before type=sync label="Agent posts tobacco smoker semaphore"
            VIZ("smoking_agent_post_tobacco_before");
            sem_post(&ctx->smoker_tobacco_sem);
            // @viz-node id=smoking_agent_post_tobacco_after type=sync label="Agent posted tobacco smoker semaphore"
            VIZ("smoking_agent_post_tobacco_after");
        } else if (sequence[i] == 1) {
            // @viz-node id=smoking_agent_put_tobacco_match type=action label="Agent puts tobacco+match"
            VIZ("smoking_agent_put_tobacco_match");
            // @viz-node id=smoking_agent_post_paper_before type=sync label="Agent posts paper smoker semaphore"
            VIZ("smoking_agent_post_paper_before");
            sem_post(&ctx->smoker_paper_sem);
            // @viz-node id=smoking_agent_post_paper_after type=sync label="Agent posted paper smoker semaphore"
            VIZ("smoking_agent_post_paper_after");
        } else {
            // @viz-node id=smoking_agent_put_tobacco_paper type=action label="Agent puts tobacco+paper"
            VIZ("smoking_agent_put_tobacco_paper");
            // @viz-node id=smoking_agent_post_match_before type=sync label="Agent posts match smoker semaphore"
            VIZ("smoking_agent_post_match_before");
            sem_post(&ctx->smoker_match_sem);
            // @viz-node id=smoking_agent_post_match_after type=sync label="Agent posted match smoker semaphore"
            VIZ("smoking_agent_post_match_after");
        }

        // @viz-node id=smoking_agent_wait_done_before type=sync label="Agent waits smoker done"
        VIZ("smoking_agent_wait_done_before");
        sem_wait(&ctx->agent_sem);
        // @viz-node id=smoking_agent_wait_done_after type=sync label="Agent observed smoker done"
        VIZ("smoking_agent_wait_done_after");
    }

    // @viz-node id=smoking_agent_exit type=thread label="Agent thread exits"
    VIZ("smoking_agent_exit");
    return NULL;
}

void smoking_problem(void)
{
    // @viz-node id=smoking_start type=thread label="Smoking problem starts"
    VIZ("smoking_start");

    smoking_ctx_t ctx;
    sem_init(&ctx.agent_sem, 0, 0);
    sem_init(&ctx.smoker_tobacco_sem, 0, 0);
    sem_init(&ctx.smoker_paper_sem, 0, 0);
    sem_init(&ctx.smoker_match_sem, 0, 0);

    pthread_t agent;
    pthread_t tobacco;
    pthread_t paper;
    pthread_t match;

    // @viz-node id=smoking_create_thread_agent type=thread label="Create agent thread"
    VIZ("smoking_create_thread_agent");
    pthread_create(&agent, NULL, agent_thread, &ctx);

    // @viz-node id=smoking_create_thread_tobacco type=thread label="Create tobacco smoker thread"
    VIZ("smoking_create_thread_tobacco");
    pthread_create(&tobacco, NULL, smoker_tobacco_thread, &ctx);

    // @viz-node id=smoking_create_thread_paper type=thread label="Create paper smoker thread"
    VIZ("smoking_create_thread_paper");
    pthread_create(&paper, NULL, smoker_paper_thread, &ctx);

    // @viz-node id=smoking_create_thread_match type=thread label="Create match smoker thread"
    VIZ("smoking_create_thread_match");
    pthread_create(&match, NULL, smoker_match_thread, &ctx);

    pthread_join(agent, NULL);
    pthread_join(tobacco, NULL);
    pthread_join(paper, NULL);
    pthread_join(match, NULL);

    sem_destroy(&ctx.agent_sem);
    sem_destroy(&ctx.smoker_tobacco_sem);
    sem_destroy(&ctx.smoker_paper_sem);
    sem_destroy(&ctx.smoker_match_sem);

    // @viz-node id=smoking_end type=thread label="Smoking problem finished"
    VIZ("smoking_end");
}
