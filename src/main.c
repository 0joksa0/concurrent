#include "littleBookOfSemaphores/basic/multiplex.h"
#include "littleBookOfSemaphores/basic/rendezvous.h"
#include "littleBookOfSemaphores/common/dining_philosophers.h"
#include "littleBookOfSemaphores/common/producer_consumer.h"
#include "littleBookOfSemaphores/common/smoking.h"
#include "littleBookOfSemaphores/advanced/deadlock.h"
#include "littleBookOfSemaphores/advanced/starvation.h"
#include "examples/local/termin1.h"
#include "examples/local/termin2.h"
#include "examples/local/termin3.h"
#include "littleBookOfSemaphores/basic/mutex.h"
#include "viz.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

typedef struct scenario_entry {
    const char *name;
    void (*fn)(void);
    const char *main_node_before;
} scenario_entry_t;

static const scenario_entry_t SCENARIOS[] = {
    { "rendezvous", rendezvous, "main_before_rendezvous" },
    { "mutex", mutex, "main_before_mutex" },
    { "multiplex", multiplex, "main_before_multiplex" },
    { "dining", dining_philosophers, "main_before_dining" },
    { "smoking", smoking_problem, "main_before_smoking" },
    { "producer_consumer", producer_consumer_problem, "main_before_pc" },
    { "deadlock", deadlock_problem, "main_before_deadlock" },
    { "starvation", starvation_problem, "main_before_starvation" }
};

static const scenario_entry_t* find_scenario(const char *name)
{
    size_t i;
    if (name == NULL || name[0] == '\0') {
        return NULL;
    }
    for (i = 0; i < (sizeof(SCENARIOS) / sizeof(SCENARIOS[0])); i++) {
        if (strcmp(SCENARIOS[i].name, name) == 0) {
            return &SCENARIOS[i];
        }
    }
    return NULL;
}

static void print_scenarios(void)
{
    size_t i;
    printf("Available scenarios:\n");
    for (i = 0; i < (sizeof(SCENARIOS) / sizeof(SCENARIOS[0])); i++) {
        printf("  %s\n", SCENARIOS[i].name);
    }
}

int main(int argc, char **argv)
{
    const char *scenario_name = "starvation";
    const char *trace_path = getenv("VIZ_TRACE_FILE");
    const scenario_entry_t *scenario;
    int i;

    if (trace_path == NULL || trace_path[0] == '\0') {
        trace_path = "trace.jsonl";
    }

    for (i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--list-scenarios") == 0) {
            print_scenarios();
            return 0;
        }
        if (strcmp(argv[i], "--scenario") == 0 && (i + 1) < argc) {
            scenario_name = argv[i + 1];
            i++;
            continue;
        }
        if (strcmp(argv[i], "--trace") == 0 && (i + 1) < argc) {
            trace_path = argv[i + 1];
            i++;
            continue;
        }
        fprintf(stderr, "Unknown argument: %s\n", argv[i]);
        fprintf(stderr, "Usage: %s [--list-scenarios] [--scenario NAME] [--trace PATH]\n", argv[0]);
        return 1;
    }

    scenario = find_scenario(scenario_name);
    if (scenario == NULL) {
        fprintf(stderr, "Unknown scenario: %s\n", scenario_name);
        print_scenarios();
        return 1;
    }

    viz_init(trace_path);
    viz_thread_register("main");

    VIZ(scenario->main_node_before);
    scenario->fn();
    viz_shutdown();
    return 0;
}
