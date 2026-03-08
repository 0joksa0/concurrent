#ifndef WATCHDOG_H
#define WATCHDOG_H

int watchdog_start_exit_after_us(unsigned int timeout_us,
                                 const char *thread_name,
                                 const char *timeout_node_id,
                                 int exit_code);

#endif
